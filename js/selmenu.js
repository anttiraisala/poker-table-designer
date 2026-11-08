/* Drop-downs that belong to things on the stage open a list of their own (REQ-056, like the font list of REQ-010): the arrows move through it and
 * the object shows the choice at once (an `input` event, no undo step), Enter, a click on a row or a click elsewhere keeps it (a `change` event and
 * one undo step), Esc puts the old value back. The native <select> stays the source of truth and fires the same events, so every handler works
 * unchanged. Drop-downs that rebuild their panel or are not about the stage (settings, export, table presets, cutters, ...) stay native. */
(function (PTD) {
  "use strict";
  var menu = null, sel = null, orig = null, idx = -1, rows = [];
  var NATIVE_SCOPE = /^(cfg|xp|rand|preset|origin|mref|guideref|cpparent|cards|newcons)/;
  PTD.selmenu = {
    eligible: function (el) {
      if (!el || el.tagName !== "SELECT" || el.disabled || el.multiple || el.hasAttribute("data-native")) return false;
      var d = el.dataset;
      if (d.gp != null || d.gx != null || d.pa === "goffsel") return true;                       /* the graph editor */
      if (!d.scope || d.cm || d.k) return false;
      if (NATIVE_SCOPE.test(d.scope) || d.key === "kind" || d.key === "sizeMode") return false;
      return true;
    },
    isOpen: function () { return !!sel; }
  };
  function ensure() {
    if (menu) return;
    menu = document.createElement("div"); menu.className = "fontmenu"; menu.id = "selMenu"; menu.setAttribute("role", "listbox"); menu.hidden = true;
    document.body.appendChild(menu);
    menu.addEventListener("pointerdown", function (e) {
      var r = e.target.closest(".opt"); e.preventDefault(); e.stopPropagation();
      if (!r) return;
      show(+r.dataset.i); commit();
    });
  }
  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
  function position() {
    var r = sel.getBoundingClientRect(), below = window.innerHeight - r.bottom, top = below < 220 && r.top > below;
    menu.style.left = r.left + "px"; menu.style.width = Math.max(160, r.width) + "px";
    menu.style.top = top ? "" : r.bottom + "px"; menu.style.bottom = top ? window.innerHeight - r.top + "px" : "";
    menu.style.maxHeight = Math.max(120, Math.min(320, (top ? r.top : below) - 12)) + "px";
  }
  function draw() {
    menu.innerHTML = rows.map(function (o, i) { return '<div class="opt' + (o.value === orig ? " cur" : "") + (i === idx ? " act" : "") + '" role="option" data-i="' + i + '">' + PTD.core.esc(o.text) + "</div>"; }).join("") +
      '<div class="hint" role="presentation">Arrows show the choice. Enter or a click elsewhere keeps it. Esc puts the original back.</div>';
    var a = menu.querySelector(".act"); if (a) a.scrollIntoView({ block: "nearest" });
  }
  function open(el) {
    if (sel) close();
    ensure(); sel = el; orig = el.value;
    rows = Array.prototype.map.call(el.options, function (o) { return { value: o.value, text: o.text, disabled: o.disabled }; });
    idx = Math.max(0, rows.map(function (o) { return o.value; }).indexOf(orig));
    PTD.core.groupBegin();
    menu.hidden = false; position(); draw();
    el.focus();
  }
  function show(i) {
    if (!sel || i < 0 || i >= rows.length || rows[i].disabled) return;
    idx = i;
    if (sel.value !== rows[i].value) { sel.value = rows[i].value; fire(sel, "input"); }
    if (sel && menu) draw();
  }
  function close() { if (menu) menu.hidden = true; sel = null; rows = []; }
  function commit() {
    var el = sel; if (!el) return;
    var changed = el.value !== orig; close();
    if (changed && document.contains(el)) fire(el, "change");
    PTD.core.groupEnd();
  }
  function cancel() {
    var el = sel; if (!el) return;
    var changed = el.value !== orig; close();
    if (changed && document.contains(el)) { el.value = orig; fire(el, "input"); fire(el, "change"); }
    PTD.core.groupEnd();
  }
  document.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    if (sel) {
      if (menu.contains(e.target)) return;
      if (e.target === sel) { e.preventDefault(); e.stopPropagation(); cancelKeep(); return; }
      commit(); return;
    }
    var el = e.target.closest ? e.target.closest("select") : null;
    if (el && PTD.selmenu.eligible(el)) { e.preventDefault(); e.stopPropagation(); open(el); }
  }, true);
  function cancelKeep() { commit(); }   /* a click on the select again closes the list and keeps the shown choice */
  document.addEventListener("keydown", function (e) {
    if (sel) {
      if (!document.contains(sel)) { close(); PTD.core.groupEnd(); return; }
      var k = e.key;
      if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); e.stopPropagation(); var d = k === "ArrowDown" ? 1 : -1, i = idx + d; while (i >= 0 && i < rows.length && rows[i].disabled) i += d; show(i); }
      else if (k === "Home" || k === "End") { e.preventDefault(); e.stopPropagation(); show(k === "Home" ? 0 : rows.length - 1); }
      else if (k === "Enter" || k === "Tab") { if (k === "Enter") { e.preventDefault(); e.stopPropagation(); } commit(); }
      else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); }
      else if ((e.ctrlKey || e.metaKey) && (k === "z" || k === "y")) { e.preventDefault(); e.stopPropagation(); }
      return;
    }
    var t = e.target;
    if (t && t.tagName === "SELECT" && PTD.selmenu.eligible(t) && (k2(e) === " " || k2(e) === "Enter" || (e.altKey && k2(e) === "ArrowDown"))) { e.preventDefault(); e.stopPropagation(); open(t); }
  }, true);
  function k2(e) { return e.key; }
  window.addEventListener("blur", function () { if (sel) commit(); });
  document.addEventListener("scroll", function () { if (sel && menu && !menu.hidden) position(); }, true);
})(window.PTD = window.PTD || {});
