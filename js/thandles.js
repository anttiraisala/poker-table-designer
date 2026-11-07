/* Resize handles on a selected text (REQ-013): eight handles (corners and middles of the sides) on the box of the text.
 * Dragging one scales the font size with the aspect ratio kept. The opposite corner (or the middle of the opposite side)
 * stays where it is; with Shift held the centre of the box stays. Letter space scales with the size so that the look is kept.
 * Snapping uses the usual snap points and the edges of the other items; Alt or Ctrl switch it off; Esc cancels. */
(function (PTD) {
  "use strict";
  var T = {};
  var HANDLES = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]];
  var MIN = 1, MAX = 3000;   /* the limits of the size field, in millimetres */
  function C() { return PTD.core; }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function frame(l) { var a = (l.rot || 0) * Math.PI / 180; return { ca: Math.cos(a), sa: Math.sin(a) }; }

  /* The one selected text that gets handles, with its box (artwork coordinates, before the turn about the position point). */
  function target() {
    var c = C(), ui = c.ui;
    if (!c || ui.tool !== "select") return null;
    var ids = c.selectedIds();
    if (ids.length !== 1) return null;
    var l = c.getLayer(ids[0]), b = l && ui.tbox ? ui.tbox[l.id] : null;
    if (!l || l.hidden || l.frozen || l.locked || !b || !(b.w > 0) || !(b.h > 0)) return null;
    return { l: l, box: b };
  }
  /* Which handles show: fewer when the box is small on the screen, none when it is tiny. */
  function visible(b, z) {
    var mx = Math.max(b.w, b.h) * z, mn = Math.min(b.w, b.h) * z;
    if (mx < 14) return [];
    if (mn < 26) return [HANDLES[0], HANDLES[2], HANDLES[4], HANDLES[6]];
    return HANDLES;
  }
  T.handles = function () { var t = target(); return t ? visible(t.box, C().ui.view.z) : []; };
  T.target = target;

  function cursorOf(u, v) {
    if (u === 0.5) return "ns-resize";
    if (v === 0.5) return "ew-resize";
    return (u === v) ? "nwse-resize" : "nesw-resize";
  }
  T.render = function (g, ctx) {
    var t = target(); if (!t) return;
    var c = C(), el = c.el, z = ctx.z, l = t.l, b = t.box, AO = c.artOrigin();
    var grp = el("g", { transform: "translate(" + AO.x + " " + AO.y + ") rotate(" + (l.rot || 0) + " " + l.x + " " + l.y + ")" }, g);
    var s = 9 / z, hit = 12 / z;
    visible(b, z).forEach(function (hd) {
      var x = b.x + hd[0] * b.w, y = b.y + hd[1] * b.h;
      var hn = el("g", { "data-h": "thandle:" + hd[0] + ":" + hd[1], style: "cursor:" + cursorOf(hd[0], hd[1]) }, grp);
      el("circle", { cx: x, cy: y, r: hit, fill: "transparent" }, hn);
      el("rect", { x: x - s / 2, y: y - s / 2, width: s, height: s, fill: "#ffffff", stroke: "#5ad1ff", "stroke-width": 1.5, "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, hn);
    });
  };

  /* A press on a handle: the drag. */
  T.pointerDown = function (e, h, p) {
    var t = target(); if (!t) return false;
    var parts = h.split(":"), u = Number(parts[1]), v = Number(parts[2]);
    if (!isFinite(u) || !isFinite(v)) return false;
    var c = C(), ui = c.ui, cfg = c.cfg(), l = t.l, b = { x: t.box.x, y: t.box.y, w: t.box.w, h: t.box.h };
    var x0 = l.x, y0 = l.y, size0 = l.size, ls0 = Number(l.ls) || 0, f = frame(l), AO = c.artOrigin(), moved = false, info = { size: size0, k: 1 };
    function pt(uu, vv) { return { x: b.x + uu * b.w, y: b.y + vv * b.h }; }
    function rotv(dx, dy) { return { x: dx * f.ca - dy * f.sa, y: dx * f.sa + dy * f.ca }; }
    function toWorldPt(q) { var r = rotv(q.x - x0, q.y - y0); return { x: AO.x + x0 + r.x, y: AO.y + y0 + r.y }; }
    var H0 = pt(u, v), H0w = toWorldPt(H0), off = { x: p.x - H0w.x, y: p.y - H0w.y };   /* where in the handle it was grabbed */
    var kmin = MIN / size0, kmax = MAX / size0;
    c.startDrag(e, {
      op: "text-scale",
      readout: function () { return "Size " + info.size.toFixed(1) + " mm   x" + info.k.toFixed(2); },
      move: function (q, ev) {
        var centre = !!ev.shiftKey, F = centre ? pt(0.5, 0.5) : pt(1 - u, 1 - v), Wf = toWorldPt(F);
        var d0 = { x: H0.x - F.x, y: H0.y - F.y }, wd = rotv(d0.x, d0.y), den = wd.x * wd.x + wd.y * wd.y;
        if (den < 1e-9) return;
        var qx = q.x - off.x, qy = q.y - off.y;
        var kk = Math.max(kmin, Math.min(kmax, ((qx - Wf.x) * wd.x + (qy - Wf.y) * wd.y) / den));
        if (cfg.snap && !ev.altKey && !ev.ctrlKey) {
          var Hk = { x: Wf.x + kk * wd.x, y: Wf.y + kk * wd.y };
          c.snapXY(Hk, {});
          var lines = ui.snapLines, thr = 10 / ui.view.z, best = null;
          ["x", "y"].forEach(function (ax) {
            var comp = ax === "x" ? wd.x : wd.y;
            if (Math.abs(comp) < 1e-6) return;
            var cands = [];
            if (lines && lines[ax] && lines[ax].length) cands.push(lines[ax][0]);
            Object.keys(ui.bounds).forEach(function (key) {
              if (key === l.id) return;
              var o = ui.bounds[key], s = ax === "x" ? o.w : o.h, st = ax === "x" ? o.x : o.y;
              cands.push(st, st + s / 2, st + s);
            });
            cands.forEach(function (cv) {
              var dd = Math.abs(cv - Hk[ax]); if (dd > thr) return;
              var kc = (cv - Wf[ax]) / comp;
              if (kc < kmin || kc > kmax) return;
              if (!best || dd < best.dd) best = { dd: dd, k: kc, ax: ax, cv: cv };
            });
          });
          ui.snapLines = best ? (best.ax === "x" ? { x: [best.cv], y: [] } : { x: [], y: [best.cv] }) : null;
          if (best) kk = best.k;
        } else ui.snapLines = null;
        var r = rotv(F.x - x0, F.y - y0);
        l.size = r3(size0 * kk); l.ls = r3(ls0 * kk);
        l.x = r3(x0 + (1 - kk) * r.x); l.y = r3(y0 + (1 - kk) * r.y);
        info.size = l.size; info.k = kk;
        if (Math.abs(kk - 1) > 1e-9) moved = true;
        c.renderStage();
        /* The box of a text is not exactly proportional to its size (the font metrics are rounded), so the fixed point is put back exactly. */
        var nb = ui.tbox[l.id], fr = centre ? { u: 0.5, v: 0.5 } : { u: 1 - u, v: 1 - v };
        if (nb) {
          var ar = (l.rot || 0) * Math.PI / 180, ca = Math.cos(ar), sa = Math.sin(ar);
          var fx = nb.x + fr.u * nb.w - l.x, fy = nb.y + fr.v * nb.h - l.y;
          var wx = AO.x + l.x + fx * ca - fy * sa, wy = AO.y + l.y + fx * sa + fy * ca;
          var ex = Wf.x - wx, ey = Wf.y - wy;
          if (Math.abs(ex) > 0.001 || Math.abs(ey) > 0.001) { l.x = r3(l.x + ex); l.y = r3(l.y + ey); c.renderStage(); }
        }
        c.syncInputs();
      },
      up: function () {
        ui.snapLines = null; c.renderStage(); c.renderPanels();
        if (moved) c.save("tscale:" + l.id + ":" + Date.now());
      }
    });
    return true;
  };

  /* The pointer resting on a handle shows the hint before anything is pressed. */
  var svg = document.getElementById("stage");
  if (svg) {
    svg.addEventListener("pointermove", function (e) {
      if (!PTD.hints || (PTD.core && PTD.core.ui.dragging)) return;
      var hn = e.target && e.target.closest ? e.target.closest("[data-h^='thandle:']") : null;
      if (hn) PTD.hints.hover("text-scale"); else if (PTD.hints.hovered() === "text-scale") PTD.hints.hover(null);   /* only clear the hint that this module set */
    });
    svg.addEventListener("pointerleave", function () { if (PTD.hints) PTD.hints.hover(null); });
  }
  PTD.thandles = T;
})(window.PTD = window.PTD || {});
