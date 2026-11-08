/* Panes and splitters (REQ-054, level 2). The window is divided into panes: the stage, the side panel and, under the stage, a dock for the graph
 * editor. A splitter is one reusable component (a direction, a size, minimum and maximum, a default, pointer and keyboard). The sizes are the
 * settings of the user (config.layout), not part of any project. The dock opens when something wants it (L.dock.want) and closes when that stops. */
(function (PTD) {
  "use strict";
  var L = { dock: { want: function () { return false; }, title: "Procedural graph" } };
  var app, col, side, dock, hs, vs, userClosed = false, lastWant = false, maxed = false;
  function C() { return PTD.core; }
  function lay() { return C().cfg().layout; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function save() { C().saveConfig(); }

  /* ---------- the splitter component ---------- */
  function makeSplitter(el, o) {
    function paint() { el.setAttribute("aria-valuenow", String(Math.round(o.get()))); el.setAttribute("aria-valuemin", String(o.min())); el.setAttribute("aria-valuemax", String(Math.round(o.max()))); }
    function set(v, commit) { o.set(clamp(Math.round(v), o.min(), Math.max(o.min(), o.max()))); paint(); if (commit) save(); }
    el.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || (e.target.closest && e.target.closest(".sidetoggle"))) return;
      e.preventDefault(); el.focus();
      var start = o.get(), sx = e.clientX, sy = e.clientY;
      document.body.classList.add("splitting"); if (PTD.hints) PTD.hints.drag("splitter");
      function mv(ev) { set(start + (o.dir === "v" ? sx - ev.clientX : sy - ev.clientY)); }
      function done() { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); window.removeEventListener("keydown", key, true); document.body.classList.remove("splitting"); if (PTD.hints) PTD.hints.dragEnd(); }
      function up() { done(); save(); }
      function cancel() { done(); set(start); }
      function key(ev) { if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); cancel(); } }
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel); window.addEventListener("keydown", key, true);
    });
    el.addEventListener("dblclick", function (e) { if (e.target.closest && e.target.closest(".sidetoggle")) return; set(o.def, true); });
    el.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 100 : 20, grow = o.dir === "v" ? "ArrowLeft" : "ArrowUp", shrink = o.dir === "v" ? "ArrowRight" : "ArrowDown";
      if (e.key === grow) set(o.get() + step, true); else if (e.key === shrink) set(o.get() - step, true);
      else if (e.key === "Enter") set(o.def, true); else return;
      e.preventDefault(); e.stopPropagation();
    });
    return { paint: paint, set: set };
  }

  /* ---------- apply ---------- */
  function apply() {
    var l = lay();
    app.style.setProperty("--sidew", l.sideW + "px");
    app.classList.toggle("sidefold", !l.sideOpen);
    var tg = document.getElementById("sideToggle"); if (tg) { tg.textContent = l.sideOpen ? "⟩" : "⟨"; tg.setAttribute("aria-pressed", String(!l.sideOpen)); }
    col.style.setProperty("--dockh", l.dockH + "px");
    if (L.vs) L.vs.paint(); if (L.hs) L.hs.paint();
  }
  L.apply = apply;
  L.dock.isOpen = function () { return !dock.hidden; };
  function showDock(on) {
    dock.hidden = !on; hs.hidden = !on || maxed;
    col.classList.toggle("dockopen", on); col.classList.toggle("dockmax", on && maxed);
    if (!on) maxed = false;
    if (L.hs) L.hs.paint();
    window.dispatchEvent(new Event("resize"));
  }
  L.dock.open = function (title) { if (title) document.getElementById("dockTitle").textContent = title; userClosed = false; showDock(true); };
  L.dock.close = function () { showDock(false); };
  L.dock.body = function () { return document.getElementById("dockBody"); };
  L.dock.maximise = function (on) { maxed = on == null ? !maxed : !!on; col.classList.toggle("dockmax", !dock.hidden && maxed); hs.hidden = dock.hidden || maxed; window.dispatchEvent(new Event("resize")); };
  /* Called after every panel render: opens the dock when it is wanted (once), closes it when it no longer is. */
  L.update = function () {
    if (!dock) return;
    var w = !!L.dock.want();
    if (w && !lastWant) { if (!userClosed) L.dock.open(); }
    else if (!w && lastWant) { userClosed = false; if (L.dock.isOpen()) showDock(false); }
    lastWant = w;
  };
  L.reset = function () { var d = { sideW: 430, sideOpen: true, dockH: 300 }; Object.assign(lay(), d); apply(); save(); };
  L.toggleSide = function (on) { var l = lay(); l.sideOpen = on == null ? !l.sideOpen : !!on; apply(); save(); window.dispatchEvent(new Event("resize")); };

  function init() {
    app = document.querySelector(".app"); col = document.querySelector(".stagecol"); dock = document.getElementById("graphDock");
    hs = document.getElementById("hSplit"); vs = document.getElementById("vSplit"); side = document.getElementById("controls");
    if (!app || !dock) return;
    L.vs = makeSplitter(vs, { dir: "v", def: 430, get: function () { return lay().sideW; }, set: function (v) { lay().sideW = v; lay().sideOpen = true; apply(); }, min: function () { return 240; }, max: function () { return Math.min(1400, app.clientWidth - 340); } });
    L.hs = makeSplitter(hs, { dir: "h", def: 300, get: function () { return lay().dockH; }, set: function (v) { lay().dockH = v; apply(); }, min: function () { return 120; }, max: function () { return Math.min(1400, col.clientHeight - 200); } });
    document.getElementById("sideToggle").addEventListener("click", function () { L.toggleSide(); });
    document.getElementById("dockClose").addEventListener("click", function () { userClosed = true; showDock(false); });
    document.getElementById("dockMax").addEventListener("click", function () { L.dock.maximise(); });
    document.getElementById("graphDock").querySelector(".dockbar").addEventListener("dblclick", function (e) { if (!e.target.closest("button")) L.dock.maximise(); });
    document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-lay=reset]"); if (b) L.reset(); });
    apply();
  }
  L.init = init;
  PTD.layout = L;
})(window.PTD = window.PTD || {});
