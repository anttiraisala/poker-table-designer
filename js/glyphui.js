/* Glyph buttons and the SVG text window (REQ-033, REQ-034): add a built-in shape, paste SVG (Ctrl+V or the window), copy a glyph
 * as SVG. The glyph editor for pictures is in glyphed.js. Everything here goes through PTD.core.addGlyph. */
(function (PTD) {
  "use strict";
  var U = {}, dlg = null, ta = null, msgEl = null;
  function C() { return PTD.core; }
  function say(t) { if (C()) C().say(t); }

  /* Reads SVG text into a new glyph. Returns true when a glyph was added; says why not otherwise. */
  U.importSVG = function (text, name) {
    var r;
    try { r = PTD.glyph.fromSVG(text); } catch (e) { say("The SVG was not used: " + (e && e.message || "error")); return false; }
    C().addGlyph(r.shape, name || "SVG glyph");
    say("Added a glyph from the SVG." + (r.notes.length ? " Note: " + r.notes.join("; ") + "." : ""));
    return true;
  };
  U.addShape = function (id) {
    var r;
    try { r = PTD.glyph.fromShape(id); } catch (e) { say("The shape could not be made: " + (e && e.message || "error")); return null; }
    return C().addGlyph(r.shape, r.name);
  };
  /* Copies text to the clipboard; when the browser refuses, the SVG window opens with the text selected. */
  U.copy = function (text) {
    function fallback() { U.open(text); if (ta) { ta.focus(); ta.select(); } say("The browser did not allow copying. The SVG is in the window, selected: press Ctrl+C."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say("Copied the SVG to the clipboard."); }, fallback);
    else fallback();
  };

  function wmsg(t) { if (msgEl) msgEl.textContent = t || ""; }
  function build() {
    dlg = document.createElement("div");
    dlg.className = "modal"; dlg.id = "svgDlg"; dlg.hidden = true;
    dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-label", "SVG text");
    dlg.innerHTML = '<div class="card"><div class="bar">' +
      '<button class="btn" type="button" data-s="copy" title="Copy the SVG text to the clipboard.">Copy to clipboard</button>' +
      '<button class="btn" type="button" data-s="paste" title="Replace the text with what is on the clipboard.">Paste from clipboard</button>' +
      '<button class="btn" type="button" data-s="add" title="Make a new glyph from the SVG text in the box.">Add as glyph</button>' +
      '<button class="btn" type="button" data-s="close" title="Close this window.">Close</button></div>' +
      '<p class="jsonhint">SVG text of the selected glyph, or paste any SVG here and press Add as glyph. Only filled shapes and lines are read: lines become filled shapes, colours become one colour, white shapes count as background, text, pictures and scripts are left out.</p>' +
      '<textarea id="svgText" spellcheck="false" aria-label="SVG text"></textarea><div class="jsonmsg" id="svgMsg" aria-live="polite"></div></div>';
    document.body.appendChild(dlg);
    ta = dlg.querySelector("#svgText"); msgEl = dlg.querySelector("#svgMsg");
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) { U.close(); return; }
      var b = e.target.closest("[data-s]"); if (!b) return;
      var k = b.dataset.s;
      if (k === "copy") {
        function fb() { ta.focus(); ta.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (x) {} wmsg(ok ? "Copied to the clipboard." : "The browser did not allow copying. The text is selected: press Ctrl+C."); }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { wmsg("Copied to the clipboard."); }, fb); else fb();
      } else if (k === "paste") {
        var blocked = function () { ta.focus(); wmsg("The browser did not allow reading the clipboard. Click in the box and press Ctrl+V."); };
        if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { ta.value = t; wmsg("Pasted. Press Add as glyph to use it."); }, blocked); else blocked();
      } else if (k === "add") { if (U.importSVG(ta.value, "SVG glyph")) { wmsg("Added."); U.close(); } else wmsg("That text could not be used as a glyph (see the status line)."); }
      else if (k === "close") U.close();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && dlg && !dlg.hidden) { e.preventDefault(); U.close(); } });
  }
  /* Opens the window. `text` is shown; without it the SVG of the one selected glyph is shown (or an empty box). */
  U.open = function (text) {
    if (!dlg) build();
    var c = C(), t = text;
    if (t == null) {
      var gl = c.selectedIds().map(c.getLayer).filter(function (l) { return l && l.glyph; });
      t = gl.length === 1 ? c.glyphSVG(gl[0]) : "";
    }
    ta.value = t; wmsg(""); dlg.hidden = false; ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0;
  };
  U.close = function () { if (dlg) dlg.hidden = true; };
  U.isOpen = function () { return !!dlg && !dlg.hidden; };

  /* Wiring of the Artwork tab buttons and the paste key. */
  function init() {
    var sel = document.getElementById("glyphShape");
    if (sel) sel.innerHTML = PTD.glyph.shapeList.map(function (s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join("");
    var add = document.getElementById("glyphAddShape");
    if (add) add.addEventListener("click", function () { U.addShape(sel ? sel.value : "circle"); });
    var sv = document.getElementById("glyphSvgBtn");
    if (sv) sv.addEventListener("click", function () { U.open(null); });
    var ed = document.getElementById("glyphEdBtn");
    if (ed) ed.addEventListener("click", function () { if (PTD.glyphed) PTD.glyphed.open(); });
    /* Ctrl+V with SVG text on the clipboard (not while typing in a field) makes a glyph. */
    document.addEventListener("paste", function (e) {
      var t = e.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      var cd = e.clipboardData; if (!cd) return;
      var text = cd.getData("text/plain") || "";
      if (!/<svg[\s>]/i.test(text)) return;
      e.preventDefault();
      U.importSVG(text, "Pasted SVG");
    });
  }
  init();
  PTD.glyphui = U;
})(window.PTD = window.PTD || {});
