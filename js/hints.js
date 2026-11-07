/* Operation hints (REQ-014): one line under the stage that says what is happening and which extra keys work.
 * The wordings are data (DATA below). Every drag and tool of the program has an id here, and tests/e2e-drags.js fails when one
 * has no hint. A hint may only list a key that really does something in that operation; the tests press the keys.
 * The line is shown while a drag runs, while a tool is active and while the pointer rests on a handle. */
(function (PTD) {
  "use strict";
  var NOSNAP = { mods: ["alt", "ctrl"], label: "Alt or Ctrl", text: "no snapping" };
  var ESC = { label: "Esc", text: "cancel" };
  var DATA = {
    /* drags */
    "move": { what: "Drag to move.", keys: [NOSNAP, ESC] },
    "move-all": { what: "Drag to move all the artwork.", keys: [ESC] },
    "marquee": { what: "Drag to select everything inside the box.", keys: [{ mods: ["shift", "ctrl"], label: "Shift or Ctrl", text: "add to the selection" }, ESC] },
    "table-move": { what: "Drag to move the table.", keys: [NOSNAP, ESC] },
    "table-node": { what: "Drag the node to reshape the outline.", keys: [NOSNAP, ESC] },
    "table-bulge": { what: "Drag to curve this edge.", keys: [ESC] },
    "guide": { what: "Drag to move the guide.", keys: [NOSNAP, ESC] },
    "cpoint": { what: "Drag to move the control point. Drop it on another point to hang it there.", keys: [NOSNAP, ESC] },
    "meas-offset": { what: "Drag to move the dimension line sideways.", keys: [ESC] },
    "meas-end": { what: "Drag the end to another snap point.", keys: [NOSNAP, ESC] },
    "meas-ref": { what: "Drag to choose the centre, the inner edge or the outer edge of the line.", keys: [ESC] },
    "text-scale": { what: "Drag a handle to scale the text. The opposite side stays in place.", keys: [{ mods: ["shift"], label: "Shift", text: "scale from the centre" }, NOSNAP, ESC] },
    "align-handle": { what: "Drag the handle onto a point or a line of the target.", keys: [{ mods: ["alt"], label: "Alt", text: "each object by itself" }, ESC] },
    "align-marquee": { what: "Drag to select objects.", keys: [{ mods: ["shift"], label: "Shift", text: "add" }, { mods: ["ctrl"], label: "Ctrl", text: "remove" }, { label: "Esc", text: "end the align mode" }] },
    "pan": { what: "Drag to pan the view.", keys: [] },
    "scrub": { what: "Drag sideways to change the value.", keys: [{ mods: ["shift"], label: "Shift", text: "ten times coarser" }, { mods: ["alt"], label: "Alt", text: "ten times finer" }] },
    /* tools */
    "align-zone": { what: "Click to move the objects to the shown place.", keys: [{ mods: ["alt"], label: "Alt", text: "each object by itself" }, { label: "Enter", text: "apply" }, { label: "Esc", text: "end the align mode" }] },
    "tool-dim": { what: "Click to place the measurement.", keys: [{ label: "Tab", text: "next snap point" }, NOSNAP, { label: "Esc", text: "end the tool" }] },
    "tool-measure": { what: "Click two points to measure.", keys: [{ label: "Tab", text: "next snap point" }, { label: "Enter", text: "pin the measurement" }, NOSNAP, { label: "Esc", text: "end the tool" }] },
    "tool-cpoint": { what: "Click a text, a control point or an empty place to hang a new point on it.", keys: [{ label: "Esc", text: "end the tool" }] },
    "tool-align": { what: "Click objects to select them, then set an alignment target.", keys: [{ mods: ["shift"], label: "Shift", text: "add" }, { mods: ["ctrl"], label: "Ctrl", text: "remove" }, { label: "Esc", text: "end the align mode" }] },
    "tool-clone": { what: "Click to put the clones where the ghost is.", keys: [{ mods: ["shift"], label: "Shift", text: "put them and stay in this mode" }, NOSNAP, { label: "Esc", text: "cancel" }] },
    "tool-guide": { what: "Click to place the guide.", keys: [{ mods: ["alt"], label: "Alt", text: "no snapping" }, { label: "Esc", text: "cancel" }] }
  };
  var TOOL_HINT = { dim: "tool-dim", measure: "tool-measure", cpoint: "tool-cpoint", align: "tool-align", guideX: "tool-guide", guideY: "tool-guide", clonehere: "tool-clone" };
  var st = { tool: null, drag: null, hover: null, mods: { shift: false, alt: false, ctrl: false } };
  var H = { data: DATA };

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function line() { return document.getElementById("opHint"); }
  function current() { return st.drag || st.hover || st.tool || null; }
  function paintMods() {
    var n = line(); if (!n) return;
    Array.prototype.forEach.call(n.querySelectorAll(".k[data-mods]"), function (k) {
      var held = k.getAttribute("data-mods").split(" ").some(function (m) { return st.mods[m]; });
      k.classList.toggle("held", held);
    });
  }
  function render() {
    var n = line(); if (!n) return;
    var id = current(), d = id ? DATA[id] : null;
    if (!d) { n.innerHTML = ""; n.removeAttribute("data-op"); return; }
    n.setAttribute("data-op", id);
    n.innerHTML = '<span class="what">' + esc(d.what) + "</span>" + (d.keys.length ? '<span class="keys">' + d.keys.map(function (k) {
      return '<span class="k"' + (k.mods ? ' data-mods="' + k.mods.join(" ") + '"' : "") + "><kbd>" + esc(k.label) + "</kbd> " + esc(k.text) + "</span>";
    }).join("") + "</span>" : "");
    paintMods();
  }
  H.ids = function () { return Object.keys(DATA); };
  H.get = function (id) { return DATA[id] || null; };
  H.shown = function () { return current(); };
  H.hovered = function () { return st.hover; };
  H.tool = function (name) { st.tool = TOOL_HINT[name] || null; render(); };
  H.drag = function (id) { st.drag = DATA[id] ? id : null; if (st.drag) st.hover = null; render(); };
  H.dragEnd = function () { st.drag = null; render(); };
  H.hover = function (id) { var v = id && DATA[id] ? id : null; if (v === st.hover) return; st.hover = v; render(); };
  function onKey(e) {
    var m = st.mods, before = m.shift + "" + m.alt + "" + m.ctrl;
    m.shift = !!e.shiftKey; m.alt = !!e.altKey; m.ctrl = !!(e.ctrlKey || e.metaKey);
    if (before !== m.shift + "" + m.alt + "" + m.ctrl) paintMods();
  }
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKey, true);
  window.addEventListener("blur", function () { st.mods.shift = st.mods.alt = st.mods.ctrl = false; paintMods(); });
  PTD.hints = H;
})(window.PTD = window.PTD || {});
