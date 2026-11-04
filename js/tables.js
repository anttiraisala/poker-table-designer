/* Tables: outlines made of lines and arcs, the rail, the wrap line and the player-area (bet) line.
 * All coordinates are millimetres. A table keeps its nodes in its own coordinates and is placed on the
 * cloth by x, y and rot (degrees). */
(function (PTD) {
  "use strict";
  var T = {}, G = PTD.geom;
  var C = function () { return PTD.core; };
  var COLORS = ["#5ad1ff", "#ffb347", "#b58cff", "#7be38a", "#ff7ab8", "#f2e55c"];

  T.defaultPreset = function (type) {
    return { type: type || "stadium", w: 2400, h: 1200, r: 150, chamfer: 200,
      circleLock: true,
      notch: { on: false, style: "scoop", side: "bottom", w: 700, d: 160, r: 60, rm: 30 } };
  };
  T.make = function (id, name, type, index) {
    var t = {
      id: id, name: name, visible: true, color: COLORS[(index || 0) % COLORS.length], x: 0, y: 0, rot: 0,
      nodes: [], preset: T.defaultPreset(type), railW: 150, railColor: "#6b4a2b", wrap: 200, wrapShow: true, locked: false, players: PTD.scene.defaultPlayers(),
      bet: { on: false, inset: 250, thick: 8, color: "gold", gapOn: false, gapSide: "bottom", gapW: 900, outline: true, outlineW: 10 }
    };
    if (type === "circle") t.preset.w = t.preset.h = 1400;
    T.regen(t);
    return t;
  };
  T.regen = function (t) {
    var p = t.preset;
    if (!p) return;
    if (p.type === "circle") {
      if (p.circleLock !== false) p.h = p.w = Math.max(10, p.w);
      p.rad = Math.round(p.w / 2 * 100) / 100;
    }
    if (p.r < 0) p.r = 0;
    if (p.chamfer < 1) p.chamfer = 1;
    t.nodes = G.preset(p);
  };
  /* Makes saved data safe to use. */
  T.normalize = function (o, id) {
    var base = T.make(id, "Table", "stadium", 0);
    var t = Object.assign(base, o || {});
    t.id = id;
    ["x", "y", "rot", "railW", "wrap"].forEach(function (k) { t[k] = isFinite(Number(t[k])) ? Number(t[k]) : base[k]; });
    t.bet = Object.assign(base.bet, (o && o.bet) || {});
    ["inset", "thick", "gapW", "outlineW"].forEach(function (k) { t.bet[k] = isFinite(Number(t.bet[k])) ? Number(t.bet[k]) : base.bet[k]; });
    t.bet.outline = t.bet.outline !== false;
    if (t.preset) {
      var d = T.defaultPreset(t.preset.type);
      t.preset = Object.assign(d, t.preset);
      t.preset.notch = Object.assign(d.notch, t.preset.notch || {});
    }
    var okNodes = Array.isArray(t.nodes) && t.nodes.length >= 2 && t.nodes.every(function (n) { return n && isFinite(n.x) && isFinite(n.y); });
    if (okNodes) t.nodes = t.nodes.map(function (n) { return { x: Number(n.x), y: Number(n.y), b: Number(n.b) || 0 }; });
    else { t.preset = t.preset || T.defaultPreset("stadium"); T.regen(t); }
    t.visible = t.visible !== false;
    t.wrapShow = t.wrapShow !== false;
    t.players = PTD.scene.normalizePlayers(t.players);
    t.locked = !!t.locked;
    t.name = String(t.name || "Table");
    return t;
  };
  T.get = function (id) { return C().state().tables.filter(function (t) { return t.id === id; })[0]; };
  T.localToWorld = function (t, p) { return G.transformPoints([p], t.x, t.y, t.rot)[0]; };
  T.worldToLocal = function (t, p) {
    var a = -t.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = p.x - t.x, dy = p.y - t.y;
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  };

  /* ---- derived geometry, cached ---- */
  var cache = {};
  T.geo = function (t) {
    var key = JSON.stringify([t.nodes, t.x, t.y, t.rot, t.railW, t.wrap, t.bet]);
    var hit = cache[t.id];
    if (hit && hit.key === key) return hit.geo;
    var tol = 0.25, local = G.flatten(t.nodes, tol);
    function world(pts) { return G.transformPoints(pts, t.x, t.y, t.rot); }
    var geo = { local: local, poly: world(local) };
    geo.bbox = G.bbox(geo.poly);
    geo.area = Math.abs(G.area(local));
    geo.perimeter = G.polyLength(local, true);
    geo.rail = t.railW > 0 ? world(G.offsetPolygon(local, t.railW, tol)) : [];
    geo.wrap = t.wrap > 0 ? world(G.offsetPolygon(local, t.wrap, tol)) : [];
    geo.bet = null;
    if (t.bet.on && t.bet.inset > 0) {
      var inner = G.offsetPolygon(local, -t.bet.inset, tol);
      if (inner.length > 2) {
        var pts = inner, closed = true;
        if (t.bet.gapOn && t.bet.gapW > 0) {
          var h = t.bet.gapW / 2, s = t.bet.gapSide;
          var inGap = inner.map(function (p) {
            return s === "bottom" ? (p[1] > 0 && Math.abs(p[0]) < h) : s === "top" ? (p[1] < 0 && Math.abs(p[0]) < h) :
              s === "left" ? (p[0] < 0 && Math.abs(p[1]) < h) : (p[0] > 0 && Math.abs(p[1]) < h);
          });
          var cut = inGap.indexOf(true);
          if (cut >= 0) {
            var n = inner.length, start = -1;
            for (var i = 0; i < n; i++) if (inGap[(cut + i) % n] && !inGap[(cut + i + 1) % n]) { start = (cut + i + 1) % n; break; }
            if (start >= 0) {
              pts = [];
              for (var k = 0; k < n; k++) { var idx = (start + k) % n; if (inGap[idx]) break; pts.push(inner[idx]); }
              closed = false;
            }
          }
        }
        geo.bet = { pts: world(pts), closed: closed, localPts: pts };
      }
    }
    cache[t.id] = { key: key, geo: geo };
    return geo;
  };
  /* The printed width of the player-area line as polygons (for cutting). */
  /* Outline of the player-area line as closed rings. extra widens it on both sides (used for the halo). */
  T.betPolygons = function (t, extra) {
    var geo = T.geo(t);
    if (!geo.bet) return [];
    var w = t.bet.thick / 2 + (extra || 0), local = G.flatten(t.nodes, 0.1);
    if (geo.bet.closed) {
      var o = G.offsetPolygon(local, -t.bet.inset + w, 0.1), i = G.offsetPolygon(local, -t.bet.inset - w, 0.1);
      return [o, i.slice().reverse()].filter(function (p) { return p.length > 2; }).map(function (p) { return G.transformPoints(p, t.x, t.y, t.rot); });
    }
    var line = geo.bet.localPts, left = G.offsetOpen(line, w), right = G.offsetOpen(line, -w);
    return [G.transformPoints(left.concat(right.slice().reverse()), t.x, t.y, t.rot)];
  };
  T.worldNodes = function (t) { return G.transformNodes(t.nodes, t.x, t.y, t.rot); };
  T.visible = function () { return C().state().tables.filter(function (t) { return t.visible; }); };
  T.bboxAll = function () {
    var list = T.visible();
    if (!list.length) return null;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    list.forEach(function (t) {
      var g = T.geo(t), pts = g.wrap.length ? g.wrap : g.poly, b = G.bbox(pts);
      x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
    });
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  };
  /* Points other things can snap to: nodes, arc apexes, centres and the extreme edges. */
  T.snapPoints = function () {
    var pts = [], ex = [];
    T.visible().forEach(function (t) {
      var wn = T.worldNodes(t), n = wn.length;
      pts.push({ x: t.x, y: t.y, t: t.id, tag: t.name + " centre" });
      wn.forEach(function (p, i) {
        pts.push({ x: p.x, y: p.y, t: t.id, tag: t.name + " node " + (i + 1) });
        var ap = G.apexOf(p, wn[(i + 1) % n], p.b || 0);
        pts.push({ x: ap.x, y: ap.y, t: t.id, tag: t.name + (p.b ? " arc middle" : " edge middle") });
      });
      var b = T.geo(t).bbox;
      ex.push({ axis: "x", v: b.x0, t: t.id, tag: t.name + " left edge" }, { axis: "x", v: b.x1, t: t.id, tag: t.name + " right edge" },
        { axis: "y", v: b.y0, t: t.id, tag: t.name + " top edge" }, { axis: "y", v: b.y1, t: t.id, tag: t.name + " bottom edge" });
    });
    return { points: pts, extremes: ex };
  };

  /* ---- selection and editing ---- */
  T.select = function (id, node) {
    var core = C(), ui = core.ui;
    ui.selTable = id; ui.selNode = node == null ? null : node; ui.selGuide = null;
    var st = core.state(); st.selected = null; ui.extra = {};
    core.setTab("tables");
    core.renderPanels(); core.renderStage();
  };
  T.add = function (type) {
    var core = C(), st = core.state();
    var id = core.nextId("t", st.tables);
    var t = T.make(id, "Table " + (st.tables.length + 1), type, st.tables.length);
    st.tables.push(t);
    T.select(id);
    core.save();
  };
  T.remove = function (id) {
    var core = C(), st = core.state();
    st.tables = st.tables.filter(function (t) { return t.id !== id; });
    st.guides.forEach(function (g) { if (g.ref && g.ref.table === id) g.ref = { type: "centre" }; });
    if (core.ui.selTable === id) core.ui.selTable = null;
    core.renderPanels(); core.renderStage(); core.save();
  };
  T.detach = function (t) { t.preset = null; };
  T.deleteNode = function (t, i) {
    if (t.nodes.length <= 3) { C().say("An outline needs at least three nodes."); return; }
    var prev = (i - 1 + t.nodes.length) % t.nodes.length;
    t.nodes.splice(i, 1);
    t.nodes[prev > i ? prev - 1 : prev].b = 0;
    T.detach(t);
    C().ui.selNode = null;
  };
  T.insertNode = function (t, i, pt) {
    t.nodes = pt ? G.splitAt(t.nodes, i, pt) : G.splitSegment(t.nodes, i);
    T.detach(t);
    C().ui.selNode = i + 1;
  };

  /* ---- drawing ---- */
  T.renderArt = function (g, ctx) {
    var C0 = C(), st = C0.state();
    T.visible().forEach(function (t) {
      var geo = T.geo(t);
      if (!geo.bet) return;
      var d = G.polyPath(geo.bet.pts, geo.bet.closed);
      if (t.bet.outline && t.bet.outlineW > 0) {
        C0.el("path", { d: d, fill: "none", stroke: C0.colorHex(st.cloth.color), "stroke-width": Math.max(0.1, t.bet.thick) + 2 * t.bet.outlineW, "stroke-linejoin": "round", "stroke-linecap": "butt" }, g);
      }
      C0.el("path", { d: d, fill: "none", stroke: C0.colorHex(t.bet.color), "stroke-width": Math.max(0.1, t.bet.thick), "stroke-linejoin": "round", "stroke-linecap": "butt" }, g);
    });
  };
  /* The dealer area: the mouth of the notch, in cloth coordinates. null when the table has no notch. */
  T.dealerLine = function (t) {
    var p = t.preset, n = p && p.notch;
    if (!n || !n.on || p.type === "circle") return null;
    var w = Math.max(10, +p.w || 2400), h = Math.max(10, +p.h || 1200), hw = w / 2, hh = h / 2;
    var sides = { top: [[-hw, -hh], [hw, -hh]], right: [[hw, -hh], [hw, hh]], bottom: [[hw, hh], [-hw, hh]], left: [[-hw, hh], [-hw, -hh]] };
    var sd = sides[n.side]; if (!sd) return null;
    var e = [sd[1][0] - sd[0][0], sd[1][1] - sd[0][1]], L = Math.hypot(e[0], e[1]);
    e = [e[0] / L, e[1] / L];
    var nw = Math.max(1, Math.min(+n.w || 600, L - 2)), mid = [(sd[0][0] + sd[1][0]) / 2, (sd[0][1] + sd[1][1]) / 2];
    var pts = G.transformPoints([[mid[0] - e[0] * nw / 2, mid[1] - e[1] * nw / 2], [mid[0] + e[0] * nw / 2, mid[1] + e[1] * nw / 2], [mid[0] - e[1] * (+n.d || 150) / 2 + 0, mid[1] + e[0] * (+n.d || 150) / 2]], t.x, t.y, t.rot);
    return { a: pts[0], b: pts[1], label: pts[2] };
  };
  T.render = function (g, ctx) {
    var C0 = C(), el = C0.el, z = ctx.z, ui = C0.ui;
    T.visible().forEach(function (t) {
      var geo = T.geo(t), sel = ui.selTable === t.id;
      if (geo.rail.length) {
        el("path", { d: G.polyPath(geo.rail) + G.polyPath(geo.poly), "fill-rule": "evenodd", fill: t.railColor, "fill-opacity": 0.38, "pointer-events": "none" }, g);
      }
      el("path", { d: G.polyPath(geo.poly), fill: t.color, "fill-opacity": sel ? 0.07 : 0.03, "pointer-events": "none" }, g);
      if (geo.wrap.length && t.wrapShow !== false) {
        el("path", { d: G.polyPath(geo.wrap), fill: "none", stroke: t.color, "stroke-width": 1, "stroke-dasharray": "7 5", "stroke-opacity": 0.75, "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g);
        el("path", { d: G.polyPath(geo.wrap), fill: "none", stroke: "rgba(0,0,0,0)", "stroke-width": 10, "vector-effect": "non-scaling-stroke", "pointer-events": "stroke", "data-tip": t.name + ": cloth wrap line, " + Math.round(t.wrap) + " mm outside the outline" }, g);
      }
      if (geo.bet && geo.bet.pts.length > 1) {
        el("path", { d: G.polyPath(geo.bet.pts, geo.bet.closed), fill: "none", stroke: "rgba(0,0,0,0)", "stroke-width": 10, "vector-effect": "non-scaling-stroke", "pointer-events": "stroke", "data-tip": t.name + ": player-area line, " + Math.round(t.bet.inset) + " mm inside the outline" }, g);
      }
      el("path", { d: G.polyPath(geo.poly), fill: "none", stroke: t.color, "stroke-width": sel ? 3 : 2, "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g);
      if (!t.locked || true) {
        el("path", { d: G.polyPath(geo.poly), fill: "none", stroke: "rgba(0,0,0,0)", "stroke-width": 12, "vector-effect": "non-scaling-stroke", "pointer-events": "stroke", "data-tip": t.name + ": table outline" + (t.locked ? " (locked)" : ""), "data-h": "tedge:" + t.id, style: "cursor:" + (sel && !t.locked ? "move" : "pointer") }, g);
      }
      var dl = C0.cfg().showDealer !== false ? T.dealerLine(t) : null;
      if (dl) {
        el("line", { x1: dl.a[0], y1: dl.a[1], x2: dl.b[0], y2: dl.b[1], stroke: "#ff7ab8", "stroke-width": 2, "stroke-dasharray": "9 6", "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, g);
        var dt = el("text", { x: dl.label[0], y: dl.label[1], "text-anchor": "middle", "dominant-baseline": "middle", "font-size": 12 / z, fill: "#ff7ab8", "pointer-events": "none" }, g);
        dt.style.fontFamily = "'Josefin Sans', sans-serif"; dt.textContent = "Dealer";
      }
      if (C0.cfg().showNames === false) return;
      var lab = el("text", { x: t.x, y: t.y, "text-anchor": "middle", "font-size": 13 / z, fill: t.color, "fill-opacity": 0.9, "pointer-events": "none" }, g);
      lab.style.fontFamily = "'Josefin Sans', sans-serif";
      lab.textContent = t.name;
    });
  };
  T.renderHandles = function (g, ctx) {
    var C0 = C(), el = C0.el, z = ctx.z, ui = C0.ui, t = T.get(ui.selTable);
    if (!t || !t.visible) return;
    var wn = T.worldNodes(t), n = wn.length;
    wn.forEach(function (p, i) {
      var q = wn[(i + 1) % n], ap = G.apexOf(p, q, p.b || 0), isArc = Math.abs(p.b || 0) > 1e-9;
      var d = 4.5 / z;
      el("rect", { x: ap.x - d, y: ap.y - d, width: 2 * d, height: 2 * d, transform: "rotate(45 " + ap.x + " " + ap.y + ")", fill: isArc ? "#ffb347" : "rgba(255,255,255,0.35)", stroke: "#0d2b22", "stroke-width": 1, "vector-effect": "non-scaling-stroke", "data-h": "tbulge:" + t.id + ":" + i, style: "cursor:pointer" }, g);
    });
    wn.forEach(function (p, i) {
      var on = ui.selNode === i;
      el("circle", { cx: p.x, cy: p.y, r: (on ? 7.5 : 6) / z, fill: on ? "#d4af5a" : "#ffffff", stroke: "#0d2b22", "stroke-width": 1.5, "vector-effect": "non-scaling-stroke", "data-h": "tnode:" + t.id + ":" + i, style: "cursor:move" }, g);
    });
  };

  /* ---- pointer handling ---- */
  /* h is the data-h text of the clicked handle. Returns true when it was used. */
  T.pointerDown = function (e, h, p) {
    var C0 = C(), parts = h.split(":"), kind = parts[0], t = T.get(parts[1]);
    if (!t) return false;
    if (kind === "tedge") {
      if (C0.ui.selTable !== t.id) { T.select(t.id); return true; }
      if (t.locked) return true;
      var start = { x: p.x, y: p.y }, ox = t.x, oy = t.y, moved = false;
      C0.startDrag(e, {
        move: function (q, ev) {
          var nx = ox + q.x - start.x, ny = oy + q.y - start.y;
          if (C0.cfg().snap && !ev.altKey && !ev.ctrlKey) {
            var s = C0.snapXY({ x: nx, y: ny }, {});
            nx = s.x; ny = s.y;
          } else { nx = Math.round(nx * 10) / 10; ny = Math.round(ny * 10) / 10; }
          if (nx !== t.x || ny !== t.y) moved = true;
          t.x = nx; t.y = ny;
          C0.renderStage(); C0.syncInputs();
        },
        up: function () { C0.ui.snapLines = null; C0.renderStage(); if (moved) C0.save("tmove:" + t.id); }
      });
      return true;
    }
    var i = Number(parts[2]);
    if (C0.ui.selTable !== t.id) T.select(t.id);
    if (kind === "tnode") {
      C0.ui.selNode = i; C0.renderPanels();
      if (t.locked) { C0.renderStage(); return true; }
      C0.startDrag(e, {
        move: function (q, ev) {
          var w = { x: q.x, y: q.y };
          if (C0.cfg().snap && !ev.altKey && !ev.ctrlKey) w = C0.snapXY(w, { excludeTable: t.id });
          var l = T.worldToLocal(t, w);
          if (t.preset && t.preset.type === "circle") {
            /* a circle stays a circle around its centre: the dragged node sets the radius */
            var pr = t.preset;
            if (pr.circleLock === false && pr.w !== pr.h) {   /* an oval keeps its proportions */
              var k = Math.hypot(l.x, l.y) / Math.max(1, Math.hypot(t.nodes[i].x, t.nodes[i].y));
              pr.w = Math.max(20, Math.round(pr.w * k)); pr.h = Math.max(20, Math.round(pr.h * k));
            } else pr.w = pr.h = Math.max(20, Math.round(2 * Math.hypot(l.x, l.y)));
            T.regen(t);
          } else {
            t.nodes[i].x = Math.round(l.x * 10) / 10; t.nodes[i].y = Math.round(l.y * 10) / 10;
            T.detach(t);
          }
          C0.renderStage(); C0.syncInputs();
        },
        up: function () { C0.ui.snapLines = null; C0.renderPanels(); C0.renderStage(); C0.save("tnode:" + t.id); }
      });
      return true;
    }
    if (kind === "tbulge") {
      if (t.locked) return true;
      C0.startDrag(e, {
        move: function (q) {
          var l = T.worldToLocal(t, q), a = t.nodes[i], b = t.nodes[(i + 1) % t.nodes.length];
          var bulge = G.bulgeFromApex(a, b, l), L = Math.hypot(b.x - a.x, b.y - a.y);
          if (Math.abs(bulge) * L / 2 < 2 / C0.ui.view.z) bulge = 0;
          a.b = Math.max(-30, Math.min(30, bulge));
          T.detach(t);
          C0.renderStage(); C0.syncInputs();
        },
        up: function () { C0.renderPanels(); C0.renderStage(); C0.save("tbulge:" + t.id); }
      });
      return true;
    }
    return false;
  };
  T.doubleClick = function (h, p) {
    var parts = h.split(":"), t = T.get(parts[1]);
    if (!t || parts[0] !== "tedge" || t.locked) return false;
    var l = T.worldToLocal(t, p), ns = G.nearestSegment(t.nodes, [l.x, l.y]);
    T.insertNode(t, ns.i, { x: l.x, y: l.y });
    C().renderPanels(); C().renderStage(); C().save();
    return true;
  };
  T.key = function (e) {
    var C0 = C(), ui = C0.ui, t = T.get(ui.selTable);
    if (!t) return false;
    if ((e.key === "Delete" || e.key === "Backspace") && ui.selNode != null && !t.locked) {
      T.deleteNode(t, ui.selNode);
      C0.renderPanels(); C0.renderStage(); C0.save();
      return true;
    }
    return false;
  };

  /* ---- panel ---- */
  var SIDES = [["top", "Top"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"]];
  T.panelHTML = function () {
    var core = C(), st = core.state(), ui = core.ui, esc = core.esc, h = core.h, G0 = PTD.geom;
    var out = '<h3 class="sec">Cloth</h3><div class="panel"><div class="body">' +
      '<div class="checks">' + h.chk("Real cloth size (shows overhang)", "cloth", "real") + '</div>' +
      '<div class="row2">' + h.len("Cloth width", "cloth", "w") + h.len("Cloth height", "cloth", "h") + '</div>' +
      '<div class="row2">' + h.len("Cloth centre X", "cloth", "x") + h.len("Cloth centre Y", "cloth", "y") + '</div>' +
      '<div class="colorrow" data-colour="cloth:color:Cloth colour"></div>' +
      '<p class="small">By default the cloth is endless and the origin is its centre mark. Switch on the real size to see how much cloth hangs over each table.</p></div></div>';
    out += '<h3 class="sec">Tables</h3><div class="btnrow"><button class="btn" type="button" data-act="partopen" title="Open a project, artwork or tables file. Everything the file contains is loaded.">Open</button><button class="btn" type="button" data-act="partsave" data-part="tables" title="Save the tables, player-area lines, guides and constraints only">Save tables</button><button class="btn" type="button" data-act="jsonopen" data-part="tables" title="Show the tables and guides as text to copy, paste and apply">JSON…</button></div>';
    st.tables.forEach(function (t) {
      var sel = ui.selTable === t.id;
      out += '<section class="panel layer' + (sel ? " sel open" : "") + (t.visible ? "" : " hid") + '"><header>' +
        '<span class="swatch" style="background:' + esc(t.color) + '"></span>' +
        '<button class="selbtn" type="button" data-act="tselect" data-id="' + t.id + '"><span class="ttl">' + esc(t.name) + '</span></button>' +
        '<div class="tools">' + core.eyeBtn(t.id, !t.visible, "this table", "teye") +
        '<button type="button" data-act="tdel" data-id="' + t.id + '" title="Delete this table" aria-label="Delete table">✕</button></div></header></section>';
    });
    out += '<div class="btnrow">' +
      '<button class="btn" type="button" data-act="tadd" data-type="stadium">+ Stadium</button>' +
      '<button class="btn" type="button" data-act="tadd" data-type="rect">+ Rectangle</button>' +
      '<button class="btn" type="button" data-act="tadd" data-type="octagon">+ Octagon</button>' +
      '<button class="btn" type="button" data-act="tadd" data-type="circle">+ Circle</button></div>';
    var t = T.get(ui.selTable);
    if (!t) return out + '<p class="small">Select a table above, or click its outline on the canvas, to edit it.</p>';
    var sc = "table:" + t.id, geo = T.geo(t), p = t.preset;
    var typeOpts = [["stadium", "Stadium (round ends)"], ["rect", "Rectangle, rounded corners"], ["octagon", "Octagon (cut corners)"], ["circle", "Circle"]];
    out += '<h3 class="sec">Selected table</h3><div class="panel sel"><div class="body">' +
      '<div class="row2"><label class="fld"><span>Name</span><input type="text" data-scope="' + sc + '" data-key="name" autocomplete="off"></label>' +
      '<div class="fld"><span>Outline colour (editor only)</span><div class="colorrow"><input type="color" data-scope="' + sc + '" data-key="color" aria-label="Table outline colour"></div></div></div>' +
      '<div class="checks">' + h.chk("Locked (cannot be dragged)", sc, "locked") + '</div>' +
      '<p class="small">Area ' + (geo.area / 1e6).toFixed(3) + ' m² · perimeter ' + core.fmtLen(geo.perimeter) + ' · size ' + core.fmtLen(geo.bbox.w) + ' × ' + core.fmtLen(geo.bbox.h) + '</p>' +
      '<h3 class="sec">Shape</h3>';
    if (p) {
      out += '<label class="fld"><span>Preset</span><select data-scope="preset:' + t.id + '" data-key="type">' + typeOpts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join("") + '</select></label>' +
        (p.type === "circle"
          ? '<div class="checks">' + h.chk("Keep it a circle (lock the aspect ratio)", "preset:" + t.id, "circleLock") + '</div>' +
            (p.circleLock !== false
              ? '<div class="row2">' + h.len("Diameter", "preset:" + t.id, "w") + h.len("Radius", "preset:" + t.id, "rad") + '</div>'
              : '<div class="row2">' + h.len("Width (X diameter)", "preset:" + t.id, "w") + h.len("Height (Y diameter)", "preset:" + t.id, "h") + '</div>')
          : '<div class="row2">' + h.len("Width", "preset:" + t.id, "w") + h.len("Height", "preset:" + t.id, "h") + '</div>');
      if (p.type === "rect") out += h.len("Corner radius", "preset:" + t.id, "r");
      if (p.type === "octagon") out += h.len("Corner cut", "preset:" + t.id, "chamfer");
      if (p.type !== "circle") {
        var nc = "notch:" + t.id;
        out += '<div class="checks">' + h.chk("Dealer notch", nc, "on") + '</div>';
        if (p.notch.on) {
          out += '<div class="row2"><label class="fld"><span>Notch shape</span><select data-scope="' + nc + '" data-key="style"><option value="scoop">Scoop (one arc)</option><option value="box">Box (straight sides)</option></select></label>' +
            '<label class="fld"><span>Notch side</span><select data-scope="' + nc + '" data-key="side">' + SIDES.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join("") + '</select></label></div>' +
            '<div class="row2">' + h.len("Notch width", nc, "w") + h.len("Notch depth", nc, "d") + '</div>';
          if (p.notch.style === "box") out += '<div class="row2">' + h.len("Inner corner radius", nc, "r") + h.len("Mouth corner radius", nc, "rm") + '</div>';
        }
      }
      out += '<p class="small">The shape follows these settings. Moving a node or an arc handle makes it a free outline.</p>';
    } else {
      out += '<p class="small">Free outline. Choose a preset to rebuild the shape from settings (this replaces the nodes).</p>' +
        '<div class="btnrow">' + typeOpts.map(function (o) { return '<button class="btn" type="button" data-act="tpreset" data-id="' + t.id + '" data-type="' + o[0] + '">' + o[1].split(" (")[0].split(",")[0] + '</button>'; }).join("") + '</div>';
    }
    out += '<div class="btnrow"><button class="btn" type="button" data-act="tflipx" data-id="' + t.id + '">Mirror left–right</button><button class="btn" type="button" data-act="tflipy" data-id="' + t.id + '">Mirror top–bottom</button></div>' +
      '<h3 class="sec">Placement</h3>' +
      '<div class="row3">' + h.len("X", sc, "x") + h.len("Y", sc, "y") + h.deg("Rotation", sc, "rot") + '</div>' +
      '<div class="btnrow"><button class="btn" type="button" data-act="tcentre" data-id="' + t.id + '">Centre on origin</button>' +
      [0, 90, 180, 270].map(function (a) { return '<button class="btn" type="button" data-act="trot" data-id="' + t.id + '" data-a="' + a + '">' + a + '°</button>'; }).join("") + '</div>' +
      '<h3 class="sec">Rail and cloth wrap</h3>' +
      '<div class="row2">' + h.len("Rail width", sc, "railW") + h.len("Wrap allowance", sc, "wrap") + '</div>' +
      '<div class="checks">' + h.chk("Show the dashed wrap line", sc, "wrapShow") + '</div>' +
      '<div class="colorrow"><input type="color" data-scope="' + sc + '" data-key="railColor" aria-label="Rail colour"><span class="small">Rail colour (preview only). The dashed line is the outline pushed out by the wrap allowance, the cloth you need to wrap around the edge.</span></div>' +
      '<h3 class="sec">Player-area line</h3>' +
      '<div class="checks">' + h.chk("Show the line", "bet:" + t.id, "on") + '</div>';
    if (t.bet.on) {
      out += '<div class="row3">' + h.len("Distance from edge", "bet:" + t.id, "inset") + h.len("Thickness", "bet:" + t.id, "thick") + '<div class="fld"><span>Colour</span><div class="colorrow" data-colour="bet:' + t.id + ':color:"></div></div></div>' +
        '<div class="checks">' + h.chk("Outline (hides what is below)", "bet:" + t.id, "outline") + h.chk("Leave a gap (for the dealer)", "bet:" + t.id, "gapOn") + '</div>';
      if (t.bet.outline) out += h.len("Outline width", "bet:" + t.id, "outlineW") + '<p class="small">The line lies above all texts. The outline cuts a clean margin around it in the cloth colour, and in the cut file it leaves a hole in whatever is below.</p>';
      if (t.bet.gapOn) out += '<div class="row2"><label class="fld"><span>Gap side</span><select data-scope="bet:' + t.id + '" data-key="gapSide">' + SIDES.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join("") + '</select></label>' + h.len("Gap width", "bet:" + t.id, "gapW") + '</div>';
    }
    var pl = "players:" + t.id, ps = t.players;
    out += '<h3 class="sec">Players</h3><p class="small">Players sit evenly around the table between the edge and the player-area line, with a random hand in progress: cards, chip stacks, folded cards, bets and the dealer button. They show in the picture and in Blender, never in the cut file. The Random tab can show, hide and vary them.</p>' +
      '<div class="checks">' + h.chk("Show players", pl, "show") + h.chk("Dealer is a player", pl, "dealerPlayer") + '</div>';
    if (ps.show) {
      var sc2 = PTD.scene.build(C().state()), ti = sc2.info.tables.filter(function (x) { return x.id === t.id; })[0];
      out += '<div class="row3">' + h.numField("Players (1-12)", pl, "count", "1") +
        '<label class="fld"><span>Cards each</span><select data-scope="' + pl + '" data-key="cards" data-num="1"><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>' +
        '<label class="fld"><span>Dealer side</span><select data-scope="' + pl + '" data-key="dealerSide">' + SIDES.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join("") + '</select></label></div>' +
        '<p class="small">The dealer side is used when the table has no dealer notch. With the notch on, the notch side is the dealer position.</p>' +
        '<div class="btnrow"><button class="btn" type="button" data-act="playseed" data-id="' + t.id + '">New arrangement</button></div>' +
        (ti ? '<p class="small">' + ti.active + ' of ' + ti.seats + ' players are still in the hand. The dealer button is at seat ' + ti.button + ', counted clockwise from the dealer position.' + (ti.warn ? ' <b>' + ti.warn + '</b>' : '') + '</p>' : '');
    }
    out += '<h3 class="sec">Nodes</h3><p class="small">Each node is joined to the next. Bulge 0 is a straight line; 1 is a half circle, positive curves to the right of the direction of travel. Drag nodes (circles) and arc handles (diamonds) on the canvas, double-click an edge to add a node, press Delete to remove the selected node.</p>' +
      '<div class="nodegrid"><span></span><span class="small">X</span><span class="small">Y</span><span class="small">Bulge</span><span></span></div>';
    t.nodes.forEach(function (n, i) {
      var s = "node:" + t.id + ":" + i;
      out += '<div class="nodegrid' + (ui.selNode === i ? " sel" : "") + '"><span class="idx">' + (i + 1) + '</span>' +
        '<input type="number" step="any" data-unit="len" data-scope="' + s + '" data-key="x" aria-label="Node ' + (i + 1) + ' X">' +
        '<input type="number" step="any" data-unit="len" data-scope="' + s + '" data-key="y" aria-label="Node ' + (i + 1) + ' Y">' +
        '<input type="number" step="any" data-scope="' + s + '" data-key="b" aria-label="Node ' + (i + 1) + ' bulge">' +
        '<span class="tools"><button type="button" data-act="tnodesel" data-id="' + t.id + '" data-i="' + i + '" title="Select node">◎</button>' +
        '<button type="button" data-act="tnodeadd" data-id="' + t.id + '" data-i="' + i + '" title="Add a node after this one">+</button>' +
        '<button type="button" data-act="tnodedel" data-id="' + t.id + '" data-i="' + i + '" title="Delete this node">✕</button></span></div>';
    });
    out += '</div></div>';
    return out;
  };

  /* Clicks inside the Tables tab. Returns true when handled. */
  T.act = function (act, d) {
    var core = C(), st = core.state(), t = d.id ? T.get(d.id) : null;
    if (act === "tadd") { T.add(d.type); return true; }
    if (act === "tselect") { T.select(d.id); return true; }
    if (act === "teye" && t) { t.visible = !t.visible; core.renderPanels(); core.renderStage(); core.save(); return true; }
    if (act === "tdel" && t) { T.remove(d.id); return true; }
    if (!t) return false;
    if (act === "tpreset") { t.preset = T.defaultPreset(d.type); var g = T.geo(t); if (g) { t.preset.w = Math.round(g.bbox.w) || 2400; t.preset.h = Math.round(g.bbox.h) || 1200; if (d.type === "circle") t.preset.w = t.preset.h = Math.min(t.preset.w, t.preset.h); } T.regen(t); core.ui.selNode = null; }
    else if (act === "tflipx" || act === "tflipy") { t.nodes = G.mirrorNodes(t.nodes, act === "tflipx"); T.detach(t); }
    else if (act === "tcentre") { t.x = 0; t.y = 0; }
    else if (act === "trot") { t.rot = Number(d.a); }
    else if (act === "tnodesel") { core.ui.selNode = Number(d.i); }
    else if (act === "tnodeadd") { T.insertNode(t, Number(d.i)); }
    else if (act === "tnodedel") { T.deleteNode(t, Number(d.i)); }
    else return false;
    core.renderPanels(); core.syncInputs(); core.renderStage(); core.save();
    return true;
  };

  /* data-scope lookups for the generic input binding, and what to do after an edit */
  PTD.scopes = PTD.scopes || {};
  PTD.onChange = PTD.onChange || {};
  PTD.onChange = PTD.onChange || {};
  PTD.scopes.table = function (id) { return T.get(id); };
  PTD.scopes.preset = function (id) { var t = T.get(id); return t && t.preset; };
  PTD.scopes.notch = function (id) { var t = T.get(id); return t && t.preset && t.preset.notch; };
  PTD.scopes.bet = function (id) { var t = T.get(id); return t && t.bet; };
  PTD.scopes.players = function (id) { var t = T.get(id); return t && t.players; };
  PTD.onChange.players = function (obj, key) {
    if (key === "show") C().renderPanels();   /* the count, cards and dealer side appear when the players are shown */
    obj.count = Math.max(1, Math.min(12, Math.round(Number(obj.count) || 1)));
    if (!isFinite(obj.cards)) obj.cards = 2;
  };
  PTD.scopes.node = function (id) { var q = id.split(":"), t = T.get(q[0]); return t && t.nodes[Number(q[1])]; };
  function presetChanged(id, key) {
    var t = T.get(id); if (!t) return;
    var p = t.preset;
    if (key === "type" && p.type === "circle") { p.circleLock = true; p.h = p.w = Math.min(p.w, p.h); }
    if (p.type === "circle") {
      if (key === "rad") p.w = p.h = Math.max(10, 2 * (Number(p.rad) || 0));
      else if (key === "h" && p.circleLock !== false) p.w = p.h;
      else if (key === "circleLock" && p.circleLock !== false) p.h = p.w;
    }
    if (key === "r" && !(p.r >= 0)) p.r = 0;
    if (key === "chamfer" && !(p.chamfer >= 1)) p.chamfer = 1;
    T.regen(t); C().ui.selNode = null;
    C().renderPanels();
  }
  PTD.onChange.preset = function (obj, key, id) { presetChanged(id, key); };
  PTD.onChange.notch = function (obj, key, id) { presetChanged(id, key); };
  PTD.onChange.node = function (obj, key, id) { var t = T.get(id.split(":")[0]); if (t) T.detach(t); };
  PTD.onChange.bet = function (obj, key, id) { if (key === "on" || key === "gapOn") C().renderPanels(); };
  PTD.onChange.table = function (obj, key) { if (key === "name") { var n = document.querySelector('[data-act="tselect"][data-id="' + obj.id + '"] .ttl'); if (n) n.textContent = obj.name; } };

  PTD.tables = T;
})(window.PTD = window.PTD || {});
