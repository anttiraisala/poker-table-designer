/* JSON window: shows the whole project as text (tables, texts, guides, palette, export settings) so it can
 * be copied, edited or replaced by pasted text. Apply uses it, OK uses it and closes, Cancel only closes. */
(function (PTD) {
  "use strict";
  var J = {}, dlg = null, ta = null, msgEl = null;
  var C = function () { return PTD.core; };

  function say(t) { if (msgEl) msgEl.textContent = t || ""; }
  var part = "project";
  var HINTS = {
    project: "The whole project as text: tables, texts, guides, constraints, palette and export settings. ",
    artwork: "The artwork as text: texts, lines, cards, cloth, colours and fonts used. Applying it leaves the tables, guides and constraints as they are. ",
    tables: "The tables as text: outlines, player-area lines, guides, constraints and colours used. Applying it leaves the artwork as it is. "
  };
  function refresh() { ta.value = JSON.stringify(C().toPartJSON(part, false), null, 1); }
  function build() {
    dlg = document.createElement("div");
    dlg.className = "modal"; dlg.id = "jsonDlg"; dlg.hidden = true;
    dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-label", "Project JSON");
    dlg.innerHTML = '<div class="card"><div class="bar">' +
      '<button class="btn" type="button" data-j="copy">Copy to clipboard</button>' +
      '<button class="btn" type="button" data-j="paste">Paste from clipboard</button>' +
      '<button class="btn" type="button" data-j="apply">Apply</button>' +
      '<button class="btn" type="button" data-j="ok">OK</button>' +
      '<button class="btn" type="button" data-j="cancel">Cancel</button></div>' +
      '<p class="jsonhint" id="jsonHint"></p>' +
      '<textarea id="jsonText" spellcheck="false" aria-label="Project JSON text"></textarea><div class="jsonmsg" id="jsonMsg" aria-live="polite"></div></div>';
    document.body.appendChild(dlg);
    ta = dlg.querySelector("#jsonText"); msgEl = dlg.querySelector("#jsonMsg");
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) { J.close(); return; }
      var b = e.target.closest("[data-j]"); if (!b) return;
      var k = b.dataset.j;
      if (k === "copy") J.copy(); else if (k === "paste") J.paste();
      else if (k === "apply") J.apply(); else if (k === "ok") { if (J.apply()) J.close(); }
      else if (k === "cancel") J.close();
    });
    /* A JSON file can be dragged onto the window. It fills the text box; Apply or OK uses it. */
    function hasFiles(e) { var t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, "Files") >= 0; }
    ["dragenter", "dragover"].forEach(function (ev) {
      dlg.addEventListener(ev, function (e) { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; dlg.classList.add("dragover"); });
    });
    dlg.addEventListener("dragleave", function (e) { if (e.target === dlg || !dlg.contains(e.relatedTarget)) dlg.classList.remove("dragover"); });
    dlg.addEventListener("drop", function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); dlg.classList.remove("dragover");
      var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onerror = function () { say("Could not read that file."); };
      rd.onload = function () { ta.value = String(rd.result); ta.scrollTop = 0; say("Loaded " + f.name + ". Press Apply or OK to use it."); };
      rd.readAsText(f);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && dlg && !dlg.hidden) { e.preventDefault(); J.close(); } });
  }
  J.open = function (p) {
    if (!dlg) build();
    part = p === "artwork" || p === "tables" ? p : "project";
    dlg.querySelector("#jsonHint").textContent = HINTS[part] + "Imported font files are listed by name only. You can also drag a JSON file onto this window. Apply loads everything the text contains and keeps the rest (Undo brings the old state back). OK applies and closes. Cancel closes without applying.";
    refresh(); say("");
    dlg.hidden = false; ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0;
  };
  J.close = function () { if (dlg) dlg.hidden = true; };
  J.isOpen = function () { return !!dlg && !dlg.hidden; };
  J.copy = function () {
    function fallback() {
      ta.focus(); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      say(ok ? "Copied to the clipboard." : "The browser did not allow copying. The text is selected: press Ctrl+C.");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { say("Copied to the clipboard."); }, fallback);
    else fallback();
  };
  J.paste = function () {
    function blocked() { ta.focus(); say("The browser did not allow reading the clipboard. Click in the box and press Ctrl+V."); }
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { ta.value = t; say("Pasted. Press Apply or OK to use it."); }, blocked);
    else blocked();
  };
  /* Returns true when the text was accepted. */
  J.apply = function () {
    var r = C().loadText(ta.value);
    say(r.msg);
    if (r.ok) refresh();
    return r.ok;
  };
  PTD.jsonbox = J;
})(window.PTD = window.PTD || {});
