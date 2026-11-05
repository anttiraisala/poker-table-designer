/* Help: a tooltip on every button, a help window (F1 or the Help button, opens at the topic of the current tab or tool) and
 * examples that play a real action slowly on the stage with a pointer, so that the user sees how it is done.
 * Examples press the real controls and send real pointer events to the stage; nothing is faked. Any key or click stops one. */
(function (PTD) {
  "use strict";
  var Hp = { speed: 1 };
  var C = function () { return PTD.core; };

  /* ---------- tooltips ---------- */
  var TIPS = {
    "madd:points": "Add a measurement between two points (any direction). Click two snap points; a dashed ghost shows the result first.",
    "madd:h": "Add a horizontal measurement between two points.",
    "madd:v": "Add a vertical measurement between two points.",
    "madd:rayc": "Add a ray measurement: from a start point towards the table centre to the first line it reaches.",
    "madd:raya": "Add a ray measurement along an axis (up, down, left or right) to the first line it reaches.",
    "madd:near": "Add the shortest distance between two lines or texts.",
    "madd:span": "Add the distance along a guide between two of its crossings.",
    madd: "Start adding a measurement of this kind.",
    mhelp: "Open the help about measurements (F1).",
    mexample: "Generate example: the program adds a random measurement for you, slowly, so you can watch how it is done. Undo removes it.",
    mdel: "Delete this measurement.", msel: "Select this measurement on the canvas.",
    jsonopen: "Show this part of the project as JSON text that you can copy, edit and apply.",
    tadd: "Add a new table outline.", tdel: "Delete this table.", tselect: "Select this table on the canvas.",
    tpreset: "Change the table shape type (stadium, rectangle, octagon, circle).", tconvert: "Convert the table shape exactly, keeping its outline and settings.",
    tnodesel: "Select this node of the outline.", tnodedel: "Delete the selected node.", tnodeadd: "Add a node in the middle of the selected segment.",
    tflipx: "Mirror the table left to right.", tflipy: "Mirror the table top to bottom.", trot: "Turn the table by 90 degrees.", tcentre: "Move the table so its centre is on the cloth centre.",
    gadd: "Add a guide line.", gdel: "Delete this guide.", cadd: "Add a constraint between guides.", cdel: "Delete this constraint.",
    cequalmore: "Equal spacing: allow the gaps to be larger.", cequalless: "Equal spacing: allow the gaps to be smaller.",
    pick: "Select this on the canvas.", toggle: "Open or close this panel.", eye: "Show or hide this on the canvas and in exports.",
    front: "Bring this text in front of the others.", back: "Send this text behind the others.", del: "Delete this.",
    freeze: "Turn the text into fixed outlines (no font needed any more).", unfreeze: "Return the frozen text to a live text.",
    bandup: "Move the lines and cards above the next layer.", banddown: "Move the lines and cards below the previous layer.",
    royal: "Set the poker hand to a royal flush.", random: "Set a random poker hand.", potseed: "Make a new random chip pile.", muckseed: "Make a new random muck.", playseed: "Deal new random players.",
    placeorigin: "Put the artwork origin at the chosen distance from the dealer edge.",
    fav: "Add or remove this font from your favourites.", fontfile: "Load a font file for this font.", fontimport: "Import a font from a TTF or OTF file.",
    fontremove: "Remove this imported font.", fontporcelain: "Add the Porcelain font that comes with the program.", fontmenu: "Show fonts.",
    paladd: "Add a colour to the palette.", paldel: "Delete this colour (only when nothing uses it).", palreset: "Restore the built-in colours.",
    randstart: "Start the randomizer: it changes the design every few seconds.", randstop: "Stop the randomizer.", randonce: "Run one randomizer round.", randcreate: "Invent a casino name with helper texts.",
    wordsave: "Save the word list to a file.", wordopen: "Open a word list from a file.", wordreset: "Go back to the shipped word list.",
    cutsvg: "Download the cut file (SVG) for the vinyl cutter.", pngexport: "Download a picture (PNG) of the design.", blender: "Download the Blender script.", blenderpreview: "Show a top view of what Blender will build.",
    sheetview: "Show the layout sheet (marking guide) here.", sheetsvg: "Download the layout sheet as SVG.", sheethtml: "Download the layout sheet as a web page.",
    psave: "Save the whole project to a file (Ctrl+S).", popen: "Open a project file into this tab.", pnew: "Start a new project in a new tab.", partsave: "Save this part to a file.", partopen: "Open this part from a file.",
    pload: "Load the pasted text as what it is (project, settings or old logo-editor file).", ptext: "Show the current project as text.", papply: "Apply the text above as a project.",
    csave: "Save the settings (cutter, units, favourites ...) to a file.", copen: "Open a settings file.", creset: "Reset all settings to the shipped values.",
    calibdl: "Download a zip with the calibration test strips (SVG, PNG and JPG).",
    select: "Select this."
  };
  var TIPS_ID = {
    addText: "Add a new text to the artwork.", newBtn: "Start a new project in a new tab.", openBtn: "Open a project file.", pasteBtn: "Paste a project or settings text.",
    saveBtn: "Save the project to a file.", cloneBtn: "Make a copy of the selected text.", outlineBtn: "Turn the outline (halo) of the selected text on or off.",
    placeOriginBtn: "Put the artwork origin at the chosen distance from the dealer edge.", helpBtn: "Open the help window (F1).", pinBtn: "Keep the measurement on the canvas as a lasting measurement (Enter).",
    undoBtn: "Undo (Ctrl+Z).", redoBtn: "Redo (Ctrl+Y)."
  };
  var TIPS_TAB = { artwork: "Texts, the lines and the poker hand.", tables: "Table outlines, rail and the player-area line.", guides: "Guide lines, constraints and lasting measurements.", colours: "The palette: every colour of the design.", fonts: "Fonts and favourites.", random: "The randomizer and the casino-name words.", export: "Cut file, picture, layout sheet and Blender.", project: "Save and open projects.", settings: "Settings shared by all projects: cutter, calibration images, settings file." };
  var TIPS_SAVE = { project: "Save everything.", artwork: "Save only the artwork.", tables: "Save only the tables, guides and constraints." };
  var TIPS_TOOL = { select: "Select and move (Esc).", measure: "Measure the distance between two points (Tab cycles the snap points, Pin keeps the result).", guideX: "Click the canvas to place a vertical guide.", guideY: "Click the canvas to place a horizontal guide." };

  function tipFor(n) {
    var d = n.dataset || {}, k = d.act ? (d.k ? TIPS[d.act + ":" + d.k] : null) || TIPS[d.act] : null;
    if (!k && n.id && TIPS_ID[n.id]) k = TIPS_ID[n.id];
    if (!k && d.tab) k = TIPS_TAB[d.tab];
    if (!k && d.save) k = TIPS_SAVE[d.save];
    if (!k && d.tool) k = TIPS_TOOL[d.tool];
    if (!k && n.tagName === "SELECT") { var lb = n.closest("label"), sp = lb && lb.querySelector("span"); k = n.getAttribute("aria-label") || (sp && sp.textContent.trim()) || ""; }
    if (!k) { var t = (n.getAttribute("aria-label") || n.textContent || "").replace(/\s+/g, " ").trim(); if (t) k = t; }
    return k || "";
  }
  /* Gives every button (and switch or choice) without a title one. Existing titles are kept. */
  Hp.applyTips = function (root) {
    (root || document).querySelectorAll("button, select, label.chk, [role=button], [role=tab], [role=menuitem]").forEach(function (n) {
      if (n.getAttribute("title")) return;
      var t = tipFor(n); if (t) n.setAttribute("title", t);
    });
  };
  Hp.untitled = function () {
    var out = [];
    document.querySelectorAll("button, select, label.chk, [role=button], [role=tab], [role=menuitem]").forEach(function (n) { if (!n.getAttribute("title")) out.push(n.id || n.dataset.act || n.textContent.trim().slice(0, 30)); });
    return out;
  };

  /* ---------- the help window ---------- */
  var TOPICS = [
    { id: "start", title: "Getting started", body: [
      "Poker Table Designer draws the pattern for a poker table cloth in real millimetres: texts, lines and cards on a cloth, checked against one or more table outlines, and exports it for a vinyl cutter, as a picture and as a Blender scene.",
      "The canvas is on the left and the panels are on the right, in tabs. Every button has a tooltip: rest the pointer on it. Press F1 at any time for help about what you are doing.",
      "Zoom with the mouse wheel. Pan with the right mouse button, or hold Space and drag. Undo is Ctrl+Z and redo is Ctrl+Y. The browser keeps an automatic copy of every project tab."] },
    { id: "artwork", title: "Artwork and texts", body: [
      "Add text adds a text. Click a text on the canvas to select it and drag it; the arrow keys nudge it (Shift for 10 mm). Each text has a font, a size in millimetres, a colour and an optional outline (halo) that hides what lies below it.",
      "Freeze turns a text into fixed outlines so it no longer needs its font. The lines and cards panel sets the two card lines, the poker hand, the pot, the burn cards and the muck.",
      "Positions are measured from the artwork origin, a free point on the cloth (the pink diamond). The Place at button puts it a chosen distance from the dealer edge once; it never moves by itself."] },
    { id: "tables", title: "Tables", body: [
      "Add as many table outlines as you like (stadium, rectangle, octagon, circle, with an optional dealer notch). Each has a rail ring and a player-area line. Drag a node to make the outline free; the convert buttons change a shape exactly.",
      "The table that is highest in the list is the topmost one and the only one that shows players when several tables are visible."] },
    { id: "guides", title: "Guides and constraints", body: [
      "A guide is a vertical or horizontal reference line. Use Guide | or Guide — in the toolbar and click the canvas, or Add in the Guides panel. Guides snap to table points; drag one to move it.",
      "Constraints keep guides at a distance, equal spacing, symmetric or in a ratio. The solver names the constraints that conflict."],
      example: { label: "Show me: place a guide", id: "guide" } },
    { id: "measure", title: "Measurements", body: [
      "A measurement is a lasting, visible distance between two things. It is attached to named objects (a table node, a line end, the edge of a thick line, a text extreme, a crossing ...) so it follows them when they move. It is never cut.",
      "In the Guides and measurements tab choose a kind and click on the canvas. While you move, a dashed ghost shows the value a click would add and the snap kind is named at the pointer. Tab cycles through the snap points at the pointer; hold Alt or Ctrl to place a free point.",
      "Kinds: point to point (any direction, horizontal, vertical), ray (towards the table centre or along an axis to the first line it hits), shortest distance between two lines or texts, and distance along a guide between two crossings.",
      "Snap kinds: end, middle, centre, intersection, quadrant and tangent of an arc, perpendicular foot, nearest point, and for thick lines the line centre, inner edge and outer edge.",
      "Click a measurement to select it. Drag its number to move the dimension line, drag an end to attach it elsewhere, press Delete to remove it. The Measurements switch in the toolbar hides them all."],
      examples: [["Point to point", "points"], ["Horizontal", "h"], ["Vertical", "v"], ["Ray to the table centre", "rayc"], ["Ray along an axis", "raya"], ["Shortest distance", "near"], ["Along a guide", "span"], ["Measure tool and Pin", "pin"]] },
    { id: "measuretool", title: "The Measure tool and Pin", body: [
      "The Measure tool in the toolbar is a quick ruler: click two points and the distance appears. It uses the same snap points as the lasting measurements.",
      "When the second point is set, Pin (or Enter) keeps the result as a lasting measurement attached to the same points."],
      example: { label: "Show me: measure and pin", id: "pin" } },
    { id: "colours", title: "Colours", body: ["Every colour in the design comes from the palette. One cut layer is made per colour. Rename or change a colour and everything that uses it follows."] },
    { id: "fonts", title: "Fonts", body: ["Fonts come from Google Fonts by name or from a TTF or OTF file you import. A project that uses an imported font embeds it. If a font is missing, a fallback is shown and you can load the font file. Favourites are kept in the settings."] },
    { id: "random", title: "The randomizer", body: [
      "The randomizer shuffles fonts, sizes and layout of the existing texts on a timer and can invent a casino name with helper texts. Every round is its own undo step, so you can step through a stopped run with Undo and Redo.",
      "Each property of the table has Vary (changes at random every round) and Set (always this value)."] },
    { id: "export", title: "Export", body: [
      "Cut file (SVG): one layer per colour, halos become holes, tolerance, mirror, rotation, correction factors and strips split to the cutter width. The poker hand, pot, cards and players are design aids and are never cut.",
      "Picture (PNG) of the design, the layout sheet (a marking guide measured from the centre), and a Blender script that builds the table and the cloth texture."] },
    { id: "project", title: "Projects and tabs", body: [
      "Every project is a tab above the canvas with its own undo history. New project always opens a new tab. Save writes the project to a file (Ctrl+S); Open merges a file into the current tab. Save also offers Artwork only and Tables only."] },
    { id: "settings", title: "Settings and calibration images", body: [
      "The Settings tab holds what all projects share and is not part of any project file: units, snapping, the cutter, favourite fonts, your own universal words. Save, Open and Reset settings work on the settings file.",
      "Calibration images makes a zip with a test strip (a 10 mm bar with 10 x 10 mm blocks every 20 mm and a 15 x 5 mm foot every 100 mm), horizontal and vertical, as SVG and as black and white PNG and JPG at 300 and 254 dpi. Cut it, measure it and compare with the nominal length to find the cutter's scale error."] },
    { id: "keys", title: "Keyboard and mouse", body: [
      "F1 help. Esc cancels the tool and deselects. Ctrl+Z undo, Ctrl+Y or Ctrl+Shift+Z redo, Ctrl+A select all texts, Ctrl+S save the project.",
      "Arrow keys nudge the selection (Shift: 10 mm). Delete removes the selected measurement or guide. Tab cycles through snap points while placing a measurement. Enter pins a finished temporary measurement.",
      "Mouse wheel zooms. Right button or Space plus drag pans. Alt or Ctrl while placing or dragging switches snapping off."] }
  ];
  Hp.topics = TOPICS;
  var box = null, cur = "start";
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function build() {
    if (box) return box;
    box = document.createElement("div"); box.id = "helpBox"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Help");
    box.innerHTML = '<div class="hwin"><div class="hbar"><strong>Help</strong><button type="button" class="tbtn" id="helpClose" title="Close the help (Esc)">Close</button></div><div class="hcols"><nav id="helpNav" aria-label="Help topics"></nav><div id="helpBody"></div></div></div>';
    document.body.appendChild(box);
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.id === "helpClose") { Hp.close(); return; }
      var t = e.target.closest("[data-topic]"); if (t) { Hp.open(t.dataset.topic); return; }
      var x = e.target.closest("[data-example]"); if (x) { Hp.close(); Hp.example(x.dataset.example); }
    });
    return box;
  }
  function draw() {
    document.getElementById("helpNav").innerHTML = TOPICS.map(function (t) { return '<button type="button" data-topic="' + t.id + '" class="' + (t.id === cur ? "on" : "") + '" title="' + esc(t.title) + '">' + esc(t.title) + '</button>'; }).join("");
    var t = TOPICS.filter(function (x) { return x.id === cur; })[0] || TOPICS[0], h = '<h2>' + esc(t.title) + '</h2>' + t.body.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join("");
    if (t.example) h += '<p><button type="button" class="btn gold" data-example="' + t.example.id + '" title="The program does it for you, slowly, on the canvas. Undo removes the result.">' + esc(t.example.label) + '</button></p>';
    if (t.examples) h += '<p class="small">Show me (the program does it for you, slowly, on the canvas; Undo removes the result):</p><p>' + t.examples.map(function (e) { return '<button type="button" class="btn" data-example="' + e[1] + '" title="Play an example: ' + esc(e[0]) + '">' + esc(e[0]) + '</button>'; }).join(" ") + '</p>';
    document.getElementById("helpBody").innerHTML = h;
  }
  Hp.open = function (id) { build(); if (id) cur = id; draw(); box.hidden = false; Hp.applyTips(box); var b = document.getElementById("helpClose"); if (b) b.focus(); };
  Hp.close = function () { if (box) box.hidden = true; };
  Hp.isOpen = function () { return !!box && !box.hidden; };
  Hp.contextTopic = function () {
    var u = C().ui;
    if (u.tool === "dim") return "measure"; if (u.tool === "measure") return "measuretool"; if (u.tool === "guideX" || u.tool === "guideY") return "guides";
    return { artwork: "artwork", tables: "tables", guides: "measure", colours: "colours", fonts: "fonts", random: "random", export: "export", project: "project", settings: "settings" }[u.tab] || "start";
  };

  /* ---------- examples ---------- */
  var run = null, ptr = null;
  function stagePt(wx, wy) { var r = document.getElementById("stage").getBoundingClientRect(), v = C().ui.view; return { x: r.left + r.width / 2 + (wx - v.cx) * v.z, y: r.top + r.height / 2 + (wy - v.cy) * v.z }; }
  function showPtr(x, y) {
    if (!ptr) { ptr = document.createElement("div"); ptr.id = "demoPtr"; ptr.setAttribute("aria-hidden", "true"); ptr.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M2 2 L2 24 L8 18 L13 28 L17 26 L12 16 L21 16 Z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg><span></span>'; document.body.appendChild(ptr); }
    ptr.hidden = false; ptr.style.left = x + "px"; ptr.style.top = y + "px";
  }
  function sayDemo(t) { if (!ptr) return; ptr.querySelector("span").textContent = t || ""; }
  function fire(type, x, y) {
    var s = document.getElementById("stage"), o = { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: type === "pointerdown" ? 1 : 0, isPrimary: true };
    try { s.dispatchEvent(new PointerEvent(type, o)); } catch (e) { /* the page keeps working if an event cannot be sent */ }
  }
  Hp.running = function () { return !!run; };
  Hp.stop = function (msg) {
    if (!run) return;
    clearTimeout(run.timer); run = null;
    if (ptr) ptr.hidden = true;
    var u = C().ui; if (u.tool === "dim") { PTD.measure.cancel(); }
    if (u.tool !== "select") { var sb = document.querySelector('[data-tool="select"]'); if (sb) sb.click(); }
    if (msg) C().say(msg);
  };
  function wait(ms, fn) { run.timer = setTimeout(function () { if (run) fn(); }, ms * Hp.speed); }
  /* Plays the steps one after the other: move the pointer there, pause, click. */
  function play(sc, after) {
    var core = C(), steps = sc.steps.slice(), pos = stagePt(core.ui.view.cx, core.ui.view.cy);
    function next() {
      if (!run) return;
      var s = steps.shift();
      if (!s) { wait(500, function () { var ok = after ? after() : true; Hp.stop(); if (ok !== false) core.say("That was an example. Undo (Ctrl+Z) removes it."); }); return; }
      var to = s.button ? (function () { var r = document.getElementById(s.button).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })() : stagePt(s.x, s.y);
      sayDemo(s.say || ""); if (s.say) core.say(s.say);
      var n = Hp.speed < 0.2 ? 1 : 16, i = 0, from = pos;
      (function frame() {
        if (!run) return;
        i++; var f = i / n, e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        var x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e;
        showPtr(x, y); if (!s.button) fire("pointermove", x, y);
        if (i < n) { run.timer = setTimeout(function () { if (run) frame(); }, 45 * Hp.speed); return; }
        pos = to;
        wait(650, function () {
          if (s.button) document.getElementById(s.button).click();
          else if (s.click) { fire("pointerdown", to.x, to.y); fire("pointerup", to.x, to.y); }
          wait(450, next);
        });
      })();
    }
    next();
  }
  /* id: a measurement kind (points, h, v, rayc, raya, near, span), "pin" or "guide". */
  Hp.example = function (id) {
    var core = C(), M = PTD.measure, ui = core.ui;
    Hp.stop(); Hp.close();
    if (core.ui.dim) M.cancel();
    var sc, count0 = (core.state().measures || []).length, guides0 = core.state().guides.length, after = null;
    if (id === "guide") {
      var vis = PTD.tables.visible()[0];
      var half = vis ? 200 : 100, ax = Math.random() < 0.5 ? "guideX" : "guideY", v = Math.round((Math.random() * 2 - 1) * half);
      var p = ax === "guideX" ? [v, ui.view.cy] : [ui.view.cx, v];
      sc = { steps: [{ x: p[0], y: p[1], click: true, say: "Click the canvas to place the guide" }], setupTool: ax };
      after = function () { return core.state().guides.length > guides0 || (core.say("The guide was not placed."), false); };
    } else if (id === "pin") { sc = M.examplePin(); after = function () { return (core.state().measures || []).length > count0 || (core.say("The example did not complete. Try again."), false); }; }
    else { sc = M.exampleSteps(id); after = function () { return (core.state().measures || []).length > count0 || (core.say("The example did not complete. Try again."), false); }; }
    if (!sc || sc.error) { core.say(sc ? sc.error : "No example for this."); return false; }
    core.setTab("guides");
    run = { timer: null };
    if (sc.setup) sc.setup();
    if (sc.setupTool) { var tb = document.querySelector('[data-tool="' + sc.setupTool + '"]'); if (tb) tb.click(); }
    showPtr(stagePt(ui.view.cx, ui.view.cy).x, stagePt(ui.view.cx, ui.view.cy).y);
    play(sc, function () { var ok = after(); var tb = document.querySelector('[data-tool="select"]'); if (tb) tb.click(); return ok; });
    return true;
  };
  /* A tool example: a random one of the measurement kinds that works with what is in view. */
  Hp.randomExample = function (preferred) {
    var kinds = ["points", "h", "v", "rayc", "raya", "near", "span"], order = [];
    if (preferred && kinds.indexOf(preferred) >= 0) order.push(preferred);
    kinds.sort(function () { return Math.random() - 0.5; }).forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); });
    for (var i = 0; i < order.length; i++) { var sc = PTD.measure.exampleSteps(order[i]); if (!sc.error) { Hp.example(order[i]); return order[i]; } if (order[i] === preferred) { C().say(sc.error); return null; } }
    C().say("Nothing to measure in view. Zoom out or add a table first."); return null;
  };

  /* ---------- wiring ---------- */
  Hp.init = function () {
    document.addEventListener("keydown", function (e) {
      if (e.key === "F1") { e.preventDefault(); if (Hp.isOpen()) Hp.close(); else Hp.open(Hp.contextTopic()); return; }
      if (Hp.isOpen() && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); Hp.close(); return; }
      if (run && e.isTrusted) { Hp.stop("Example stopped."); }
    }, true);
    var st = document.getElementById("stage");
    if (st) ["pointerdown", "pointermove"].forEach(function (t) { st.addEventListener(t, function (e) { if (run && e.isTrusted) { e.stopImmediatePropagation(); if (t === "pointerdown") Hp.stop("Example stopped."); } }, true); });
    var hb = document.getElementById("helpBtn"); if (hb) hb.onclick = function () { Hp.open(Hp.contextTopic()); };
    Hp.applyTips();
  };
  PTD.help = Hp;
})(window.PTD = window.PTD || {});
