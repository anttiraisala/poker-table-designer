/* Help: a tooltip on every button, a help window (F1 or the Help button, opens at the topic of the current tab or tool) and
 * examples that play a real action slowly on the stage with a pointer, so that the user sees how it is done.
 * Examples press the real controls and send real pointer events to the stage; nothing is faked. Any key or click stops one. */
(function (PTD) {
  "use strict";
  var Hp = { speed: 1 };
  var C = function () { return PTD.core; };

  /* ---------- tooltips ---------- */
  var TIPS = {
    cpadd: "Switch to the Point tool: click a text, a control point or an empty place on the canvas to add a control point.",
    cpsel: "Select this control point on the canvas.",
    cpdel: "Delete this control point. The points that hang on it stay where they are.",
    cpeye: "Show or hide this control point.",
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
    collapse: "Show or hide the rest of this part.", bandtoggle: "Show or hide the settings of the lines and cards.", gadd: "Add a guide line.", gaddroll: "Add a roll guide: a guide with a blue band as wide as the cutting width of the cutter, showing where the roll lies.", gdel: "Delete this guide.", cadd: "Add a constraint between guides.", cdel: "Delete this constraint.",
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
    randstart: "Start the randomizer: it changes the design every few seconds.", randstop: "Stop the randomizer.", randonce: "Run one randomizer round.", randcreate: "Invent a casino name with helper texts.", namerestore: "Remove the texts made by a randomizer name style and show your own name texts again.",
    wordsave: "Save the word list to a file.", wordopen: "Open a word list from a file.", wordreset: "Go back to the shipped word list.",
    cutsvg: "Download the cut file (SVG) for the vinyl cutter.", pngexport: "Download a picture (PNG) of the design.", blender: "Download the Blender script.", blenderpreview: "Show a top view of what Blender will build.",
    sheetview: "Show the layout sheet (marking guide) here.", sheetsvg: "Download the layout sheet as SVG.", sheethtml: "Download the layout sheet as a web page.",
    psave: "Save the whole project to a file (Ctrl+S).", popen: "Open a project file into this tab.", pnew: "Start a new project in a new tab.", partsave: "Save this part to a file.", partopen: "Open this part from a file.",
    pload: "Load the pasted text as what it is (project, settings or old logo-editor file).", ptext: "Show the current project as text.", papply: "Apply the text above as a project.",
    csave: "Save the settings (cutter, units, favourites ...) to a file.", copen: "Open a settings file.", creset: "Reset all settings to the shipped values.",
    calibdl: "Download a zip with the calibration test strips (SVG, EPS for Roland CutStudio, PNG and JPG).",
    cutadd: "Add a new cutter to the list.", cutdup: "Make a copy of this cutter, with its calibration.", cutdel: "Delete this cutter (click twice).", cutup: "Move this cutter up in the list.", cutdown: "Move this cutter down in the list.", cutsel: "Show and edit this cutter.",
    cutsave: "Save the list of cutters to a file.", cutopen: "Open a cutters file (it replaces the list, or adds one cutter).",
    calguide: "Open the measuring guide: a drawing of the strip with numbered arrows, and the tables where you type what you measured.", calpdf: "Download the measuring guide as a PDF to print and take to the cutter. It is not to scale and not for cutting.",
    calauto: "Drop the factors and the blade offset you typed by hand and use the ones worked out from the measurements.", calreset: "Clear every measured number of this cutter: the correction goes back to factor 1.",
    xfitroll: "Scale the whole cut so that its width across the roll equals the cutting width of the cutter.", xfitpress: "Scale the whole cut down so that it fits the heat press area (uniform).", xscale1: "Go back to 100 % in both directions.",
    jobsave: "Keep the current filters (and the selection) as a named job.", jobuse: "Load the filters of this job into the export settings.", jobexp: "Export this job now.", jobdone: "Mark this job as cut (or take the mark away).", jobdel: "Delete this job.",
    select: "Select this."
  };
  var TIPS_ID = {
    addText: "Add a new text to the artwork.", newBtn: "Start a new project in a new tab.", openBtn: "Open a project file.", pasteBtn: "Paste a project or settings text.",
    saveBtn: "Save the project to a file.", cloneBtn: "Make a copy of the selected text.", outlineBtn: "Turn the outline (halo) of the selected text on or off.",
    placeOriginBtn: "Put the artwork origin at the chosen distance from the dealer edge.", helpBtn: "Open the help window (F1).", pinBtn: "Keep the measurement on the canvas as a lasting measurement (Enter).",
    undoBtn: "Undo (Ctrl+Z).", redoBtn: "Redo (Ctrl+Y).", exportAgainBtn: "Export again: presses the export button you used last once more.", exportAgainPop: "Export again: presses the export button you used last once more."
  };
  var TIPS_TAB = { artwork: "Texts, the lines and the poker hand.", tables: "Table outlines, rail and the player-area line.", guides: "Guide lines, constraints and lasting measurements.", colours: "The palette: every colour of the design.", fonts: "Fonts and favourites.", random: "The randomizer and the casino-name words.", export: "Cut file, picture, layout sheet and Blender.", project: "Save and open projects.", settings: "Settings shared by all projects: units, snapping and the settings file.", cutters: "Your cutters, their limits and their calibration." };
  var TIPS_SAVE = { project: "Save everything.", artwork: "Save only the artwork.", tables: "Save only the tables, guides and constraints." };
  var TIPS_TOOL = { select: "Select and move (Esc).", cpoint: "Click a text to hang a control point on it, or an empty place for the artwork origin. Click again for more, Esc to stop.", measure: "Measure the distance between two points (Tab cycles the snap points, Pin keeps the result).", guideX: "Click the canvas to place a vertical guide.", guideY: "Click the canvas to place a horizontal guide." };

  /* ---------- tooltips for fields (numbers, texts, check boxes, sliders, choices) ---------- */
  /* Keyed by "scope.key" (the scope without the id after the colon) and then by "key" alone. */
  var FT = {
    "cp.name": "The name of this control point.",
    "cp.dx": "Sideways distance of the point from the place it hangs on, in the direction the parent had when the point was made. It turns and scales with the parent unless switched off.",
    "cp.dy": "Vertical distance of the point from the place it hangs on (down is positive), measured like the sideways distance.",
    "cp.followRot": "When the parent is turned, the point turns around it. Untick to keep the offset fixed whatever the rotation of the parent.",
    "cp.followScale": "When the size of the parent changes (the letter size of a text, the width and height of a table), the offset grows or shrinks with it. Untick to keep the offset in millimetres.",
    "cpparent.sel": "What this control point hangs on: the cloth centre, the artwork origin, a text, a table or another control point. Changing it keeps the point where it is.",
    "layer.text": "The words of this text. Press Enter or click away to apply.",
    "layer.font": "The font of this text. Click to see the list, or type to filter it.",
    "layer.size": "Letter size of this text in millimetres (the height of the em square, roughly the capital height plus a little).",
    "layer.ls": "Extra space between the letters, in millimetres. Negative values pull the letters closer.",
    "layer.weight": "Font weight (100 thin to 900 black). Fonts that do not have the weight use the nearest one.",
    "layer.italic": "Slant the letters (a real italic if the font has one).",
    "layer.upper": "Show the whole text in capital letters.",
    "layer.cap": "Make the first letter bigger than the rest.",
    "layer.capAll": "Make the first letter of every word bigger, not only the first word.",
    "layer.capScale": "How many times bigger the first letter is.",
    "layer.rot": "Turn this text around its centre, in degrees. Positive turns clockwise.",
    "layer.opacity": "How solid the text looks in the preview, 0 to 1. It does not change the cut file.",
    "layer.gradient": "Use gold shading in the shaded preview. The cut file is not affected.",
    "layer.nameWord": "Tick when this text is a word of the casino name. The randomizer name styles (Split, Monogram) rebuild the name from the texts that are ticked.",
    "layer.outline": "Cut a clean margin (halo) around this text: whatever lies below it is removed there in the cut file and covered by the cloth colour in the preview.",
    "layer.outlineAuto": "Draw the outline in the cloth colour. Untick to choose another colour.",
    "layer.outlineW": "Width of the outline margin around the letters, in millimetres. It hides what lies below the text. The randomizer picks 0 to 4 mm; you may set up to 50.",
    "layer.x": "Horizontal position of the centre of this text, measured from the artwork origin.",
    "layer.y": "Vertical position of the baseline of this text, measured from the artwork origin (positive is down).",
    "layer.hex": "The colour value.",
    "band.show": "Show the two card lines (and the poker hand between them).",
    "band.len": "Length of each of the two card lines.",
    "band.gap": "Distance between the centre lines of the two card lines.",
    "band.thick": "Thickness of the card lines in millimetres, spread evenly on both sides of the centre line.",
    "band.outline": "Cut a clean margin around the card lines: whatever lies below them is removed there in the cut file.",
    "band.outlineAuto": "Draw the outline margin in the cloth colour. Untick to choose another colour.",
    "band.outlineW": "Width of the outline margin around the card lines, in millimetres.",
    "band.x": "Horizontal position of the card lines and the hand, measured from the artwork origin.",
    "band.y": "Vertical position of the card lines and the hand, measured from the artwork origin (positive is down).",
    "cards.show": "Show the poker hand between the card lines. It is a design aid and is never cut.",
    "cards.hand": "The cards of the hand: rank and suit, for example As Kh 10d Jc 9s (s spades, h hearts, d diamonds, c clubs).",
    "cards.cw": "Width of one card in millimetres (used when the card size is Custom).",
    "cards.ch": "Height of one card in millimetres (used when the card size is Custom).",
    "cards.fan": "How much the cards of the hand are fanned out, in degrees.",
    "cards.spacing": "Distance between the cards of the hand, in millimetres.",
    "cards.potShow": "Show a pot of chips next to the hand. A design aid; never cut.",
    "cards.potX": "Horizontal offset of the pot from the centre of the gap between the card lines.",
    "cards.potY": "Vertical offset of the pot from the centre of the gap between the card lines.",
    "cards.chipDia": "Diameter of a chip in millimetres (also used for the chips in Blender).",
    "cards.chipThick": "Thickness of a chip in millimetres (used for the chips in Blender).",
    "cards.burnShow": "Show the burn cards (face-down cards beside the pot). A design aid; never cut.",
    "cards.burnX": "Horizontal offset of the burn cards from the centre of the gap between the card lines.",
    "cards.burnY": "Vertical offset of the burn cards from the centre of the gap between the card lines.",
    "cards.muckShow": "Show the muck (folded cards). A design aid; never cut.",
    "cards.muckX": "Horizontal offset of the muck from the centre of the gap between the card lines.",
    "cards.muckY": "Vertical offset of the muck from the centre of the gap between the card lines.",
    "origin.x": "Horizontal position of the artwork origin, measured from the cloth centre. Moving it moves all artwork.",
    "origin.y": "Vertical position of the artwork origin, measured from the cloth centre (positive is down).",
    "origin.distance": "How far from the dealer edge the Place button puts the artwork origin (the arm length).",
    "origin.table": "The table whose dealer edge the origin is measured from.",
    "proj.casinoName": "The name of the casino of this project. The randomizer builds its name styles from it.",
    "cloth.real": "Show the real cloth size and the overhang around the tables.",
    "cloth.w": "Width of the real cloth.", "cloth.h": "Height of the real cloth.",
    "cloth.x": "Horizontal position of the cloth centre.", "cloth.y": "Vertical position of the cloth centre (positive is down).",
    "cfg.snap": "Snap to guides, outline points, objects and the grid while dragging. Hold Alt or Ctrl to move freely.",
    "cfg.dimOutside": "Darken everything outside the table outlines.",
    "cfg.showDealer": "Mark the mouth of the dealer notch on the canvas (not exported).",
    "cfg.showNames": "Show the table names on the canvas.",
    "cfg.showMeasures": "Show or hide the lasting measurements.",
    "cfg.showCentre": "Show the cloth centre mark.",
    "cfg.showOrigin": "Show the artwork origin mark (pink diamond).",
    "cfg.showExtremes": "Draw lines through the outermost points of every table outline.",
    "cfg.showGrid": "Show the grid on the canvas.",
    "cfg.gridMm": "Spacing of the grid and of the snap step. 0 turns the grid snapping off.",
    "cfg.pressMm": "Side of the square pressing area of the heat press, in millimetres. Used by Fit to the heat press in the Export tab.",
    "cfg.traceRes": "How finely text outlines are traced for measurements, in pixels per millimetre. Higher is more exact and slower.",
    "cfg.units": "The unit of the length fields (millimetres, centimetres or inches). The geometry itself is always in millimetres.",
    "cfg.preview": "Flat shows exact fill colours as they would be cut. Shaded adds gold shading and felt texture.",
    "table.name": "The name of this table.",
    "table.color": "The colour of the outline on the canvas (editor only).",
    "table.locked": "Lock the table so that it cannot be dragged on the canvas.",
    "table.x": "Horizontal position of the table centre, measured from the cloth centre.",
    "table.y": "Vertical position of the table centre, measured from the cloth centre (positive is down).",
    "table.rot": "Turn the table outline, in degrees. The artwork stays upright.",
    "table.railW": "Width of the rail ring around the table, in millimetres.",
    "table.wrap": "How far the cloth is wrapped over the edge, shown as the dashed wrap line.",
    "table.wrapShow": "Show the dashed wrap line around this table.",
    "table.railColor": "The colour of the rail in the preview only.",
    "preset.type": "The shape of the table outline. Moving a node later makes the outline free.",
    "preset.w": "Width of the table (or the diameter for a circle).",
    "preset.h": "Height of the table.",
    "preset.rad": "Radius of the circle.",
    "preset.r": "Corner radius of the rectangle. Half the shorter side makes it a stadium.",
    "preset.chamfer": "How much of each corner of the octagon is cut off.",
    "preset.circleLock": "Keep the table a circle. Untick to make an oval with a separate width and height.",
    "notch.on": "Cut a dealer notch into one side of the table.",
    "notch.style": "Scoop is one arc; Box has straight sides and corner radii.",
    "notch.side": "The side of the table where the notch is.",
    "notch.w": "Width of the notch mouth, in millimetres.",
    "notch.d": "Depth of the notch into the table, in millimetres.",
    "notch.r": "Radius of the inner corners of the box notch.",
    "notch.rm": "Radius of the corners at the mouth of the box notch.",
    "node.x": "Horizontal position of this node of the outline.",
    "node.y": "Vertical position of this node of the outline.",
    "node.b": "Bulge of the segment that starts at this node: 0 is a straight line, 1 a half circle, negative curves the other way.",
    "bet.on": "Show the player-area line, a line inside the table edge that marks where the bets go.",
    "bet.inset": "Distance of the player-area line from the table edge.",
    "bet.thick": "Thickness of the player-area line, spread evenly on both sides of its centre line.",
    "bet.outline": "Cut a clean margin around the player-area line: whatever lies below it is removed there in the cut file.",
    "bet.outlineW": "Width of the outline margin around the player-area line.",
    "bet.gapOn": "Leave a gap in the player-area line, for the dealer.",
    "bet.gapSide": "The side of the table where the gap is.",
    "bet.gapW": "Width of the gap in the player-area line.",
    "players.show": "Show players (cards and chips) at this table. A design aid; never cut.",
    "players.count": "Number of players at this table, 1 to 12.",
    "players.cards": "Number of cards each player holds, 2 to 4.",
    "players.dealerPlayer": "The dealer also plays a hand.",
    "pal.hex": "The colour value of this palette colour.",
    "pal.name": "The name of this colour. It is used in the layers of the cut file.",
    "cutter.name": "The name of this cutter. Projects remember the cutter by this name.",
    "cutter.widthMm": "The cutting width across the roll, in millimetres. Output wider than this gets a warning.",
    "cutter.maxLengthMm": "The longest cut along the roll, in millimetres. 0 means no limit.",
    "cutter.thinMm": "The thinnest detail that cuts and weeds well. 0 means no check. Only used for warnings about thin lines, narrow outline gaps and small text.",
    "cutcal.margin": "White margin around the calibration bitmaps (PNG and JPG), in millimetres.",
    "guide.name": "The name of this guide line.",
    "guide.rollW": "Width of the roll in millimetres. Above 0 the guide also shows a blue band of this width around its line and snaps by both edges. 0 makes it an ordinary guide.",
    "guide.dist": "Distance of the guide from the object it is measured from.",
    "guide.locked": "Lock the guide so that it cannot be dragged.",
    "guideref.sel": "What this guide is measured from: the cloth centre or a table edge.",
    "meas.name": "The name of this measurement.",
    "meas.off": "How far the dimension line is moved sideways from the measured points.",
    "mref.w": "Which part of the thick line the measurement attaches to: its centre line, or its inner or outer edge.",
    "cons.value": "The value this constraint holds.",
    "cons.kind": "Driving constraints are enforced by moving guides; reference constraints are only shown.",
    "cons.enabled": "Turn this constraint on or off.",
    "font.url": "Where the font file was downloaded from. Informational only.",
    "xp.tol": "Cleaning tolerance of the cut in millimetres. After the shapes are combined, leftover specks smaller than this size (area below tolerance times tolerance) are thrown away. A smaller value keeps more tiny bits; a bigger one removes more.",
    "xp.stripW": "Cut the design into vertical strips of this width, in millimetres, so a wide design fits the roll or the heat press. 0 means no strips.",
    "xp.stripOverlap": "How many millimetres neighbouring strips overlap, so the pieces can be laid slightly over each other when pressing. Every strip keeps its full width, and the step from one strip to the next is the strip width minus this value. At most half the strip width; 0 means the strips just touch.",
    "xp.texts": "Include the texts in the cut file.",
    "xp.upper": "Include the upper card line in the cut file.",
    "xp.lower": "Include the lower card line in the cut file.",
    "xp.bet": "Include the player-area line in the cut file.",
    "xp.sel": "Cut only the texts and card lines that are selected.",
    "xp.keepPos": "Keep every piece where it is in the whole design, so that the pieces share one origin even when others are filtered out.",
    "xp.mirror": "Mirror the cut, because heat-transfer film is cut on its back.",
    "xp.overlap": "Remove the parts of lower objects that are hidden under upper ones, so the cut pieces do not overlap.",
    "xp.useCalib": "Apply the correction factors of the chosen cutter's calibration.",
    "xp.useKerf": "Apply the blade offset (kerf) of the chosen cutter: pieces are made bigger or smaller by the blade width.",
    "xp.fx": "An extra scale factor across the roll (X), multiplied with the calibration correction, for a one-off such as 1.002.",
    "xp.fy": "An extra scale factor along the roll (Y), multiplied with the calibration correction.",
    "xp.jobName": "The name for a new job, a saved set of filters.",
    "xp.pxmm": "Resolution of the PNG picture in pixels per millimetre.",
    "xp.picObjects": "Draw the pot, cards, players and dealer button in the picture.",
    "xp.bTex": "Size of the cloth texture for Blender, in pixels along its long side.",
    "xp.bTableH": "Height of the table body in Blender.", "xp.bRailH": "Height of the rail in Blender.",
    "xp.cutter": "The cutter whose width, calibration and blade offset this export uses.",
    "xp.format": "SVG makes one file with a layer per colour. EPS makes one file per colour, for Roland CutStudio.",
    "xp.rotate": "Turn the whole cut by 0, 90, 180 or 270 degrees, for example to lay it across the roll.",
    "xp.area": "Which part of the design to export, for example one table.",
    "xp.scaleLock": "Keep the aspect ratio: the height follows the width.",
    "words.useUniversal": "Also use the universal word lists in this project. Untick to use only this project's own words.",
    "rand.interval": "Seconds between random changes while the randomizer runs.",
    "rand.shape": "Also change the shapes and sizes of the tables each round.",
    "rand.words": "Invent a new casino name and helper texts each round, replacing the texts.",
    "rand.helperFonts": "Also change the font, weight and letter space of the texts that are not part of the casino name.",
    "rand.sizeMin": "Smallest circle or octagon size the randomizer makes.", "rand.sizeMax": "Biggest circle or octagon size the randomizer makes.",
    "rand.heightMin": "Smallest height of a rectangle or stadium.", "rand.heightMax": "Biggest height of a rectangle or stadium.",
    "rand.factorMin": "Smallest value of the factor that gives the width from the height.", "rand.factorMax": "Biggest value of that factor."
  };
  var RAND_ROW = { bet: "the player-area line", notch: "the dealer notch", hand: "the poker hand", pot: "the pot", burn: "the burn cards", muck: "the muck", show: "showing the players", players: "the number of players", cards: "the cards per player", dealer: "whether the dealer is a player", style: "the casino name style" };
  function fieldTip(n) {
    var d = n.dataset || {}, base = (d.scope || "").split(":")[0], key = d.key || "";
    if (n.id === "jsonText") return "The JSON text of this part. Copy it, or paste new text here and press Apply.";
    if (d.cr) { var m = d.cr.split(":"); return ({ len: "The length of this calibration strip, in millimetres.", outer: "Measured overall length of this strip (measurement 1).", span: "Measured distance from the left edge of the first block to the left edge of the last block (measurement 2).", block: "Measured width of one block (measurement 3).", gap: "Measured width of one gap between blocks (measurement 4)." })[m[2]] || ""; }
    if (d.cf) return /kerf/.test(d.cf) ? "The blade offset in millimetres per edge. Positive means the kept pieces come out bigger." : /factor/.test(d.cf) ? "The correction factor of this direction: the cutter's output is multiplied by it." : /percent/.test(d.cf) ? "The same correction as a percentage." : "The same correction in millimetres over the longest strip.";
    if (d.xs) return /factor/.test(d.xs) ? "Scale the cut by this factor in this direction." : /percent/.test(d.xs) ? "Scale the cut by this percentage in this direction." : "The size of the cut in millimetres at this scale.";
    if (base === "rand") { var mm = /^(.*)(Vary|Set|Val)$/.exec(key); if (mm && RAND_ROW[mm[1]]) return mm[2] === "Vary" ? "Change " + RAND_ROW[mm[1]] + " at random in every round." : mm[2] === "Set" ? "Always set " + RAND_ROW[mm[1]] + " to the value on the right. It wins over Vary." : "The value used when Set is ticked for " + RAND_ROW[mm[1]] + "."; }
    var k = FT[base + "." + key] || FT[key] || "";
    if (!k && n.id) k = ({ betToggle: "Show or hide the player-area line on every visible table.", wrapToggle: "Show or hide the dashed wrap line around every visible table.", handInput: FT["cards.hand"], projectName: "The name of this project. It is the name of the tab.", pasteBox: "Paste a project, settings or word list text here and press Load.", projectText: "The current project as JSON text. Edit it and press Apply.", fileProject: "Choose a project file to open.", fileConfig: "Choose a settings file to open.", fileFont: "Choose a font file (TTF or OTF) to import." })[n.id] || "";
    return k;
  }

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
    (root || document).querySelectorAll("input, textarea, select").forEach(function (n) {
      if (n.type === "hidden") return;
      var f = fieldTip(n); if (!f) return;
      if (!n.getAttribute("title")) n.setAttribute("title", f);
      var lb = n.closest("label, .pair, .fld"); if (lb && !lb.getAttribute("title") && !lb.querySelector("[title]:not(input):not(select):not(textarea)")) lb.setAttribute("title", f);
    });
    (root || document).querySelectorAll("button, select, label.chk, [role=button], [role=tab], [role=menuitem]").forEach(function (n) {
      if (n.getAttribute("title")) return;
      var t = tipFor(n); if (t) n.setAttribute("title", t);
    });
  };
  Hp.untitled = function () {
    var out = [];
    document.querySelectorAll("button, select, label.chk, [role=button], [role=tab], [role=menuitem]").forEach(function (n) { if (!n.getAttribute("title")) out.push(n.id || n.dataset.act || n.textContent.trim().slice(0, 30)); });
    document.querySelectorAll("input, textarea").forEach(function (n) { if (n.type !== "hidden" && n.type !== "file" && !n.getAttribute("title")) out.push("field:" + (n.dataset.scope || "") + "." + (n.dataset.key || n.dataset.cr || n.dataset.cf || n.dataset.xs || n.id || n.type)); });
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
      "A roll guide (+ Vertical roll or + Horizontal roll) is a guide that also shows the vinyl roll: a blue band under the artwork, as wide as the cutting width of the cutter. Its line and both edges snap. Never cut.",
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
    { id: "cpoints", title: "Control points", body: [
      "A control point is a point that belongs to something: the cloth centre, the artwork origin, a text, a table or another control point. It remembers how far it is from its parent and keeps that place when the parent moves, turns or changes size. Texts, guides, measurements and other control points snap to it, so it is a handy fixed mark to aim at.",
      "Choose the Point tool in the toolbar (or press + Control point in the Guides and measurements tab) and click: a click on a text hangs the point on that text, a click on a control point hangs the new point on it, and a click on an empty place hangs it on the artwork origin. Esc ends the tool.",
      "Drag a point to move it: its offset changes and the parent stays. Drop it on another control point to hang it on that one (a point can never hang on itself or on its own children; the program says so). Arrow keys nudge the selected point by 1 mm, with Shift 10 mm and with Alt 0.1 mm; Delete removes it.",
      "Each point has two switches: it follows the rotation of its parent and it follows the scaling (the letter size of a text, the width and height of a table). When a parent is deleted its points stay where they are and hang on the cloth centre. Control points are never cut and do not appear in the picture or the layout sheet picture."] },
    { id: "align", title: "Aligning objects", body: [
      "The Align menu in the toolbar (it opens when the pointer rests on it) lines objects up. The quick buttons align left, centre, right, top, middle and bottom, and distribute three or more objects evenly. Without a target they put every selected object on the edge or centre of the box around the selection.",
      "With a target they aim at it. Select the objects that are the target (a text, the lines and cards, a table, a control point, a guide, or several of these) and choose Set alignment target: an orange box, point or line shows it, and it stays until you clear it. Two guides that cross make a point. Then click objects to move (Shift adds, Ctrl removes, dragging an area selects the texts, the lines and cards and the control points in it). A box with handles appears around them.",
      "Rest the pointer on a handle: an arrow shows where the handle would go and ghosts show the result. A click moves the objects there. Or press on the handle and drag it onto a point of the target (it lands exactly there) or onto a line of the target, the edges and centre lines of a box or the lines through a point, which are endless (it lands on the nearest point of the line, so only one direction changes). Let go on nothing and the move is cancelled. Hold Alt and every object moves by itself from its own handle; without Alt the objects move together.",
      "Esc ends the Align mode and forgets the target. Each alignment is one undo step. The thickness of lines is not counted: boxes are the geometry as it is."] },
    { id: "colours", title: "Colours", body: ["Every colour in the design comes from the palette. One cut layer is made per colour. Rename or change a colour and everything that uses it follows."] },
    { id: "fonts", title: "Fonts", body: ["Fonts come from Google Fonts by name or from a TTF or OTF file you import. A project that uses an imported font embeds it. If a font is missing, a fallback is shown and you can load the font file. Favourites are kept in the settings."] },
    { id: "random", title: "The randomizer", body: [
      "The randomizer shuffles fonts, sizes and layout of the existing texts on a timer and can invent a casino name with helper texts. Every round is its own undo step, so you can step through a stopped run with Undo and Redo.",
      "Each property of the table has Vary (changes at random every round) and Set (always this value)."] },
    { id: "export", title: "Export", body: [
      "Cut file: SVG (one file, a layer per colour) or EPS for Roland CutStudio (one file per colour, in a zip, all with the same frame so the colours register). Halos become holes, upper objects hide lower ones. Mirror, rotation, strips split to the cutter width, and a size (scale) for X and Y that is kept in the project. The poker hand, pot, cards and players are design aids and are never cut.",
      "Filters choose what is output: texts, the upper and lower card line, the player-area line, only the selected elements. What you leave out still knocks holes in the others. Keep the position makes all parts share one origin. A job is a named set of filters you can export and tick off.",
      "The cutter chosen here gives the calibration correction and the blade offset (kerf); both can be switched off. Fit to roll width and Fit to the heat press set the scale for you. A warning appears when the result is wider than the cutter or has details thinner than the cutter can cut.",
      "Picture (PNG) of the design, the layout sheet (a marking guide measured from the centre), and a Blender script that builds the table and the cloth texture."] },
    { id: "project", title: "Projects and tabs", body: [
      "Every project is a tab above the canvas with its own undo history. New project always opens a new tab. Save writes the project to a file (Ctrl+S); Open merges a file into the current tab. Save also offers Artwork only and Tables only."] },
    { id: "settings", title: "Settings", body: [
      "The Settings button in the toolbar holds what all projects share and is not part of any project file: units, snapping, favourite fonts, your own universal words, the list of cutters and the heat press size. Save, Open and Reset settings work on the settings file."] },
    { id: "cutters", title: "Cutters and calibration", body: [
      "The Cutters button in the toolbar opens the list of your cutters (add, copy, delete, reorder, JSON). Each has a cutting width, a longest cut and the thinnest detail it cuts well. A project remembers only the name of the cutter it used (chosen in the Export tab); if no cutter of that name exists on this computer, the first one is used.",
      "Calibration: download the strips (several lengths in one file, 10 mm bar with 10 x 10 mm blocks every 20 mm), cut them and measure the kept pieces with a caliper. The measuring guide shows what to measure: 1 overall length, 2 block span, 3 block width, 4 gap width. Type the numbers; the program works out a correction factor for X (across the roll) and Y (along it), and the blade offset (kerf). The simple method needs only the overall length of one strip and assumes no blade offset.",
      "The factor can be given as a factor, a percent or millimetres over the longest strip; typing one by hand overrides the measurements until you press Use the measurements. The exports apply the factor (and the blade offset) when the cutter is chosen there."] },
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
    return { artwork: "artwork", tables: "tables", guides: "measure", colours: "colours", fonts: "fonts", random: "random", export: "export", project: "project", settings: "settings", cutters: "cutters" }[u.tab] || "start";
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
    /* Windows (JSON, measuring guide) are filled when they open: give their fields tooltips as they appear. */
    var md = document.getElementById("modal");
    if (md && window.MutationObserver) new MutationObserver(function () { Hp.applyTips(md); }).observe(md, { childList: true, subtree: true });
  };
  PTD.help = Hp;
})(window.PTD = window.PTD || {});
