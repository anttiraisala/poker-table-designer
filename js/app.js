/* Poker Table Designer: core application.
 * State, palette, history, drawing of the cloth and artwork, panels, pointer handling, files.
 * Other modules (tables, guides, fonts, sheet, export) reach this one through PTD.core. */
(function (PTD) {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var G = PTD.geom;
  var KEY_PROJECT = "poker-table-designer-project-v1", KEY_FONTS = "poker-table-designer-fonts-v1",
    KEY_CONFIG = "poker-table-designer-config-v1", KEY_LEGACY = "molino-royale-editor-v1";
  var PROJECT_FORMAT = "poker-table-designer-project", CONFIG_FORMAT = "poker-table-designer-config";
  var svg = document.getElementById("stage"), stageWrap = document.getElementById("stageWrap");
  var layersEl = document.getElementById("layers"), bandPanel = document.getElementById("bandPanel");
  var toolMsg = document.getElementById("toolMsg");
  var state, config;
  var ui = { tool: "select", outlines: true, view: { cx: 0, cy: 0, z: 0.25 }, open: {}, extra: {}, marquee: null, bounds: {},
    selTable: null, selNode: null, selGuide: null, conflicts: [], snapLines: null, measure: null, fitted: false };
  var hist = { undo: [], redo: [], last: null, tag: null, time: 0 };
  var UNIT_MM = { mm: 1, cm: 10, in: 25.4 };

  /* ---------- small helpers ---------- */
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(v, d) { var n = Number(v); return isFinite(n) && v !== "" && v !== null && v !== undefined ? n : d; }
  function round(v, n) { var k = Math.pow(10, n == null ? 3 : n); return Math.round(v * k) / k; }
  function mix(a, b, t) {
    function p(h) { h = h.replace("#", ""); if (h.length === 3) h = h.replace(/(.)/g, "$1$1"); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) || 0; }); }
    var x = p(a), y = p(b);
    return "#" + x.map(function (v, i) { return ("0" + Math.round(v + (y[i] - v) * t).toString(16)).slice(-2); }).join("");
  }
  function say(t) {
    toolMsg.textContent = t || "";
    clearTimeout(say.timer);
    if (t) say.timer = setTimeout(function () { toolMsg.textContent = ""; }, 9000);
  }
  function nextId(prefix, arr) {
    var m = 0;
    arr.forEach(function (o) { var n = parseInt(String(o.id).slice(prefix.length), 10); if (isFinite(n) && n > m) m = n; });
    return prefix + (m + 1);
  }
  function slug(s) { return String(s || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"; }
  /* Saves a file. Inside a Claude Artifact the host's downloads capability does it (the viewer confirms);
   * as a standalone page a normal browser download is used. The host accepts only some file extensions,
   * so a Python script is offered as .py.txt there. */
  function download(name, data, mime) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime || "text/plain" });
    if (window.claude && typeof window.claude.use === "function") {
      var hostName = /\.py$/i.test(name) ? name + ".txt" : name;
      window.claude.use("downloads").then(function (d) {
        if (!d) throw { code: "unavailable" };
        return d.save({ filename: hostName, data: blob }).then(function () { if (hostName !== name) say("Saved as " + hostName + ". Remove the .txt ending before opening it in Blender."); });
      }).catch(function (e) {
        if (e && e.code === "declined") return;
        if (e && e.code === "unavailable") { say("Saving files is not available in this view. Open the page from the project site to save files."); return; }
        say("The file could not be saved" + (e && e.message ? ": " + e.message : "."));
      });
      return;
    }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  /* ---------- units ---------- */
  function unitF() { return UNIT_MM[config.units] || 1; }
  function fmtNum(v) { return String(round(v, 4)); }
  function fmtLen(mm) {
    var u = config.units, v = mm / unitF();
    return (u === "mm" ? round(v, 1) : u === "cm" ? round(v, 2) : round(v, 3)) + " " + u;
  }

  /* ---------- palette ---------- */
  var DEFAULT_PALETTE = [
    { id: "felt", name: "Felt green", hex: "#0d2b22" }, { id: "gold", name: "Gold", hex: "#d4af5a" },
    { id: "ivory", name: "Ivory", hex: "#f4efe2" }, { id: "black", name: "Black", hex: "#050807" },
    { id: "red", name: "Red", hex: "#b3262b" }
  ];
  var BUILTIN = { felt: 1, gold: 1, ivory: 1, black: 1, red: 1 };
  function colorHex(id) {
    if (typeof id === "string" && id.charAt(0) === "#") return id;
    var p = state.palette.filter(function (c) { return c.id === id; })[0];
    if (p) return p.hex;
    var d = DEFAULT_PALETTE.filter(function (c) { return c.id === id; })[0];
    return d ? d.hex : "#808080";
  }
  /* Accepts a palette id or a hex colour; returns a palette id, adding a palette entry when needed. */
  function colourId(v, fallback) {
    if (v === undefined || v === null || v === "") return fallback;
    var s = String(v);
    if (state.palette.some(function (c) { return c.id === s; })) return s;
    if (/^#[0-9a-f]{3,6}$/i.test(s)) {
      var hex = s.length === 4 ? "#" + s.slice(1).replace(/(.)/g, "$1$1") : s.toLowerCase();
      var f = state.palette.filter(function (c) { return c.hex.toLowerCase() === hex; })[0];
      if (f) return f.id;
      var id = nextId("c", state.palette);
      state.palette.push({ id: id, name: "Colour " + hex, hex: hex });
      return id;
    }
    return fallback;
  }
  function paletteOptions() { return state.palette.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join(""); }
  function colourUsed(id) {
    var used = [];
    if (state.cloth.color === id) used.push("the cloth");
    state.layers.forEach(function (l) { if (l.color === id || l.outlineColor === id) used.push("text “" + l.text + "”"); });
    if (state.band.color === id || state.band.outlineColor === id) used.push("the lines");
    state.tables.forEach(function (t) { if (t.bet && t.bet.color === id) used.push(t.name + " player-area line"); });
    if (BUILTIN[id]) used.push("the built-in set");
    return used;
  }
  function fillColourSlots() {
    document.querySelectorAll("[data-colour]").forEach(function (n) {
      var parts = n.dataset.colour.split(":"), label = parts.pop(), key = parts.pop(), scope = parts.join(":");
      n.innerHTML = '<span class="swatch" data-sw="' + scope + '|' + key + '"></span><select data-scope="' + scope + '" data-key="' + key + '" aria-label="' + esc(label || "Colour") + '">' + paletteOptions() + '</select>' +
        (label ? '<span class="small">' + esc(label) + '</span>' : "");
    });
  }
  function updateSwatches() {
    document.querySelectorAll("[data-sw]").forEach(function (n) {
      var p = n.dataset.sw.split("|"), s = p[0].split(":"), obj = resolveScope(s[0], s.slice(1).join(":"));
      if (obj) n.style.background = colorHex(obj[p[1]]);
    });
  }

  /* ---------- state ---------- */
  function mkLayer(text, font, size, ls, weight, x, y, gradient, upper) {
    return {
      id: "", text: text, font: font, size: size, ls: ls, weight: weight, italic: false, upper: !!upper, color: "gold",
      gradient: gradient !== false, rot: 0, opacity: 1, hidden: false, cap: false, capAll: false, capScale: 1.5,
      outline: true, outlineAuto: true, outlineColor: "felt", outlineW: 6, x: x, y: y, frozen: null, box: null
    };
  }
  function defaultArtwork() {
    var big1 = mkLayer("Molino", "Mea Culpa", 170, 0, 400, -170, -65, true, false), big2 = mkLayer("Royale", "Mea Culpa", 170, 0, 400, 190, -65, true, false);
    big1.outline = false; big2.outline = false;   /* the two big texts have no outline by default; every other text and the lines do */
    return {
      layers: [big1, big2, mkLayer("Casino", "Josefin Sans", 22, 12, 300, 0, 242, false, true)],
      band: { show: true, hidden: false, at: 3, outline: true, outlineAuto: true, outlineColor: "felt", outlineW: 3, x: 0, y: 82, len: 380, gap: 100, thick: 4, color: "gold" },
      cards: { show: true, hand: "As Ks Qs Js 10s", sizeMode: "poker", cw: 64, ch: 89, spacing: 0.12, fan: 0,
        /* things on the table next to the hand (picture and Blender only, never cut): offsets in mm from the centre between the two lines */
        chipDia: 40, chipThick: 2,
        potShow: true, potX: -270, potY: -50, potSeed: 7,
        burnShow: true, burnX: -250, burnY: 30,
        muckShow: true, muckX: -450, muckY: 10, muckSeed: 11 }
    };
  }
  function defaultExport() {
    return { mirror: false, rotate: 0, fx: 1, fy: 1, tol: 0.02, stripW: 0, stripOverlap: 10, area: "all", overlap: true, bet: true,
      pxmm: 0.5, picObjects: true, bTable: "", bTex: 4096, bTableH: 740, bRailH: 50 };
  }
  function defaults() {
    var a = defaultArtwork();
    return {
      name: "Molino Royale", layers: a.layers.map(function (l, i) { l.id = "l" + (i + 1); return l; }), band: a.band, cards: a.cards, selected: "l1",
      cloth: { real: false, w: 3200, h: 2000, x: 0, y: 0, color: "felt" },
      tables: [PTD.tables.make("t1", "Table 1", "stadium", 0)], guides: [], constraints: [],
      palette: DEFAULT_PALETTE.map(function (c) { return Object.assign({}, c); }), fonts: [], export: defaultExport()
    };
  }
  function normLayer(l, i, fb) {
    var base = mkLayer("", "Mea Culpa", 100, 0, 400, 0, 0, true, false);
    base.outline = false;   /* saved data without the field keeps its old look; only new texts start with an outline */
    var m = Object.assign(base, l || {});
    m.id = "l" + (i + 1);
    m.text = String(m.text == null ? "" : m.text);
    m.font = String(m.font || "Mea Culpa");
    ["size", "ls", "weight", "rot", "opacity", "capScale", "outlineW", "x", "y"].forEach(function (k) { m[k] = num(m[k], base[k]); });
    ["italic", "upper", "gradient", "hidden", "cap", "capAll", "outline", "outlineAuto"].forEach(function (k) { m[k] = !!m[k]; });
    m.color = colourId(m.color, "gold");
    m.outlineColor = colourId(m.outlineColor, "felt");
    if (!(m.frozen && typeof m.frozen.d === "string")) m.frozen = null;
    if (!(m.box && isFinite(m.box.w))) m.box = null;
    return m;
  }

  /* Builds a complete state from project JSON. Understands the old logo-editor settings (1 px = 1 mm). */
  function fromJSON(o) {
    o = o || {};
    var d = defaults(), s = { name: String(o.name || d.name) };
    var legacy = !o.format && (o.stage || o.layers) && !o.artwork;
    s.palette = Array.isArray(o.palette) && o.palette.length ? o.palette.map(function (c, i) {
      return { id: String(c.id || "c" + (i + 1)), name: String(c.name || "Colour " + (i + 1)), hex: /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#808080" };
    }) : d.palette;
    DEFAULT_PALETTE.forEach(function (c) { if (!s.palette.some(function (p) { return p.id === c.id; })) s.palette.push(Object.assign({}, c)); });
    state = { palette: s.palette, tables: [], guides: [], constraints: [], fonts: [], layers: [] };   /* colourId needs state.palette */
    var art = legacy ? o : (o.artwork || {});
    var dx = 0, dy = 0;
    if (legacy) { var st = o.stage || {}; dx = -(num(st.w, 1000)) / 2; dy = -(num(st.h, 560)) / 2; }
    var da = defaultArtwork();
    s.band = Object.assign(da.band, art.band || {});
    var oldCards = art.cards || {};
    s.cards = Object.assign(da.cards, oldCards);
    if (art.cards && oldCards.sizeMode === undefined) {   /* older files: fitted or a custom height, same look as before */
      var oldH = num(oldCards.h, 120);
      if (oldCards.fit === false) { s.cards.sizeMode = "custom"; s.cards.ch = oldH; s.cards.cw = Math.round(oldH * 0.714 * 10) / 10; }
      else s.cards.sizeMode = "fit";
    }
    /* The gap never changes the card size: a file that fitted the cards to the gap keeps the size it had. */
    if (s.cards.sizeMode === "fit") {
      var fh = Math.max(20, (num(s.band.gap, da.band.gap) - 2) * 0.88);
      s.cards.sizeMode = "custom"; s.cards.ch = Math.round(fh * 10) / 10; s.cards.cw = Math.round(fh * 64 / 89 * 10) / 10;
    }
    delete s.cards.fit; delete s.cards.h; delete s.cards.potScale; delete s.cards.burnScale; delete s.cards.muckScale;
    if (["poker", "custom"].indexOf(s.cards.sizeMode) < 0) s.cards.sizeMode = "poker";
    ["x", "y", "len", "gap", "thick", "outlineW", "at"].forEach(function (k) { s.band[k] = num(s.band[k], da.band[k]); });
    ["cw", "ch", "spacing", "fan", "chipDia", "chipThick", "potX", "potY", "potSeed", "burnX", "burnY", "muckX", "muckY", "muckSeed"].forEach(function (k) { s.cards[k] = num(s.cards[k], da.cards[k]); });
    s.cards.cw = Math.max(10, s.cards.cw); s.cards.ch = Math.max(10, s.cards.ch);
    s.cards.chipDia = Math.max(5, Math.min(200, s.cards.chipDia)); s.cards.chipThick = Math.max(0.2, Math.min(20, s.cards.chipThick));
    ["show", "potShow", "burnShow", "muckShow"].forEach(function (k) { s.cards[k] = !!s.cards[k]; });
    s.cards.hand = String(s.cards.hand);
    var arr = Array.isArray(art.layers) ? art.layers : da.layers;
    s.layers = arr.map(function (l, i) { return normLayer(l, i); });
    if (legacy) {
      s.layers.forEach(function (l) { l.x += dx; l.y += dy; });
      s.band.x += dx; s.band.y += dy;
    }
    s.band.color = colourId(s.band.color, "gold"); s.band.outlineColor = colourId(s.band.outlineColor, "felt");
    s.band.at = Math.max(0, Math.min(s.layers.length, Math.round(s.band.at)));
    s.cloth = Object.assign(d.cloth, o.cloth || {});
    ["w", "h", "x", "y"].forEach(function (k) { s.cloth[k] = num(s.cloth[k], d.cloth[k]); });
    s.cloth.real = !!s.cloth.real;
    var bg = legacy ? (o.stage && o.stage.bg) : s.cloth.color;
    s.cloth.color = colourId(bg, "felt");
    var tl = Array.isArray(o.tables) ? o.tables : (legacy ? d.tables : d.tables);
    state.palette = s.palette;
    s.tables = tl.map(function (t, i) { return PTD.tables.normalize(t, String((t && t.id) || "t" + (i + 1))); });
    s.tables.forEach(function (t) { t.railColor = t.railColor || "#6b4a2b"; t.bet.color = colourId(t.bet.color, "gold"); });
    s.guides = (Array.isArray(o.guides) ? o.guides : []).map(function (g, i) { return PTD.guides.normalize(g, String((g && g.id) || "g" + (i + 1))); });
    s.constraints = (Array.isArray(o.constraints) ? o.constraints : []).map(function (c, i) { return PTD.guides.normalizeCons(c, String((c && c.id) || "c" + (i + 1))); });
    var gids = {}; s.guides.forEach(function (g) { gids[g.id] = 1; });
    s.constraints = s.constraints.filter(function (c) { return c.ids.length && c.ids.every(function (i) { return gids[i]; }); });
    s.fonts = []; s.export = Object.assign(defaultExport(), o.export || {});
    s.selected = s.layers.length ? s.layers[0].id : "band";
    return s;
  }
  function defaultProjectJSON() {
    var d = defaults();
    return { format: PROJECT_FORMAT, version: 1, name: d.name, artwork: { layers: d.layers, band: d.band, cards: d.cards }, cloth: d.cloth,
      tables: d.tables, guides: [], constraints: [], palette: d.palette, fonts: [], export: d.export };
  }
  function toJSON(forFile) {
    var s = state;
    return {
      format: PROJECT_FORMAT, version: 1, name: s.name,
      artwork: { layers: s.layers.map(function (l) { var c = Object.assign({}, l); delete c.id; return c; }), band: s.band, cards: s.cards },
      cloth: s.cloth, tables: s.tables, guides: s.guides, constraints: s.constraints, palette: s.palette,
      fonts: forFile ? PTD.fonts.toProject() : s.fonts, export: s.export
    };
  }
  /* One part of the project as a file: "artwork" (texts, lines, cards, cloth, fonts and colours used) or "tables"
   * (tables with player-area lines, guides, constraints, colours used). "project" is everything. Same format, parts left out. */
  function toPartJSON(part, forFile) {
    var full = toJSON(forFile);
    if (part !== "artwork" && part !== "tables") return full;
    var s = state, used = {}, fams = {}, o = { format: PROJECT_FORMAT, version: 1, name: s.name };
    if (part === "artwork") {
      o.artwork = full.artwork; o.cloth = full.cloth;
      s.layers.forEach(function (l) { used[l.color] = used[l.outlineColor] = 1; fams[l.font] = 1; });
      used[s.band.color] = used[s.band.outlineColor] = used[s.cloth.color] = 1;
    } else {
      o.tables = full.tables; o.guides = full.guides; o.constraints = full.constraints;
      s.tables.forEach(function (t) { used[t.bet.color] = 1; });
    }
    o.palette = full.palette.filter(function (c) { return used[c.id]; });
    if (part === "artwork") o.fonts = full.fonts.filter(function (f) { return fams[f.family]; });
    return o;
  }
  function adoptProject(o) {
    if (PTD.random) PTD.random.stop();
    var keepFonts = o && o.fonts;
    var s = fromJSON(o);
    state = s;
    state.fonts = (PTD.fonts.fromProject(keepFonts || []));
    ui.extra = {}; ui.selTable = null; ui.selNode = null; ui.selGuide = null; ui.conflicts = []; ui.measure = null;
    PTD.guides.resolve();
    state.layers.forEach(function (l) { PTD.fonts.load(l.font); });
  }

  /* ---------- configuration ---------- */
  function defaultConfig() {
    return { units: "mm", snap: true, preview: "shaded", dimOutside: false, showExtremes: false, showGrid: false, gridMm: 50, showCentre: true, showDealer: true, showNames: true,
      cutter: { name: "", widthMm: 600, maxLengthMm: 0 }, cutterProfiles: [], favouriteFonts: PTD.fonts.FAVS.slice(), favsSeed: 2, palette: DEFAULT_PALETTE.map(function (c) { return Object.assign({}, c); }) };
  }
  function normConfig(o) {
    var c = Object.assign(defaultConfig(), o || {});
    if (!UNIT_MM[c.units]) c.units = "mm";
    c.snap = c.snap !== false; c.dimOutside = !!c.dimOutside; c.showExtremes = !!c.showExtremes; c.showGrid = !!c.showGrid; c.showCentre = c.showCentre !== false; c.showDealer = c.showDealer !== false; c.showNames = c.showNames !== false;
    c.preview = c.preview === "flat" ? "flat" : "shaded";
    c.gridMm = Math.max(0, num(c.gridMm, 50));
    if (!Array.isArray(c.cutterProfiles)) c.cutterProfiles = [];
    if (!Array.isArray(c.favouriteFonts)) c.favouriteFonts = PTD.fonts.FAVS.slice();
    if (c.favsSeed !== 2) {   /* one-time: older saved configs gain the two core fonts */
      ["Mea Culpa", "Josefin Sans"].forEach(function (f) { if (c.favouriteFonts.indexOf(f) < 0) c.favouriteFonts.unshift(f); });
      c.favsSeed = 2;
    }
    return c;
  }
  function configJSON() { return Object.assign({ format: CONFIG_FORMAT, version: 1 }, config); }
  var cfgTimer;
  function saveConfig() {
    clearTimeout(cfgTimer);
    cfgTimer = setTimeout(function () { try { localStorage.setItem(KEY_CONFIG, JSON.stringify(configJSON())); } catch (e) {} }, 300);
  }

  /* ---------- history and autosave ---------- */
  var undoBtn = document.getElementById("undoBtn"), redoBtn = document.getElementById("redoBtn");
  function snapshot() { return JSON.stringify(toJSON(false)); }
  function updateHistoryButtons() { undoBtn.disabled = !hist.undo.length; redoBtn.disabled = !hist.redo.length; }
  var autoTimer;
  var grp = null;   /* while a group is open, changes update the autosave but add no undo steps */
  /* Every step is a full JSON snapshot of the project (a few kilobytes: texts, tables, guides, no font files),
   * so a long history is cheap. It is limited by count and by total size, mainly because frozen texts carry large outlines. */
  var HIST_MAX = 2000, HIST_CHARS = 120e6;
  function trimHistory() {
    var total = 0, i;
    while (hist.undo.length > HIST_MAX) hist.undo.shift();
    for (i = 0; i < hist.undo.length; i++) total += hist.undo[i].length;
    while (total > HIST_CHARS && hist.undo.length > 1) total -= hist.undo.shift().length;
  }
  function groupBegin() { if (!grp) grp = { before: hist.last }; }
  function groupEnd() {
    if (!grp) return;
    var before = grp.before; grp = null;
    if (before !== null && before !== hist.last) {
      hist.undo.push(before); trimHistory();
      hist.redo = []; hist.tag = null; updateHistoryButtons();
    }
  }
  function save(tag) {
    var cur = snapshot();
    if (hist.last !== null && cur !== hist.last && !grp) {
      var now = Date.now();
      if (tag && tag === hist.tag && now - hist.time < 1200) { /* merged into the previous step */ }
      else { hist.undo.push(hist.last); trimHistory(); }
      hist.redo = []; hist.tag = tag || null; hist.time = now;
    }
    hist.last = cur;
    updateHistoryButtons();
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      try {
        localStorage.setItem(KEY_PROJECT, cur);
        try { localStorage.setItem(KEY_FONTS, JSON.stringify(PTD.fonts.dataForStorage())); } catch (e2) { localStorage.removeItem(KEY_FONTS); }
      } catch (e) {}
    }, 500);
  }
  function restore(snap) {
    var sel = state.selected;
    adoptProject(JSON.parse(snap));
    if (!sel) state.selected = null;   /* nothing was selected (for example after Random): keep it that way */
    else if (state.layers.some(function (l) { return l.id === sel; }) || sel === "band") state.selected = sel;
    hist.last = snap; hist.tag = null;
    updateHistoryButtons();
    renderPanels(); renderStage();
    try { localStorage.setItem(KEY_PROJECT, snap); } catch (e) {}
  }
  function undo() { if (PTD.random) PTD.random.stop(); if (!hist.undo.length) return; hist.redo.push(hist.last); restore(hist.undo.pop()); }
  function redo() { if (PTD.random) PTD.random.stop(); if (!hist.redo.length) return; hist.undo.push(hist.last); restore(hist.redo.pop()); }

  /* ---------- lookups and selection ---------- */
  function getLayer(id) { return state.layers.filter(function (l) { return l.id === id; })[0]; }
  function isSel(id) { return !!id && (state.selected === id || !!ui.extra[id]); }
  function selectedIds() {
    var out = [];
    if (state.selected) out.push(state.selected);
    Object.keys(ui.extra).forEach(function (k) { if (k !== state.selected) out.push(k); });
    return out.filter(function (k) { return k === "band" || getLayer(k); });
  }
  function editTargets(l) {
    if (!l || !isSel(l.id)) return [l];
    var t = selectedIds().map(getLayer).filter(Boolean);
    return t.length ? t : [l];
  }
  function clearOther() { ui.selTable = null; ui.selNode = null; ui.selGuide = null; }
  /* Nothing selected: no text, no lines and cards, no table, node or guide. Does not redraw. */
  function deselectAll() { state.selected = null; ui.extra = {}; clearOther(); }
  function setSelection(ids) {
    ids = ids.filter(function (k) { return k === "band" || getLayer(k); });
    state.selected = ids[0] || null; ui.extra = {};
    ids.slice(1).forEach(function (k) { ui.extra[k] = true; });
    if (ids.length) clearOther();
    renderPanels(); renderStage();
  }
  function select(id, keepClosed) {
    clearOther();
    var opens = !!id && id !== "band" && !keepClosed;
    if (opens) ui.open[id] = true;
    state.selected = id; ui.extra = {};
    if (id) setTab("artwork");
    renderPanels(); renderStage();
    revealSelected();
  }
  /* Scrolls the selected element's panel into view in the Artwork list. */
  function revealSelected() {
    if (ui.tab !== "artwork" || !state.selected) return;
    var n = state.selected === "band" ? bandPanel : layersEl.querySelector('[data-panel="' + state.selected + '"]');
    if (n && n.scrollIntoView) n.scrollIntoView({ block: "nearest" });
  }
  function toggleSel(id) {
    var ids = selectedIds(), i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1); else ids.push(id);
    setSelection(ids);
  }
  function pickItem(id, e) { if (e.shiftKey || e.ctrlKey || e.metaKey) toggleSel(id); else select(id, true); }
  function stackIds() { var a = state.layers.map(function (l) { return l.id; }); a.splice(state.band.at, 0, "band"); return a; }
  function moveInStack(id, dir) {
    var a = stackIds(), i = a.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= a.length) return;
    var t = a[i]; a[i] = a[j]; a[j] = t;
    state.band.at = a.indexOf("band");
    state.layers = a.filter(function (k) { return k !== "band"; }).map(getLayer);
  }

  /* ---------- cards ---------- */
  function parseHand(str) {
    var toks = String(str).trim().split(/[\s,]+/).filter(Boolean), cards = [], bad = [];
    var sm = { s: "♠", h: "♥", d: "♦", c: "♣", "♠": "♠", "♥": "♥", "♦": "♦", "♣": "♣" };
    toks.forEach(function (t) {
      var m = t.match(/^(10|[2-9ajqkt])([shdc♠♥♦♣])$/i);
      if (!m) { bad.push(t); return; }
      var r = m[1].toUpperCase(); if (r === "T") r = "10";
      cards.push({ r: r, s: sm[m[2].toLowerCase()] || sm[m[2]] });
    });
    return { cards: cards.slice(0, 7), bad: bad };
  }
  function txt(parent, s, x, y, size, fill, family, weight) {
    var t = el("text", { x: x, y: y, "text-anchor": "middle", "font-size": size, fill: fill, "font-weight": weight || 400 }, parent);
    t.style.fontFamily = family; t.textContent = s; return t;
  }
  function drawCard(parent, c, x, y, w, h, rot, px, py) {
    var g = el("g", { transform: "rotate(" + rot + " " + px + " " + py + ")" }, parent);
    el("rect", { x: x, y: y, width: w, height: h, rx: w * 0.09, fill: colorHex("ivory"), stroke: colorHex("black"), "stroke-width": Math.max(0.5, h * 0.012) }, g);
    var col = (c.s === "♥" || c.s === "♦") ? colorHex("red") : colorHex("black");
    var suit = c.s + "\uFE0E", serif = "Georgia, 'Times New Roman', serif", sym = "'Segoe UI Symbol', 'DejaVu Sans', Arial, sans-serif";
    function corner(gg) {
      txt(gg, c.r, x + w * 0.2, y + h * 0.19, h * 0.17, col, serif, 700);
      txt(gg, suit, x + w * 0.2, y + h * 0.34, h * 0.15, col, sym, 400);
    }
    corner(g);
    txt(g, suit, x + w / 2, y + h * 0.64, h * 0.46, col, sym, 400);
    corner(el("g", { transform: "rotate(180 " + (x + w / 2) + " " + (y + h / 2) + ")" }, g));
  }
  /* Card size in mm: the poker size (64 x 89), a custom size, (the gap between the lines never changes it). */
  function cardSize() {
    var c = state.cards, b = state.band, w, h;
    if (c.sizeMode === "custom") { w = Math.max(10, c.cw); h = Math.max(10, c.ch); }
    else { w = 64; h = 89; }
    return { w: w, h: h };
  }
  function cardLayout() {
    var b = state.band, c = state.cards, hand = parseHand(c.hand).cards, sz = cardSize();
    var w = sz.w, h = sz.h, step = w * (1 + c.spacing), n = hand.length;
    /* centred between the two lines, whatever their position and gap */
    return { hand: hand, w: w, h: h, step: step, top: b.y - h / 2, n: n };
  }
  function drawCards(parent) {
    var c = state.cards, L = cardLayout();
    if (!L.n) return null;
    var g = el("g", {}, parent);
    L.hand.forEach(function (card, i) {
      var off = i - (L.n - 1) / 2;
      drawCard(g, card, state.band.x + off * L.step - L.w / 2, L.top, L.w, L.h, off * c.fan, state.band.x, L.top + L.h * 2.2);
    });
    return g;
  }

  /* ---------- text drawing ---------- */
  var NSX = NS;
  function fillText(t, l, full) {
    while (t.firstChild) t.removeChild(t.firstChild);
    if (!(l.cap && l.capScale > 0 && l.capScale !== 1)) { t.textContent = full; return; }
    var buf = "", big = true;
    Array.from(full).forEach(function (ch) {
      var space = /\s/.test(ch);
      if (!space && big) {
        if (buf) { t.appendChild(document.createTextNode(buf)); buf = ""; }
        var ts = document.createElementNS(NSX, "tspan");
        ts.setAttribute("font-size", l.size * l.capScale); ts.textContent = ch; t.appendChild(ts); big = false;
      } else buf += ch;
      if (space && l.capAll) big = true;
    });
    if (buf) t.appendChild(document.createTextNode(buf));
  }
  function fontFamilyCss(name) { return '"' + String(name).replace(/["\\]/g, "") + '", "Georgia", serif'; }

  /* ---------- view ---------- */
  function stageSize() { var r = svg.getBoundingClientRect(); return { w: Math.max(50, r.width), h: Math.max(50, r.height) }; }
  function worldRect() {
    var s = stageSize(), v = ui.view, hw = s.w / v.z / 2, hh = s.h / v.z / 2;
    return { x0: v.cx - hw, y0: v.cy - hh, x1: v.cx + hw, y1: v.cy + hh };
  }
  function toWorld(e) {
    var r = svg.getBoundingClientRect(), v = ui.view;
    return { x: v.cx + (e.clientX - r.left - r.width / 2) / v.z, y: v.cy + (e.clientY - r.top - r.height / 2) / v.z };
  }
  function artworkBounds() {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    Object.keys(ui.bounds).forEach(function (k) { var b = ui.bounds[k]; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
    return isFinite(x0) ? { x0: x0, y0: y0, x1: x1, y1: y1 } : null;
  }
  function fitView() {
    var b = PTD.tables.bboxAll(), a = artworkBounds();
    if (!b && a) b = a;
    else if (b && a) b = { x0: Math.min(b.x0, a.x0), y0: Math.min(b.y0, a.y0), x1: Math.max(b.x1, a.x1), y1: Math.max(b.y1, a.y1) };
    if (!b) b = { x0: -1500, y0: -1000, x1: 1500, y1: 1000 };
    var s = stageSize(), w = Math.max(100, b.x1 - b.x0), h = Math.max(100, b.y1 - b.y0);
    ui.view.z = Math.min(s.w / (w * 1.12), s.h / (h * 1.12));
    ui.view.cx = (b.x0 + b.x1) / 2; ui.view.cy = (b.y0 + b.y1) / 2;
    ui.fitted = true;
    renderStage();
  }

  /* ---------- stage ---------- */
  function makeGradients(defs, flat) {
    state.layers.forEach(function (l) {
      if (!l.gradient || flat) return;
      var hex = colorHex(l.color), g = el("linearGradient", { id: "gr-" + l.id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      [[0, mix(hex, "#ffffff", 0.55)], [0.55, hex], [1, mix(hex, "#000000", 0.45)]].forEach(function (st) { el("stop", { offset: st[0], "stop-color": st[1] }, g); });
    });
  }
  /* Draws the artwork (lines, cards and texts in stack order) into a group. Shared with the exports. */
  function drawArtwork(art, flat) {
    var b = state.band, cloth = state.cloth;
    var cardsG = null, at = Math.max(0, Math.min(state.layers.length, Math.round(b.at || 0)));
    function drawBand() {
      if (b.hidden) return;
      if (b.show) {
        var oc = colorHex(b.outlineAuto ? cloth.color : b.outlineColor), ow = b.outline ? Math.max(0, b.outlineW) : 0;
        var ys = [b.y - b.gap / 2 - b.thick, b.y + b.gap / 2];
        if (ow > 0) ys.forEach(function (yy) { el("rect", { x: b.x - b.len / 2 - ow, y: yy - ow, width: b.len + ow * 2, height: b.thick + ow * 2, fill: oc }, art); });
        ys.forEach(function (yy) { el("rect", { x: b.x - b.len / 2, y: yy, width: b.len, height: b.thick, fill: colorHex(b.color) }, art); });
      }
      if (state.cards.show) cardsG = drawCards(art);
    }
    var texts = {}, bboxes = {};
    state.layers.forEach(function (l, li) {
      if (li === at) drawBand();
      if (l.hidden) return;
      var g = el("g", { transform: "rotate(" + l.rot + " " + l.x + " " + l.y + ")", opacity: l.opacity }, art);
      var fill = l.gradient && !flat ? "url(#gr-" + l.id + ")" : colorHex(l.color);
      var oc2 = colorHex(l.outlineAuto ? cloth.color : l.outlineColor);
      if (l.frozen) {
        var fz = l.frozen, pg = el("g", { transform: "translate(" + l.x + " " + l.y + ")" }, g);
        if (l.outline && l.outlineW > 0) el("path", { d: fz.d, fill: oc2, stroke: oc2, "stroke-width": l.outlineW * 2, "stroke-linejoin": "round" }, pg);
        el("path", { d: fz.d, fill: fill }, pg);
        bboxes[l.id] = { x: l.x + fz.x0, y: l.y + fz.y0, width: fz.x1 - fz.x0, height: fz.y1 - fz.y0 };
        return;
      }
      var t = el("text", { x: l.x, y: l.y, "text-anchor": "middle", "font-size": l.size, "font-weight": l.weight, "font-style": l.italic ? "italic" : "normal", fill: fill }, g);
      t.style.fontFamily = fontFamilyCss(l.font);
      t.style.letterSpacing = l.ls + "px";
      if (l.outline && l.outlineW > 0) {
        t.setAttribute("stroke", oc2); t.setAttribute("stroke-width", l.outlineW * 2);
        t.setAttribute("stroke-linejoin", "round"); t.setAttribute("stroke-linecap", "round"); t.style.paintOrder = "stroke";
      }
      fillText(t, l, l.upper ? l.text.toUpperCase() : l.text);
      texts[l.id] = t;
    });
    if (at >= state.layers.length) drawBand();
    return { texts: texts, bboxes: bboxes, cardsG: cardsG };
  }
  /* Things lying on the table: drawn above everything printed, the player-area line included.
   * The Blender texture leaves them out (they become 3D objects there). */
  function drawObjects(parent) {
    if (PTD.scene && PTD.scene.any(state)) PTD.scene.draw(parent, PTD.scene.build(state), { el: el, colorHex: colorHex });
  }
  var repaintReq;
  function requestRender() { cancelAnimationFrame(repaintReq); repaintReq = requestAnimationFrame(renderStage); }
  function renderStage() {
    var s = stageSize(), v = ui.view, b = state.band, flat = config.preview === "flat";
    var w = worldRect();
    svg.setAttribute("viewBox", w.x0 + " " + w.y0 + " " + (w.x1 - w.x0) + " " + (w.y1 - w.y0));
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var defs = el("defs", {}, svg), cloth = state.cloth, clothHex = colorHex(cloth.color);
    makeGradients(defs, flat);
    if (!flat) {
      var rg = el("radialGradient", { id: "clothShade", cx: 0.5, cy: 0.5, r: 0.5 }, defs);
      el("stop", { offset: 0, "stop-color": mix(clothHex, "#ffffff", 0.07) }, rg);
      el("stop", { offset: 1, "stop-color": mix(clothHex, "#000000", 0.3) }, rg);
    }

    /* cloth */
    var gCloth = el("g", {}, svg);
    if (cloth.real) {
      var cx0 = cloth.x - cloth.w / 2, cy0 = cloth.y - cloth.h / 2;
      el("rect", { x: cx0, y: cy0, width: cloth.w, height: cloth.h, fill: flat ? clothHex : "url(#clothShade)", stroke: "#8a8a8a", "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" }, gCloth);
      var lab = el("text", { x: cx0 + 8 / v.z, y: cy0 - 6 / v.z, "font-size": 12 / v.z, fill: "#8fa89b" }, gCloth);
      lab.textContent = "Cloth " + fmtLen(cloth.w) + " × " + fmtLen(cloth.h);
    } else {
      var big = Math.max(w.x1 - w.x0, w.y1 - w.y0) * 2;
      el("rect", { x: w.x0 - 1, y: w.y0 - 1, width: w.x1 - w.x0 + 2, height: w.y1 - w.y0 + 2, fill: clothHex }, gCloth);
      if (!flat) {
        var R = Math.max(big, 5000);
        el("rect", { x: -R, y: -R, width: 2 * R, height: 2 * R, fill: "url(#clothShade)", opacity: 0.9 }, gCloth);
      }
    }
    /* grid */
    if (config.showGrid && config.gridMm > 0) {
      var step = config.gridMm;
      while ((w.x1 - w.x0) / step > 160) step *= 2;
      var d = "", gx;
      for (gx = Math.ceil(w.x0 / step) * step; gx <= w.x1; gx += step) d += "M" + gx + " " + w.y0 + "V" + w.y1;
      for (var gy = Math.ceil(w.y0 / step) * step; gy <= w.y1; gy += step) d += "M" + w.x0 + " " + gy + "H" + w.x1;
      el("path", { d: d, fill: "none", stroke: "rgba(255,255,255,0.12)", "stroke-width": 1, "vector-effect": "non-scaling-stroke", "pointer-events": "none" }, svg);
    }

    var ctx = { z: v.z, world: w };
    /* artwork */
    var art = el("g", {}, svg);
    var A = drawArtwork(art, flat), texts = A.texts, bboxes = A.bboxes, cardsG = A.cardsG;
    PTD.tables.renderArt(art, ctx);   /* the player-area line lies above all texts */
    drawObjects(art);
    state.layers.forEach(function (l) {
      var t = texts[l.id]; if (!t) return;
      var bb = null;
      try { bb = t.getBBox(); } catch (e) {}
      if (bb && bb.width > 0) {
        bboxes[l.id] = { x: bb.x, y: bb.y, width: bb.width, height: bb.height };
        if (PTD.fonts.status(l.font) === "ok") l.box = { w: round(bb.width, 1), h: round(bb.height, 1), dy: round(bb.y - l.y, 1) };
      } else if (l.box) bboxes[l.id] = { x: l.x - l.box.w / 2, y: l.y + l.box.dy, width: l.box.w, height: l.box.h, placeholder: true };
    });

    /* dim everything outside the tables */
    if (config.dimOutside && PTD.tables.visible().length) {
      var mk = el("mask", { id: "dimMask", maskUnits: "userSpaceOnUse", x: w.x0, y: w.y0, width: w.x1 - w.x0, height: w.y1 - w.y0 }, defs);
      el("rect", { x: w.x0, y: w.y0, width: w.x1 - w.x0, height: w.y1 - w.y0, fill: "#fff" }, mk);
      PTD.tables.visible().forEach(function (t) { el("path", { d: G.polyPath(PTD.tables.geo(t).poly), fill: "#000" }, mk); });
      el("rect", { x: w.x0, y: w.y0, width: w.x1 - w.x0, height: w.y1 - w.y0, fill: "rgba(0,0,0,0.62)", mask: "url(#dimMask)", "pointer-events": "none" }, svg);
    }
    PTD.tables.render(el("g", {}, svg), ctx);
    PTD.guides.render(el("g", {}, svg), ctx);
    /* origin mark */
    var og = el("g", { "pointer-events": "none" }, svg), o = 14 / v.z;
    if (config.showCentre !== false) {
      el("line", { x1: -o, y1: 0, x2: o, y2: 0, stroke: "#f5e2a1", "stroke-width": 1.2, "vector-effect": "non-scaling-stroke" }, og);
      el("line", { x1: 0, y1: -o, x2: 0, y2: o, stroke: "#f5e2a1", "stroke-width": 1.2, "vector-effect": "non-scaling-stroke" }, og);
      el("circle", { cx: 0, cy: 0, r: o * 0.45, fill: "none", stroke: "#f5e2a1", "stroke-width": 1.2, "vector-effect": "non-scaling-stroke" }, og);
    }

    /* hit areas for artwork, selected items raised to the top */
    var hits = el("g", {}, svg);
    function hitRect(parent, x, y, ww, hh, id) {
      var r = el("rect", { x: x, y: y, width: ww, height: hh, fill: "rgba(0,0,0,0)", "pointer-events": "all", "data-id": id }, parent);
      r.style.cursor = "move";
    }
    var zids = stackIds();
    var zorder = zids.filter(function (k) { return !isSel(k); }).concat(zids.filter(function (k) { return isSel(k) && k !== state.selected; }));
    if (state.selected && zids.indexOf(state.selected) >= 0) zorder.push(state.selected);
    zorder.forEach(function (k) {
      if (k === "band") {
        if (b.show && !b.hidden) {
          hitRect(hits, b.x - b.len / 2, b.y - b.gap / 2 - b.thick - 8 / v.z, b.len, b.thick + 16 / v.z, "band");
          hitRect(hits, b.x - b.len / 2, b.y + b.gap / 2 - 8 / v.z, b.len, b.thick + 16 / v.z, "band");
        }
        if (cardsG) { try { var cb = cardsG.getBBox(); if (cb.width) hitRect(hits, cb.x, cb.y, cb.width, cb.height, "band"); } catch (e) {} }
        return;
      }
      var l = getLayer(k), bb = bboxes[k];
      if (!l || !bb || !bb.width || l.hidden) return;
      hitRect(el("g", { transform: "rotate(" + l.rot + " " + l.x + " " + l.y + ")" }, hits), bb.x, bb.y, bb.width, bb.height, k);
    });

    /* bounds of every item (marquee selection and snapping) */
    ui.bounds = {};
    function boundsOf(pts) {
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    state.layers.forEach(function (l) {
      var bb = bboxes[l.id]; if (!bb || !bb.width || l.hidden) return;
      var ang = l.rot * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
      ui.bounds[l.id] = boundsOf([[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]].map(function (q) {
        var dx = q[0] - l.x, dy = q[1] - l.y; return [l.x + dx * ca - dy * sa, l.y + dx * sa + dy * ca];
      }));
    });
    var bpts = [];
    if (b.show && !b.hidden) bpts.push([b.x - b.len / 2, b.y - b.gap / 2 - b.thick], [b.x + b.len / 2, b.y + b.gap / 2 + b.thick]);
    if (cardsG) { try { var cb3 = cardsG.getBBox(); if (cb3.width) bpts.push([cb3.x, cb3.y], [cb3.x + cb3.width, cb3.y + cb3.height]); } catch (e) {} }
    if (bpts.length && !b.hidden) ui.bounds.band = boundsOf(bpts);

    /* overlay */
    var ov = el("g", { "pointer-events": "none" }, svg);
    function dashed(parent, attrs, colour) {
      attrs.fill = attrs.fill || "none"; attrs.stroke = colour || "#5ad1ff"; attrs["stroke-width"] = 1.5; attrs["stroke-dasharray"] = "6 4"; attrs["vector-effect"] = "non-scaling-stroke";
      return el(attrs.tag || "rect", attrs, parent);
    }
    if (ui.outlines) selectedIds().forEach(function (sid) {
      var ly = getLayer(sid);
      if (ly && bboxes[sid] && bboxes[sid].width) {
        var bb = bboxes[sid];
        dashed(el("g", { transform: "rotate(" + ly.rot + " " + ly.x + " " + ly.y + ")" }, ov), { x: bb.x, y: bb.y, width: bb.width, height: bb.height }, bb.placeholder ? "#e0a36a" : null);
      } else if (sid === "band" && ui.bounds.band) {
        var bd = ui.bounds.band; dashed(ov, { x: bd.x - 6 / v.z, y: bd.y - 6 / v.z, width: bd.w + 12 / v.z, height: bd.h + 12 / v.z });
      }
    });
    state.layers.forEach(function (l) {
      var bb = bboxes[l.id];
      if (bb && bb.placeholder && !l.hidden) dashed(el("g", { transform: "rotate(" + l.rot + " " + l.x + " " + l.y + ")" }, ov), { x: bb.x, y: bb.y, width: bb.width, height: bb.height }, "#e0a36a");
    });
    if (ui.snapLines) {
      (ui.snapLines.x || []).forEach(function (sx) { dashed(ov, { tag: "line", x1: sx, x2: sx, y1: w.y0, y2: w.y1 }, "#ff7ab8"); });
      (ui.snapLines.y || []).forEach(function (sy) { dashed(ov, { tag: "line", y1: sy, y2: sy, x1: w.x0, x2: w.x1 }, "#ff7ab8"); });
    }
    if (ui.marquee) { var mq = ui.marquee, mr = dashed(ov, { x: mq.x, y: mq.y, width: mq.w, height: mq.h }); mr.setAttribute("fill", "rgba(90,209,255,0.14)"); }
    PTD.guides.renderMeasure(ov, ctx);
    PTD.tables.renderHandles(el("g", {}, svg), ctx);

    document.getElementById("viewInfo").textContent = "Zoom " + Math.round(v.z * 1000) / 10 + " % · " + fmtLen(100 / v.z) + " per 100 px";
    updateHandMsg(); updateToolbar();
  }

  /* ---------- panels ---------- */
  var EYE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8s2.7-5 7-5 7 5 7 5-2.7 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2.2"/><line class="slash" x1="2.5" y1="13.5" x2="13.5" y2="2.5"/></svg>';
  function eyeBtn(id, hidden, what, act) {
    var t = (hidden ? "Show " : "Hide ") + what;
    return '<button type="button" class="eyebtn' + (hidden ? " off" : "") + '" data-act="' + (act || "eye") + '" data-id="' + id + '" aria-pressed="' + (!hidden) + '" title="' + t + '" aria-label="' + t + '">' + EYE + '</button>';
  }
  var H = {
    chk: function (label, scope, key) { return '<label class="chk"><input type="checkbox" data-scope="' + scope + '" data-key="' + key + '"><span>' + label + '</span></label>'; },
    len: function (label, scope, key) { return '<label class="fld"><span>' + label + ' (' + config.units + ')</span><input type="number" step="any" data-unit="len" data-scope="' + scope + '" data-key="' + key + '"></label>'; },
    deg: function (label, scope, key) { return '<label class="fld"><span>' + label + ' (°)</span><input type="number" step="any" data-scope="' + scope + '" data-key="' + key + '"></label>'; },
    numField: function (label, scope, key, step) { return '<label class="fld"><span>' + label + '</span><input type="number" step="' + (step || "any") + '" data-scope="' + scope + '" data-key="' + key + '"></label>'; },
    pair: function (label, scope, key, min, max, step, nmin, nmax) {
      var base = 'data-scope="' + scope + '" data-key="' + key + '"';
      return '<div class="pair"><span>' + label + '</span><input type="range" ' + base + ' min="' + min + '" max="' + max + '" step="' + step + '"><input type="number" ' + base + ' min="' + nmin + '" max="' + nmax + '" step="' + step + '"></div>';
    }
  };
  function layerPanel(l, i) {
    var sc = "layer:" + l.id, open = !!ui.open[l.id], nL = state.layers.length, atB = state.band.at;
    var nSel = isSel(l.id) ? selectedIds().filter(function (k) { return !!getLayer(k); }).length : 0;
    var ord = (i >= atB ? nL - 1 - i : nL - i) - 1000;
    var head = '<header><button class="chev" type="button" data-act="toggle" data-id="' + l.id + '" aria-expanded="' + open + '" title="' + (open ? "Collapse" : "Expand") + '" aria-label="' + (open ? "Collapse" : "Expand") + ' text settings">' + (open ? "▲" : "▼") + '</button>' +
      '<button class="selbtn" type="button" data-act="select" data-id="' + l.id + '"><span class="idx">' + (nL - i) + '</span><span class="ttl">' + esc(l.text || "(empty)") + '</span>' + (l.frozen ? '<span class="small">outlines</span>' : "") + '</button>' +
      '<div class="tools">' + eyeBtn(l.id, l.hidden, "this text") +
      '<button type="button" class="pickbtn' + (isSel(l.id) ? " on" : "") + '" data-act="pick" data-id="' + l.id + '" aria-pressed="' + isSel(l.id) + '" title="Select this text on the canvas. Shift or Ctrl adds it to the selection.">Select</button>' +
      '<button type="button" data-act="back" data-id="' + l.id + '" title="Send backward" aria-label="Send backward">↓</button>' +
      '<button type="button" data-act="front" data-id="' + l.id + '" title="Bring forward" aria-label="Bring forward">↑</button>' +
      '<button type="button" data-act="del" data-id="' + l.id + '" title="Delete" aria-label="Delete text">✕</button></div></header>';
    var cls = 'panel layer' + (open ? " open" : "") + (isSel(l.id) ? " sel" : "") + (l.hidden ? " hid" : "");
    if (!open) return '<section class="' + cls + '" style="order:' + ord + '" data-panel="' + l.id + '">' + head + '</section>';
    var chips = config.favouriteFonts.map(function (f) { return '<button class="chip" type="button" data-act="fav" data-id="' + l.id + '" data-font="' + esc(f) + '">' + esc(f) + '</button>'; }).join("");
    var weights = [100, 200, 300, 400, 500, 600, 700, 800, 900].map(function (w) { return '<option value="' + w + '">' + w + '</option>'; }).join("");
    var frozen = !!l.frozen;
    var body = '<div class="body">' +
      (nSel > 1 ? '<p class="small multi">' + nSel + ' texts are selected. Changes here apply to all of them, except the text itself and its X and Y position.</p>' : '') +
      (frozen ? '<p class="small multi">This text is frozen to outlines. Unfreeze it to change the text, font or size.</p>' : '') +
      '<fieldset class="plain"' + (frozen ? " disabled" : "") + '>' +
      '<label class="fld"><span>Text</span><input type="text" data-scope="' + sc + '" data-key="text" autocomplete="off"></label>' +
      '<div class="fld"><span>Font (click to list, or type to filter)</span><div class="combo"><input type="text" role="combobox" aria-autocomplete="list" data-scope="' + sc + '" data-key="font" data-fontinput="1" autocomplete="off" spellcheck="false"><button class="combobtn" type="button" data-act="fontmenu" aria-label="Show all fonts">▾</button></div></div>' +
      '<div class="chips">' + chips + '</div><div class="fstat" data-fstat="' + l.id + '"></div>' +
      H.pair("Size (mm)", sc, "size", 5, 800, 1, 1, 3000) + H.pair("Letter space", sc, "ls", -30, 100, 1, -200, 400) +
      '<div class="row2"><label class="fld"><span>Weight</span><select data-scope="' + sc + '" data-key="weight" data-num="1">' + weights + '</select></label>' +
      '<div class="checks">' + H.chk("Italic", sc, "italic") + H.chk("Uppercase", sc, "upper") + '</div></div>' +
      '<div class="checks">' + H.chk("Bigger first letter", sc, "cap") + H.chk("Every word", sc, "capAll") + '</div>' +
      H.pair("Cap size ×", sc, "capScale", 0.5, 4, 0.05, 0.1, 10) + '</fieldset>' +
      H.pair("Rotation", sc, "rot", -180, 180, 1, -360, 360) + H.pair("Opacity", sc, "opacity", 0, 1, 0.01, 0, 1) +
      '<div class="colorrow" data-colour="' + sc + ':color:Colour"></div>' +
      '<div class="checks">' + H.chk("Gold shading (shaded preview only)", sc, "gradient") + '</div>' +
      '<div class="checks">' + H.chk("Outline (hides what is below)", sc, "outline") + H.chk("Use cloth colour", sc, "outlineAuto") + '</div>' +
      H.pair("Outline width", sc, "outlineW", 0, 60, 0.5, 0, 300) +
      '<div class="colorrow" data-colour="' + sc + ':outlineColor:Outline colour, used when the cloth colour is off"></div>' +
      '<div class="row2">' + H.len("Centre X", sc, "x") + H.len("Baseline Y", sc, "y") + '</div>' +
      '<div class="btnrow">' + (frozen ? '<button class="btn" type="button" data-act="unfreeze" data-id="' + l.id + '">Unfreeze (back to live text)</button>' : '<button class="btn" type="button" data-act="freeze" data-id="' + l.id + '">Freeze to outlines</button>') + '</div>' +
      '</div>';
    return '<section class="' + cls + '" style="order:' + ord + '" data-panel="' + l.id + '">' + head + body + '</section>';
  }
  function coloursHTML() {
    var out = '<h3 class="sec">Palette</h3><p class="small">Every colour in the design comes from this palette. One cut layer is made per colour. Rename or change a colour here and everything that uses it follows.</p>';
    state.palette.forEach(function (c) {
      var used = colourUsed(c.id);
      out += '<div class="panel"><div class="body"><div class="colorrow"><input type="color" data-scope="pal:' + c.id + '" data-key="hex" aria-label="Colour value">' +
        '<input type="text" data-scope="pal:' + c.id + '" data-key="name" aria-label="Colour name" autocomplete="off">' +
        '<button type="button" class="tbtn" data-act="paldel" data-id="' + c.id + '"' + (used.length ? ' disabled title="Used by: ' + esc(used.join(", ")) + '"' : '') + ' aria-label="Delete colour">✕</button></div>' +
        (used.length ? '<p class="small">Used by: ' + esc(used.slice(0, 4).join(", ")) + (used.length > 4 ? "…" : "") + '</p>' : "") + '</div></div>';
    });
    return out + '<div class="btnrow"><button class="btn gold" type="button" data-act="paladd">+ Add colour</button><button class="btn" type="button" data-act="palreset">Restore built-in colours</button></div>';
  }
  function projectHTML() {
    return '<h3 class="sec">Paste settings</h3><p class="small">Paste a project, a configuration or an old logo-editor settings text here, then press Load pasted text.</p>' +
      '<textarea id="pasteBox" spellcheck="false" rows="8" placeholder="Paste JSON here" aria-label="Paste settings text"></textarea>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="pload">Load pasted text</button></div>' +
      '<h3 class="sec">Project</h3><p class="small">The project file holds the tables, guides, constraints, artwork, palette, fonts and export choices. The browser also keeps an automatic copy. The configuration file holds your units, snapping, cutter profiles and favourite fonts.</p>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="psave">Save project</button><button class="btn" type="button" data-act="popen">Open project</button><button class="btn" type="button" data-act="pnew">New project</button><button class="btn" type="button" data-act="jsonopen">JSON…</button></div>' +
      '<div class="btnrow"><button class="btn" type="button" data-act="csave">Save configuration</button><button class="btn" type="button" data-act="copen">Open configuration</button><button class="btn" type="button" data-act="creset">Reset configuration</button></div>' +
      '<h3 class="sec">Cutter and favourites</h3><div class="row2"><label class="fld"><span>Cutter name</span><input type="text" data-scope="cutter" data-key="name" autocomplete="off"></label>' + H.len("Cutter width", "cutter", "widthMm") + '</div>' +
      '<p class="small">Old logo-editor settings files open here too (or paste their text into the box above): positions are moved so the old canvas centre becomes the cloth centre, and one pixel becomes one millimetre.</p>' +
      '<h3 class="sec">Project as text</h3><textarea id="projectText" spellcheck="false" aria-label="Project JSON"></textarea>' +
      '<div class="btnrow"><button class="btn" type="button" data-act="ptext">Show current project</button><button class="btn" type="button" data-act="papply">Apply this text</button></div>' +
      '<p class="small">Use this when downloads or file pickers are not available.</p><div class="msg" id="projMsg"></div>';
  }
  function panelOfTab(t) { return document.getElementById("tab-" + t); }
  function setTab(name) {
    ui.tab = name;
    document.querySelectorAll("#tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === name); });
    document.querySelectorAll(".tabpane").forEach(function (p) { p.classList.toggle("on", p.id === "tab-" + name); });
  }
  function syncToolbar() {
    var bt = document.getElementById("betToggle"), vis = PTD.tables.visible();
    if (bt) { bt.checked = vis.some(function (t) { return t.bet.on; }); bt.disabled = !vis.length; }
    var wt = document.getElementById("wrapToggle");
    if (wt) { wt.checked = vis.some(function (t) { return t.wrapShow !== false; }); wt.disabled = !vis.length; }
  }
  function renderPanels() {
    closeMenu();
    var a = document.activeElement, keep = null;
    if (a && a.dataset && a.dataset.scope && a.closest("#controls")) keep = { scope: a.dataset.scope, key: a.dataset.key, value: a.value, s: a.selectionStart, e: a.selectionEnd, type: a.type };
    layersEl.innerHTML = state.layers.map(function (l, i) { return layerPanel(l, i); }).reverse().join("");
    var nB = state.layers.length, atN = state.band.at;
    bandPanel.style.order = String(nB - atN - 1000);
    bandPanel.classList.toggle("sel", isSel("band"));
    var be = bandPanel.querySelector('[data-act="eye"]');
    if (be) { var bt = (state.band.hidden ? "Show" : "Hide") + " lines and cards"; be.classList.toggle("off", !!state.band.hidden); be.setAttribute("aria-pressed", String(!state.band.hidden)); be.title = bt; be.setAttribute("aria-label", bt); }
    var bp = bandPanel.querySelector('[data-act="pick"]');
    if (bp) { bp.classList.toggle("on", isSel("band")); bp.setAttribute("aria-pressed", String(isSel("band"))); }
    document.getElementById("tablesPane").innerHTML = PTD.tables.panelHTML();
    document.getElementById("guidesPane").innerHTML = PTD.guides.panelHTML();
    document.getElementById("coloursPane").innerHTML = coloursHTML();
    document.getElementById("fontsPane").innerHTML = PTD.fonts.panelHTML();
    document.getElementById("exportPane").innerHTML = PTD.exporter ? PTD.exporter.panelHTML() : "";
    document.getElementById("randomPane").innerHTML = PTD.random ? PTD.random.panelHTML() : "";
    if (PTD.random && PTD.random.paint) PTD.random.paint();
    document.getElementById("projectPane").innerHTML = projectHTML();
    document.getElementById("projectName").value = state.name;
    syncToolbar();
    fillColourSlots();
    syncInputs();
    if (keep) {
      var q = document.querySelectorAll('#controls [data-scope="' + keep.scope + '"][data-key="' + keep.key + '"]');
      for (var i = 0; i < q.length; i++) if (q[i].type === keep.type) {
        q[i].focus();
        if (keep.type !== "checkbox" && keep.type !== "color" && keep.type !== "range") { q[i].value = keep.value; try { q[i].setSelectionRange(keep.s, keep.e); } catch (e) {} }
        break;
      }
    }
    updateFontStatus();
  }

  /* ---------- scopes: which object a data-scope names ---------- */
  PTD.scopes = PTD.scopes || {};
  PTD.onChange = PTD.onChange || {};
  PTD.scopes.layer = function (id) { return getLayer(id); };
  PTD.scopes.band = function () { return state.band; };
  PTD.scopes.cards = function () { return state.cards; };
  PTD.scopes.cloth = function () { return state.cloth; };
  PTD.scopes.cfg = function () { return config; };
  PTD.scopes.cutter = function () { return config.cutter; };
  PTD.scopes.xp = function () { return state.export; };
  PTD.scopes.pal = function (id) { return state.palette.filter(function (c) { return c.id === id; })[0]; };
  PTD.scopes.font = function (id) { return PTD.fonts.entry(id); };
  function resolveScope(name, id) { var f = PTD.scopes[name]; return f ? f(id) : null; }
  PTD.onChange.cfg = function (o, key) {
    if (key === "units") renderPanels();
    saveConfig();
  };
  PTD.onChange.cutter = function () { saveConfig(); };
  PTD.onChange.cloth = function () { updateSwatches(); };
  PTD.onChange.pal = function (o, key) { if (key === "name") { var keep = document.activeElement; fillColourSlots(); syncInputs(); if (keep && keep.focus) keep.focus(); } };
  PTD.onChange.cards = function () { updateHandMsg(); };
  PTD.onChange.layer = function (o, key, id, v) {
    if (key === "text") { var t = layersEl.querySelector('[data-panel="' + id + '"] .ttl'); if (t) t.textContent = v || "(empty)"; }
  };

  function syncInputs() {
    document.querySelectorAll("[data-scope]").forEach(function (inp) {
      if (inp === document.activeElement || inp.id === "newConsType") return;
      var sc = inp.dataset.scope, i = sc.indexOf(":"), name = i < 0 ? sc : sc.slice(0, i), id = i < 0 ? "" : sc.slice(i + 1);
      var obj = resolveScope(name, id);
      if (!obj) return;
      var v = obj[inp.dataset.key];
      if (inp.type === "checkbox") inp.checked = !!v;
      else if (inp.dataset.unit === "len") inp.value = v == null ? "" : fmtNum(v / unitF());
      else inp.value = v == null ? "" : v;
    });
    document.querySelectorAll("[data-sw]").forEach(function () {}); updateSwatches();
    updateChips(); updateFontStatus();
    var pn = document.getElementById("projectName"); if (pn !== document.activeElement) pn.value = state.name;
  }
  function updateChips() {
    var sel = getLayer(state.selected);
    document.querySelectorAll('[data-act="fav"]').forEach(function (c) { c.classList.toggle("on", !!sel && sel.font === c.dataset.font); });
  }
  function updateHandMsg() {
    var m = document.getElementById("handMsg"); if (!m) return;
    var r = parseHand(state.cards.hand);
    if (r.bad.length) { m.textContent = "Could not read: " + r.bad.join(", ") + ". Use rank + suit, like As, 10h, Kd."; m.className = "fstat bad"; }
    else { m.textContent = r.cards.length + (r.cards.length === 1 ? " card" : " cards"); m.className = "fstat"; }
  }
  function updateToolbar() {
    document.getElementById("cloneBtn").disabled = !selectedIds().some(function (k) { return !!getLayer(k); });
    document.querySelectorAll("[data-tool]").forEach(function (b) { b.classList.toggle("on", b.dataset.tool === ui.tool); });
    var ob = document.getElementById("outlineBtn"); ob.textContent = ui.outlines ? "Hide outline" : "Show outline"; ob.setAttribute("aria-pressed", String(!ui.outlines));
    stageWrap.style.cursor = ui.tool === "select" ? "" : "crosshair";
  }
  function updateFontStatus() {
    document.querySelectorAll("[data-fstat]").forEach(function (n) {
      var l = getLayer(n.dataset.fstat); if (!l) return;
      var s = PTD.fonts.status(l.font), msg = "", bad = false, btn = false;
      if (s === "ok") msg = "Font loaded.";
      else if (s === "loading") msg = "Loading the font…";
      else if (s === "missing") { msg = "This font file is not loaded, so a fallback font is shown. Load the font file again to see the real shape."; bad = true; btn = true; }
      else if (s === "fail") { msg = "That name was not found on Google Fonts. A fallback font is shown. If you have the font file, load it."; bad = true; btn = true; }
      else msg = "";
      n.className = "fstat" + (bad ? " bad" : "");
      n.innerHTML = esc(msg) + (btn ? ' <button class="pickbtn" type="button" data-act="fontfile" data-family="' + esc(l.font) + '">Load font file</button>' : "");
    });
  }
  function afterFont() {
    updateFontStatus();
    requestRender();
  }

  /* ---------- binding of inputs ---------- */
  var fontTimer;
  function onInput(e) {
    var inp = e.target;
    if (!inp.dataset || !inp.dataset.scope || inp.id === "newConsType") return;
    if (inp.dataset.fontinput) { onFontInput(e); return; }
    var sc = inp.dataset.scope, i = sc.indexOf(":"), name = i < 0 ? sc : sc.slice(0, i), id = i < 0 ? "" : sc.slice(i + 1), key = inp.dataset.key;
    var obj = resolveScope(name, id);
    if (!obj) return;
    var v, old = obj[key];
    if (inp.type === "checkbox") v = inp.checked;
    else if (inp.type === "number" || inp.type === "range" || inp.dataset.num) {
      if (inp.value === "" || !isFinite(Number(inp.value))) return;
      v = Number(inp.value);
      if (inp.dataset.unit === "len") v = v * unitF();
    } else v = inp.value;
    if (name === "layer" && key !== "text" && key !== "x" && key !== "y") editTargets(obj).forEach(function (t) { t[key] = v; });
    else obj[key] = v;
    var hook = PTD.onChange[name];
    if (hook) hook(obj, key, id, v, old);
    renderStage(); syncInputs(); syncToolbar(); save(sc + ":" + key);
  }
  document.addEventListener("input", onInput);

  /* Drag sideways over a number field (or its label) to change the value; a plain click still edits the text.
     One step per pixel, Shift makes it ten times coarser, Alt ten times finer. */
  document.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    var inp = e.target.closest ? e.target.closest('input[type="number"][data-scope]') : null;
    if (!inp && e.target.closest) { var lab = e.target.closest("label.fld"); if (lab && e.target.tagName === "SPAN") inp = lab.querySelector('input[type="number"][data-scope]'); }
    if (!inp || inp.disabled || inp.readOnly) return;
    var x0 = e.clientX, v0 = Number(inp.value), scrub = false;
    /* A change can rebuild the panel, which replaces this input; look the live one up by scope and key each time. */
    var selector = '[data-scope="' + inp.dataset.scope + '"][data-key="' + inp.dataset.key + '"]';
    function live() { return document.querySelector(selector) || inp; }
    if (!isFinite(v0)) return;
    var stepAttr = Number(inp.getAttribute("step")), step = isFinite(stepAttr) && stepAttr > 0 ? stepAttr : 1;
    var lo = inp.min !== "" ? Number(inp.min) : -Infinity, hi = inp.max !== "" ? Number(inp.max) : Infinity;
    function move(ev) {
      var dx = ev.clientX - x0;
      if (!scrub) {
        if (Math.abs(dx) < 4) return;
        scrub = true; document.body.classList.add("scrubbing");
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      }
      ev.preventDefault();
      var s = step * (ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1), v = v0 + Math.round(dx) * s;
      var dec = ((String(s).split(".")[1]) || "").length;
      v = Math.min(hi, Math.max(lo, Number(v.toFixed(Math.max(dec, 0)))));
      var cur = live();
      if (String(v) === cur.value) return;
      cur.value = String(v);
      cur.dispatchEvent(new Event("input", { bubbles: true }));
      if (window.getSelection) window.getSelection().removeAllRanges();
    }
    function up() {
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      document.body.classList.remove("scrubbing");
      if (scrub) { var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); }; document.addEventListener("click", stop, { capture: true, once: true }); setTimeout(function () { document.removeEventListener("click", stop, true); }, 0); }
    }
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  });

  /* ---------- font menu ---------- */
  var menu = document.getElementById("fontMenu"), menuInput = null, menuItems = [], menuIdx = -1;
  function filterFonts(q) {
    var parts = q.toLowerCase().split(/\s+/).filter(Boolean);
    return PTD.fonts.allNames().filter(function (n) { var l = n.toLowerCase(); return parts.every(function (p) { return l.indexOf(p) >= 0; }); });
  }
  function positionMenu() {
    if (!menuInput) return;
    var r = menuInput.getBoundingClientRect();
    menu.style.left = r.left + "px"; menu.style.width = Math.max(220, r.width + 34) + "px";
    var below = window.innerHeight - r.bottom, top = below < 200 && r.top > below;
    menu.style.top = top ? "" : r.bottom + "px"; menu.style.bottom = top ? window.innerHeight - r.top + "px" : "";
  }
  function drawMenu() {
    var cur = menuInput.value;
    if (!menuItems.length) { menu.innerHTML = '<div class="empty">No match in the list. Press Enter to try “' + esc(cur) + '” as a Google Fonts name, or import a font file on the Fonts tab.</div>'; return; }
    menu.innerHTML = menuItems.map(function (n, i) {
      var fav = config.favouriteFonts.indexOf(n) >= 0, imp = PTD.fonts.isImported(n);
      return '<div class="opt' + (n === cur ? " cur" : "") + (i === menuIdx ? " act" : "") + '" role="option" data-font="' + esc(n) + '">' + (fav ? '<span class="star">★</span> ' : "") + esc(n) + (imp ? ' <span class="note">file</span>' : "") + '</div>';
    }).join("");
    var a = menu.querySelector(".act"); if (a) a.scrollIntoView({ block: "nearest" });
  }
  function openMenu(inp, showAll) {
    menuInput = inp; menuItems = showAll ? PTD.fonts.allNames() : filterFonts(inp.value);
    menuIdx = menuItems.indexOf(inp.value);
    menu.hidden = false; positionMenu(); drawMenu();
  }
  function closeMenu() { menu.hidden = true; menuInput = null; }
  function setFont(inp, name) {
    var l = getLayer(inp.dataset.scope.split(":")[1]); if (!l) return;
    editTargets(l).forEach(function (t) { t.font = name; });
    inp.value = name; PTD.fonts.load(name);
    closeMenu(); renderStage(); syncInputs(); save("font");
  }
  function onFontInput(e) {
    var inp = e.target, l = getLayer(inp.dataset.scope.split(":")[1]); if (!l) return;
    openMenu(inp, false);
    clearTimeout(fontTimer);
    fontTimer = setTimeout(function () { if (PTD.fonts.allNames().indexOf(inp.value) >= 0 || inp.value.length > 2) { editTargets(l).forEach(function (t) { t.font = inp.value; }); PTD.fonts.load(inp.value); renderStage(); updateFontStatus(); save("font"); } }, 700);
  }
  menu.addEventListener("mousedown", function (e) {
    e.preventDefault();
    var o = e.target.closest(".opt"); if (o && menuInput) setFont(menuInput, o.dataset.font);
  });
  document.addEventListener("keydown", function (e) {
    if (menu.hidden || !menuInput || document.activeElement !== menuInput) return;
    if (e.key === "ArrowDown") { menuIdx = Math.min(menuItems.length - 1, menuIdx + 1); drawMenu(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { menuIdx = Math.max(0, menuIdx - 1); drawMenu(); e.preventDefault(); }
    else if (e.key === "Enter") { setFont(menuInput, menuIdx >= 0 && menuItems[menuIdx] ? menuItems[menuIdx] : menuInput.value.trim()); e.preventDefault(); }
    else if (e.key === "Escape") { closeMenu(); e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener("focusin", function (e) {
    if (e.target.dataset && e.target.dataset.fontinput) { openMenu(e.target, true); var fe = e.target; setTimeout(function () { if (document.activeElement === fe) fe.select(); }, 0); }
    else if (!menu.contains(e.target)) closeMenu();
  });

  /* ---------- clicks in the panels ---------- */
  function actClone() {
    var ids = selectedIds().filter(function (k) { return !!getLayer(k); });
    if (!ids.length) return;
    var made = [];
    ids.forEach(function (id) {
      var l = getLayer(id), c = Object.assign({}, l), bb = ui.bounds[id];
      c.frozen = l.frozen ? Object.assign({}, l.frozen) : null;
      c.y = l.y + (bb ? bb.h : l.size * 1.1) + 10;
      state.layers.splice(state.layers.indexOf(l) + 1, 0, c);
      if (state.layers.indexOf(l) < state.band.at) state.band.at++;
      c._src = id; made.push(c);
    });
    state.layers.forEach(function (l, i) { var old = l.id; l.id = "l" + (i + 1); l._map = old; });
    var newIds = made.map(function (c) { return c.id; });
    state.layers.forEach(function (l) { delete l._map; });
    made.forEach(function (c) { delete c._src; });
    setSelection(newIds); save();
  }
  function actDelLayer(id) {
    var i = state.layers.findIndex(function (l) { return l.id === id; }); if (i < 0) return;
    state.layers.splice(i, 1); delete ui.extra[id];
    if (i < state.band.at) state.band.at -= 1;
    state.layers.forEach(function (l, k) { l.id = "l" + (k + 1); });
    state.selected = state.layers.length ? state.layers[Math.max(0, i - 1)].id : "band"; ui.extra = {};
  }
  function projMsg(t) { var m = document.getElementById("projMsg"); if (m) m.textContent = t || ""; say(t); }
  function pickFile(input, cb) {
    input.value = "";
    input.onchange = function () {
      var f = input.files && input.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () { cb(String(rd.result), f); }; rd.readAsText(f); input.value = "";
    };
    input.click();
  }
  /* Merges a (possibly partial) project file into the current project. Parts the file does not contain stay as they are. */
  function mergeLoaded(o) {
    var cur = JSON.parse(JSON.stringify(toJSON(false))), m = cur;
    var legacy = !o.format && (o.stage || o.layers) && !o.artwork;
    var hasArt = !!(o.artwork || o.cloth), hasTab = !!(o.tables || o.guides || o.constraints);
    var info = { legacy: legacy, extras: [] };
    if (legacy) {
      var keep = state, conv;
      try { conv = fromJSON(o); } finally { state = keep; }   /* fromJSON works on the global state while converting */
      m.artwork = { layers: conv.layers.map(function (l) { var c = Object.assign({}, l); delete c.id; return c; }), band: conv.band, cards: conv.cards };
      m.cloth = conv.cloth; hasArt = true; hasTab = false;
      o = { name: o.name };
    } else {
      if (o.artwork) m.artwork = Object.assign({}, cur.artwork, o.artwork);
      if (o.cloth) m.cloth = Object.assign({}, cur.cloth, o.cloth);
      if (o.tables) m.tables = o.tables;
      if (o.guides) m.guides = o.guides;
      if (o.constraints) m.constraints = o.constraints;
    }
    var full = hasArt && hasTab;
    if (Array.isArray(o.palette) && o.palette.length) {
      if (full) m.palette = o.palette;
      else {
        m.palette = cur.palette.map(function (c) { return o.palette.filter(function (n) { return n && n.id === c.id; })[0] || c; });
        o.palette.forEach(function (n) { if (n && n.id && !m.palette.some(function (c) { return c.id === n.id; })) m.palette.push(n); });
      }
      info.extras.push("colours");
    }
    if (Array.isArray(o.fonts)) {
      var list = full ? [] : cur.fonts.slice();
      o.fonts.forEach(function (f) {
        if (!f || !f.family) return;
        var k = list.findIndex(function (x) { return x.family === f.family; });
        if (k >= 0) list[k] = f; else list.push(f);
      });
      m.fonts = list; info.extras.push("fonts");
    } else if (full) m.fonts = [];
    if (o.export && typeof o.export === "object") { m.export = Object.assign({}, cur.export, o.export); info.extras.push("export settings"); }
    var oneGroup = hasArt !== hasTab;
    if (o.name != null && !oneGroup) { m.name = String(o.name); if (!hasArt && !hasTab) info.extras.push("name"); }
    var ids = {}; (m.tables || []).forEach(function (t) { if (t) ids[t.id] = 1; });
    if (m.export) {
      if (m.export.bTable && !ids[m.export.bTable]) m.export.bTable = "";
      if (m.export.area && m.export.area !== "all" && !ids[m.export.area]) m.export.area = "all";
    }
    info.merged = m; info.hasArt = hasArt; info.hasTab = hasTab; info.full = full;
    return info;
  }
  /* Loads project (whole or partial), configuration or old logo-editor settings text. Returns {ok, msg}. */
  function loadText(text) {
    function done(ok, m) { projMsg(m); return { ok: ok, msg: m }; }
    var o;
    try { o = JSON.parse(text); } catch (e) { return done(false, "That is not valid JSON."); }
    if (o && o.format === CONFIG_FORMAT) { config = normConfig(o); saveConfig(); renderPanels(); renderStage(); return done(true, "Configuration loaded."); }
    if (o && o.format && o.format !== PROJECT_FORMAT) return done(false, "Unknown file format: " + o.format);
    if (!o || typeof o !== "object" || Array.isArray(o)) return done(false, "That text is not a project.");
    if (o.version > 1) say("This file is from a newer version of the tool. Loading what can be read.");
    var info;
    try { info = mergeLoaded(o); adoptProject(info.merged); } catch (e2) { return done(false, "Could not load the project: " + e2.message); }
    hist.undo.push(hist.last); hist.redo = []; hist.last = null; save();
    renderPanels(); renderStage(); if (info.hasArt || info.hasTab) fitView();
    var msg;
    if (info.full) msg = "Project loaded.";
    else {
      var got = [], kept = [];
      (info.hasArt ? got : kept).push("artwork");
      (info.hasTab ? got : kept).push("tables, guides and constraints");
      if (!info.hasArt && !info.hasTab) { got = info.extras.length ? info.extras : ["the project name"]; msg = "Loaded " + got.join(" and ") + "."; }
      else msg = "Loaded " + got.join(" and ") + (info.extras.length ? " (with " + info.extras.join(", ") + ")" : "") + ". Kept " + kept.join(" and ") + ".";
    }
    return done(true, msg);
  }
  var PART_FILE = { project: ["project", "the whole project"], artwork: ["artwork", "artwork only"], tables: ["tables", "tables, guides and constraints only"] };
  function savePart(part) {
    var d = PART_FILE[part] || PART_FILE.project, name = slug(state.name) + "." + d[0] + ".json";
    download(name, JSON.stringify(toPartJSON(part, true), null, 1), "application/json");
    projMsg("Saved " + name + " (" + d[1] + ").");
  }
  function projectToFile() { savePart("project"); }
  function openFile() { pickFile(document.getElementById("fileProject"), function (t) { loadText(t); }); }
  function newProject() {
    if (!window.confirm || window.confirm("Start a new project? The current one stays in the undo history until you close the page.")) {
      adoptProject(defaultProjectJSON()); hist.undo.push(hist.last); hist.redo = []; save(); renderPanels(); renderStage(); fitView();
    }
  }
  function freezeLayer(l, on) {
    if (!on) { l.frozen = null; renderPanels(); renderStage(); save(); return; }
    say("Making outlines…");
    PTD.fonts.freeze(l).then(function () { say("Frozen. The text is now exact geometry."); renderPanels(); renderStage(); save(); })
      .catch(function (err) { say(err.message); var m = document.getElementById("fontMsg"); if (m) m.textContent = err.message; });
  }
  function fontFileFor(family) {
    var inp = document.getElementById("fileFont");
    inp.value = "";
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      PTD.fonts.importFile(f, family || null).then(function (fam) { say("Loaded the font “" + fam + "”."); renderPanels(); renderStage(); save(); }, function (err) { say(err.message); });
    };
    inp.click();
  }
  document.getElementById("controls").addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    if (b.closest("summary")) e.preventDefault();
    var act = b.dataset.act, id = b.dataset.id, d = b.dataset;
    var l = id ? getLayer(id) : null;
    switch (act) {
      case "toggle": {
        /* The header stays where it is on the screen; what lies below it moves down or up. */
        var top0 = b.getBoundingClientRect().top;
        ui.open[id] = !ui.open[id]; renderPanels();
        var nb = layersEl.querySelector('button[data-act="toggle"][data-id="' + id + '"]');
        if (nb) {
          var dy = nb.getBoundingClientRect().top - top0;
          if (Math.abs(dy) > 0.5) {
            var sp = nb.parentNode;
            while (sp && sp !== document.body && !(sp.scrollHeight > sp.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(sp).overflowY))) sp = sp.parentNode;
            if (sp && sp !== document.body) sp.scrollTop += dy; else window.scrollBy(0, dy);
          }
        }
        return;
      }
      case "fontmenu": { var fi = b.parentNode.querySelector("input"); if (!menu.hidden && menuInput === fi) closeMenu(); else { fi.focus(); openMenu(fi, true); } return; }
      case "select": if (e.shiftKey || e.ctrlKey || e.metaKey) toggleSel(id); else select(id); return;
      case "pick": pickItem(id || "band", e); return;
      case "eye":
        if (id && l) l.hidden = !l.hidden; else if (!id) state.band.hidden = !state.band.hidden; else return;
        renderPanels(); renderStage(); save(); return;
      case "fav": if (l) { editTargets(l).forEach(function (t) { t.font = d.font; }); PTD.fonts.load(l.font); syncInputs(); renderStage(); save(); } return;
      case "front": moveInStack(id, 1); renderPanels(); renderStage(); save(); return;
      case "back": moveInStack(id, -1); renderPanels(); renderStage(); save(); return;
      case "bandup": moveInStack("band", 1); renderPanels(); renderStage(); save(); return;
      case "banddown": moveInStack("band", -1); renderPanels(); renderStage(); save(); return;
      case "del": actDelLayer(id); renderPanels(); renderStage(); save(); return;
      case "royal": state.cards.hand = "As Ks Qs Js 10s"; syncInputs(); renderStage(); save(); return;
      case "random": {
        var deck = [], ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"], suits = ["s", "h", "d", "c"];
        ranks.forEach(function (r) { suits.forEach(function (s) { deck.push(r + s); }); });
        for (var i = deck.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
        state.cards.hand = deck.slice(0, 5).join(" "); syncInputs(); renderStage(); save(); return;
      }
      case "freeze": if (l) freezeLayer(l, true); return;
      case "unfreeze": if (l) freezeLayer(l, false); return;
      case "paladd": { var nid = nextId("c", state.palette); state.palette.push({ id: nid, name: "New colour", hex: "#c8c8c8" }); renderPanels(); save(); return; }
      case "paldel": {
        var u = colourUsed(id); if (u.length) { say("Cannot delete: used by " + u.join(", ")); return; }
        state.palette = state.palette.filter(function (c) { return c.id !== id; }); renderPanels(); renderStage(); save(); return;
      }
      case "palreset": DEFAULT_PALETTE.forEach(function (c) { var p = PTD.scopes.pal(c.id); if (p) { p.hex = c.hex; p.name = c.name; } }); renderPanels(); renderStage(); save(); return;
      case "fontfile": fontFileFor(d.family); return;
      case "playseed": { var pt = PTD.tables.get(b.dataset.id); if (pt) { pt.players.seed = 1 + Math.floor(Math.random() * 1e6); renderPanels(); renderStage(); save(); } return; }
      case "potseed": state.cards.potSeed = 1 + Math.floor(Math.random() * 1e6); renderStage(); save(); return;
      case "muckseed": state.cards.muckSeed = 1 + Math.floor(Math.random() * 1e6); renderStage(); save(); return;
      case "jsonopen": PTD.jsonbox.open(b.dataset.part || "project"); return;
      case "partsave": savePart(b.dataset.part || "project"); return;
      case "partopen": openFile(); return;
      case "fontimport": fontFileFor(null); return;
      case "fontporcelain":
        fetch("fonts/porcelain/PORCELAIN.TTF").then(function (r) { if (!r.ok) throw new Error("not found"); return r.blob(); }).then(function (blob) {
          return PTD.fonts.importFile(new File([blob], "PORCELAIN.TTF"), null);
        }).then(function (fam) { say("Loaded the font “" + fam + "”."); renderPanels(); renderStage(); save(); },
          function () { say("Porcelain could not be fetched here. Open the page from GitHub Pages, or download PORCELAIN.TTF from the repository's fonts/porcelain folder and use Import font file."); });
        return;
      case "fontremove": PTD.fonts.remove(d.family); renderPanels(); renderStage(); save(); return;
      case "psave": projectToFile(); return;
      case "popen": openFile(); return;
      case "pnew": newProject(); return;
      case "csave": download("poker-table-designer.config.json", JSON.stringify(configJSON(), null, 1), "application/json"); projMsg("Saved the configuration."); return;
      case "copen": pickFile(document.getElementById("fileConfig"), function (t) { loadText(t); }); return;
      case "creset": config = defaultConfig(); saveConfig(); renderPanels(); renderStage(); projMsg("Configuration reset."); return;
      case "ptext": document.getElementById("projectText").value = JSON.stringify(toJSON(false), null, 1); return;
      case "pload": loadText(document.getElementById("pasteBox").value); return;
      case "papply": loadText(document.getElementById("projectText").value); return;
    }
    if (PTD.tables.act(act, d)) return;
    if (PTD.guides.act(act, d)) return;
    if (PTD.exporter && PTD.exporter.act && PTD.exporter.act(act, d)) return;
    if (PTD.sheet && PTD.sheet.act && PTD.sheet.act(act, d)) return;
    if (PTD.random && PTD.random.act && PTD.random.act(act, d)) return;
  });
  document.getElementById("addText").addEventListener("click", function () {
    var base = getLayer(state.selected) || state.layers[0];
    var n = base ? Object.assign({}, base, { frozen: null }) : mkLayer("", "Mea Culpa", 120, 0, 400, 0, 0, true, false);
    n.text = "Word"; n.x = 0; n.y = 0; n.rot = 0;
    n.id = "l" + (state.layers.length + 1);
    state.layers.push(n); state.selected = n.id; ui.extra = {}; ui.open[n.id] = true; clearOther();
    PTD.fonts.load(n.font); renderPanels(); renderStage(); save();
  });

  /* ---------- toolbar ---------- */
  document.getElementById("projectName").addEventListener("input", function (e) { state.name = e.target.value; save("name"); });
  document.getElementById("newBtn").onclick = newProject;
  document.getElementById("wrapToggle").onchange = function (e) {
    PTD.tables.visible().forEach(function (t) { t.wrapShow = e.target.checked; });
    renderPanels(); renderStage(); save();
  };
  document.getElementById("betToggle").onchange = function (e) {
    PTD.tables.visible().forEach(function (t) { t.bet.on = e.target.checked; });
    renderPanels(); renderStage(); save();
  };
  document.getElementById("pasteBtn").onclick = function () {
    setTab("project");
    var b = document.getElementById("pasteBox"); if (b) { b.focus(); b.scrollIntoView({ block: "center" }); }
  };
  document.getElementById("openBtn").onclick = openFile;
  /* Save menu: opens on click and on hover; plain Save does not save by itself. */
  var saveWrap = document.getElementById("saveWrap"), saveBtn = document.getElementById("saveBtn");
  function saveMenu(open) { saveWrap.classList.toggle("open", open); saveWrap.classList.remove("shut"); saveBtn.setAttribute("aria-expanded", open ? "true" : "false"); }
  saveBtn.onclick = function () { saveMenu(!saveWrap.classList.contains("open")); };
  saveWrap.addEventListener("mouseleave", function () { saveWrap.classList.remove("shut"); });
  document.getElementById("saveMenu").addEventListener("click", function (e) {
    var b = e.target.closest("[data-save]"); if (!b) return;
    saveMenu(false); saveWrap.classList.add("shut"); savePart(b.dataset.save);
  });
  document.addEventListener("mousedown", function (e) { if (!saveWrap.contains(e.target)) saveMenu(false); });
  undoBtn.onclick = undo; redoBtn.onclick = redo;
  document.getElementById("cloneBtn").onclick = actClone;
  document.getElementById("outlineBtn").onclick = function () { ui.outlines = !ui.outlines; renderStage(); };
  document.getElementById("deselectBtn").onclick = function () { setSelection([]); clearOther(); renderPanels(); renderStage(); };
  document.getElementById("fitBtn").onclick = fitView;
  document.querySelectorAll("[data-tool]").forEach(function (b) {
    b.onclick = function () { setTool(b.dataset.tool); };
  });
  function setTool(t) {
    ui.tool = t; if (t !== "measure") ui.measure = null;
    say(t === "measure" ? "Click two points to measure. Snapping applies; hold Alt to ignore it." : t === "guideX" ? "Click to place a vertical guide." : t === "guideY" ? "Click to place a horizontal guide." : "");
    updateToolbar(); renderStage();
  }
  document.querySelectorAll("#tabs button").forEach(function (b) { b.onclick = function () { setTab(b.dataset.tab); }; });

  /* ---------- snapping ---------- */
  function candidatesAxis(axis, opts) {
    var out = [{ v: 0, tag: "Cloth centre" }];
    state.guides.forEach(function (g) { if (!g.hidden && g.axis === axis && g.id !== (opts && opts.skipGuide)) out.push({ v: PTD.guides.abs(g), tag: g.name }); });
    var sp = PTD.tables.snapPoints();
    sp.extremes.forEach(function (x) { if (x.axis === axis && !(opts && opts.excludeTable === x.t)) out.push({ v: x.v, tag: x.tag }); });
    sp.points.forEach(function (p) { if (!(opts && opts.excludeTable === p.t)) out.push({ v: axis === "x" ? p.x : p.y, tag: p.tag }); });
    return out;
  }
  /* Snaps a point. Table points win (both axes at once), then guides and extremes per axis, then the grid. */
  function snapXY(p, opts) {
    opts = opts || {};
    var thr = 10 / ui.view.z, best = null, lines = { x: [], y: [] };
    PTD.tables.snapPoints().points.forEach(function (q) {
      if (opts.excludeTable && q.t === opts.excludeTable) return;
      var d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < thr && (!best || d < best.d)) best = { d: d, x: q.x, y: q.y };
    });
    if (Math.hypot(p.x, p.y) < thr && (!best || Math.hypot(p.x, p.y) < best.d)) best = { d: Math.hypot(p.x, p.y), x: 0, y: 0 };
    var out = { x: p.x, y: p.y };
    if (best) { out.x = best.x; out.y = best.y; lines.x.push(best.x); lines.y.push(best.y); }
    else ["x", "y"].forEach(function (ax) {
      var c = candidatesAxis(ax, opts), bd = thr, bv = null;
      c.forEach(function (k) { var dd = Math.abs(k.v - p[ax]); if (dd < bd) { bd = dd; bv = k.v; } });
      if (bv === null && config.gridMm > 0) { var gv = Math.round(p[ax] / config.gridMm) * config.gridMm; if (Math.abs(gv - p[ax]) < thr) bv = gv; }
      if (bv !== null) { out[ax] = bv; lines[ax].push(bv); }
      else out[ax] = round(p[ax], 1);
    });
    ui.snapLines = lines;
    return out;
  }
  function snapGroup(b, dx, dy, ids) {
    var thr = 8 / ui.view.z, lines = { x: [], y: [] }, res = { dx: dx, dy: dy };
    ["x", "y"].forEach(function (ax) {
      var size = ax === "x" ? b.w : b.h, lo = (ax === "x" ? b.x + dx : b.y + dy), edges = [lo, lo + size / 2, lo + size];
      var cands = candidatesAxis(ax, {}).map(function (k) { return k.v; });
      Object.keys(ui.bounds).forEach(function (k) {
        if (ids.indexOf(k) >= 0) return;
        var o = ui.bounds[k], s = ax === "x" ? o.w : o.h, st = ax === "x" ? o.x : o.y;
        cands.push(st, st + s / 2, st + s);
      });
      var bd = thr, shift = null, at = null;
      edges.forEach(function (ev) { cands.forEach(function (cv) { var dd = cv - ev; if (Math.abs(dd) < Math.abs(bd)) { bd = dd; shift = dd; at = cv; } }); });
      if (shift === null && config.gridMm > 0) {
        var gv = Math.round(edges[1] / config.gridMm) * config.gridMm;
        if (Math.abs(gv - edges[1]) < thr) { shift = gv - edges[1]; at = gv; }
      }
      if (shift !== null) { res[ax === "x" ? "dx" : "dy"] += shift; lines[ax].push(at); }
    });
    ui.snapLines = lines;
    return res;
  }

  /* ---------- pointer handling ---------- */
  function startDrag(e, h) {
    ui.dragging = true;
    function mv(ev) { h.move(toWorld(ev), ev); }
    function upf(ev) {
      ui.dragging = false;
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", upf); window.removeEventListener("pointercancel", upf);
      if (h.up) h.up(ev);
    }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", upf); window.addEventListener("pointercancel", upf);
  }
  var spaceDown = false, hoverStage = false;
  function startPan(e) {
    var sx = e.clientX, sy = e.clientY, cx = ui.view.cx, cy = ui.view.cy;
    stageWrap.classList.add("panning");
    function mv(ev) { ui.view.cx = cx - (ev.clientX - sx) / ui.view.z; ui.view.cy = cy - (ev.clientY - sy) / ui.view.z; requestRender(); }
    function upf() { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", upf); window.removeEventListener("pointercancel", upf); stageWrap.classList.remove("panning"); updateToolbar(); }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", upf); window.addEventListener("pointercancel", upf);
  }
  function dragArtwork(e, ids, p, all, toggleOff) {
    var starts = {}, bnd = {}, items = ids.slice();
    if (all) { items = state.layers.map(function (l) { return l.id; }); items.push("band"); }
    items.forEach(function (k) {
      if (k === "band") starts.band = { x: state.band.x, y: state.band.y }; else { var l = getLayer(k); starts[k] = { x: l.x, y: l.y }; }
      if (ui.bounds[k]) bnd[k] = Object.assign({}, ui.bounds[k]);
    });
    var u = null;
    Object.keys(bnd).forEach(function (k) {
      var b = bnd[k];
      u = u ? { x: Math.min(u.x, b.x), y: Math.min(u.y, b.y), x2: Math.max(u.x2, b.x + b.w), y2: Math.max(u.y2, b.y + b.h) } : { x: b.x, y: b.y, x2: b.x + b.w, y2: b.y + b.h };
    });
    if (u) u = { x: u.x, y: u.y, w: u.x2 - u.x, h: u.y2 - u.y };
    var moved = false;
    startDrag(e, {
      move: function (q, ev) {
        var dx = q.x - p.x, dy = q.y - p.y;
        if (config.snap && !ev.altKey && !ev.ctrlKey && u && !all) { var r = snapGroup(u, dx, dy, items); dx = r.dx; dy = r.dy; }
        else { dx = round(dx, 1); dy = round(dy, 1); ui.snapLines = null; }
        if (dx || dy) moved = true;
        items.forEach(function (k) {
          var o = k === "band" ? state.band : getLayer(k);
          o.x = round(starts[k].x + dx, 2); o.y = round(starts[k].y + dy, 2);
        });
        renderStage(); syncInputs();
      },
      up: function () {
        ui.snapLines = null;
        if (!moved && toggleOff) { setSelection([]); clearOther(); renderPanels(); }
        renderStage(); if (moved) save("move");
      }
    });
  }
  function marquee(e, p) {
    var add = e.shiftKey || e.ctrlKey || e.metaKey, base = add ? selectedIds() : [];
    if (!add) { setSelection([]); clearOther(); renderPanels(); }
    startDrag(e, {
      move: function (q) {
        var x0 = Math.min(p.x, q.x), y0 = Math.min(p.y, q.y), w = Math.abs(q.x - p.x), h = Math.abs(q.y - p.y);
        ui.marquee = { x: x0, y: y0, w: w, h: h };
        var hit = Object.keys(ui.bounds).filter(function (k) { var b = ui.bounds[k]; return b.x < x0 + w && b.x + b.w > x0 && b.y < y0 + h && b.y + b.h > y0; });
        var ids = base.concat(hit.filter(function (k) { return base.indexOf(k) < 0; }));
        state.selected = ids[0] || null; ui.extra = {}; ids.slice(1).forEach(function (k) { ui.extra[k] = true; });
        renderStage();
      },
      up: function () { ui.marquee = null; renderPanels(); renderStage(); }
    });
  }
  svg.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  svg.addEventListener("pointerdown", function (e) {
    closeMenu();
    if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body && !svg.contains(document.activeElement)) document.activeElement.blur();
    var p = toWorld(e);
    if (e.button === 2 || (e.button === 0 && spaceDown)) { e.preventDefault(); startPan(e); return; }
    if (e.button === 1) { e.preventDefault(); dragArtwork(e, [], p, true); return; }
    if (e.button !== 0) return;
    if (ui.tool === "measure") {
      var s = config.snap && !e.altKey ? snapXY(p, {}) : p; ui.snapLines = null;
      PTD.guides.measureClick(s); return;
    }
    if (ui.tool === "guideX" || ui.tool === "guideY") {
      var sp = config.snap && !e.altKey ? snapXY(p, {}) : { x: round(p.x, 1), y: round(p.y, 1) }; ui.snapLines = null;
      var ax = ui.tool === "guideX" ? "x" : "y"; PTD.guides.add(ax, ax === "x" ? sp.x : sp.y); setTool("select"); return;
    }
    var hnode = e.target.closest && e.target.closest("[data-h]");
    if (hnode) {
      var h = hnode.dataset.h, kind = h.split(":")[0];
      if (kind === "guide" ? PTD.guides.pointerDown(e, h, p) : PTD.tables.pointerDown(e, h, p)) { e.preventDefault(); return; }
    }
    var idn = e.target.closest && e.target.closest("[data-id]");
    if (idn) {
      var id = idn.dataset.id;
      var fromOtherTab = ui.tab !== "artwork";   /* a click on a text always brings the Artwork tab forward */
      if (fromOtherTab) setTab("artwork");
      if (e.shiftKey || e.ctrlKey || e.metaKey) { toggleSel(id); revealSelected(); return; }
      var toggleOff = !fromOtherTab && isSel(id) && selectedIds().length === 1 ? id : null;   /* a click without a drag on the only selected item deselects it */
      if (!isSel(id)) { select(id, true); }
      else { clearOther(); if (fromOtherTab) { renderPanels(); renderStage(); revealSelected(); } }
      dragArtwork(e, selectedIds(), p, false, toggleOff); return;
    }
    marquee(e, p);
  });
  svg.addEventListener("dblclick", function (e) {
    var hn = e.target.closest && e.target.closest("[data-h]");
    if (hn && PTD.tables.doubleClick(hn.dataset.h, toWorld(e))) e.preventDefault();
  });
  /* Tooltip for guides and table lines: any stage element with a data-tip attribute. */
  var tipEl = document.getElementById("tip");
  function showTip(e) {
    if (!tipEl) return;
    var n = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
    if (!n || ui.dragging) { tipEl.hidden = true; return; }
    tipEl.textContent = n.getAttribute("data-tip"); tipEl.hidden = false;
    var x = e.clientX + 14, y = e.clientY + 16, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, x)) + "px"; tipEl.style.top = Math.max(4, Math.min(window.innerHeight - h - 4, y)) + "px";
  }
  svg.addEventListener("pointerleave", function () { if (tipEl) tipEl.hidden = true; });
  svg.addEventListener("pointerdown", function () { if (tipEl) tipEl.hidden = true; }, true);
  svg.addEventListener("pointermove", function (e) {
    showTip(e);
    var p = toWorld(e);
    document.getElementById("cursorPos").textContent = "X " + fmtLen(p.x) + "   Y " + fmtLen(p.y);
    if (ui.tool === "measure") {
      var s = config.snap && !e.altKey ? snapXY(p, {}) : p; ui.snapLines = null;
      PTD.guides.measureMove(s);
    }
  });
  /* Space held over the stage: open hand, left drag pans (closed hand while dragging). */
  function spaceCursor() { stageWrap.classList.toggle("space", spaceDown && hoverStage); }
  svg.addEventListener("pointerenter", function () { hoverStage = true; spaceCursor(); });
  svg.addEventListener("pointerleave", function () { hoverStage = false; spaceCursor(); });
  window.addEventListener("blur", function () { spaceDown = false; spaceCursor(); });
  svg.addEventListener("wheel", function (e) {
    e.preventDefault();
    var before = toWorld(e), f = Math.pow(1.0018, -e.deltaY);
    ui.view.z = Math.max(0.01, Math.min(60, ui.view.z * f));
    var r = svg.getBoundingClientRect();
    ui.view.cx = before.x - (e.clientX - r.left - r.width / 2) / ui.view.z;
    ui.view.cy = before.y - (e.clientY - r.top - r.height / 2) / ui.view.z;
    requestRender();
  }, { passive: false });

  /* ---------- keyboard ---------- */
  function isTextField(t) { return t && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && /^(text|number|search)$/.test(t.type)) || t.tagName === "SELECT"); }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && saveWrap.classList.contains("open")) { saveMenu(false); saveWrap.classList.add("shut"); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); savePart("project"); return; }
    if (e.key === " " && !isTextField(e.target)) {
      if (hoverStage) {   /* over the stage Space always pans, even when a button has the focus */
        spaceDown = true; e.preventDefault();
        if (e.target.tagName === "BUTTON" && e.target.blur) e.target.blur();
        spaceCursor();
      } else if (e.target.tagName !== "BUTTON") spaceDown = true;
      return;
    }
    if (isTextField(e.target)) return;
    var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === "y") { e.preventDefault(); redo(); return; }
    if (mod && k === "a") { e.preventDefault(); setSelection(stackIds()); return; }
    if (e.key === "Escape") { setTool("select"); ui.measure = null; return; }
    if (PTD.tables.key(e)) { e.preventDefault(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && ui.selGuide) { var gid = ui.selGuide; PTD.guides.remove(gid); e.preventDefault(); return; }
    var arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key]) {
      var stepMm = e.shiftKey ? 10 : 1, dx = arrows[e.key][0] * stepMm, dy = arrows[e.key][1] * stepMm;
      var t = PTD.tables.get(ui.selTable), g = PTD.guides.get(ui.selGuide);
      if (t && !t.locked) { t.x += dx; t.y += dy; }
      else if (g && !g.locked) { var pos = PTD.guides.abs(g) + (g.axis === "x" ? dx : dy); var r = PTD.guides.resolve({ id: g.id, axis: g.axis, pos: pos }); if (r.ok) PTD.guides.setAbs(g, pos); else say(PTD.guides.conflictText(r)); }
      else { selectedIds().forEach(function (id) { var o = id === "band" ? state.band : getLayer(id); if (o) { o.x += dx; o.y += dy; } }); }
      e.preventDefault(); renderStage(); syncInputs(); save("nudge"); return;
    }
  });
  document.addEventListener("keyup", function (e) {
    if (e.key !== " ") return;
    if (hoverStage && !isTextField(e.target)) e.preventDefault();   /* no button click from the released Space */
    spaceDown = false; spaceCursor();
  });

  /* ---------- start ---------- */
  function boot() {
    PTD.core = {
      state: function () { return state; }, cfg: function () { return config; }, ui: ui, esc: esc, h: H, fmtLen: fmtLen, colorHex: colorHex, colourId: colourId,
      el: el, eyeBtn: eyeBtn, nextId: nextId, setTab: setTab, renderPanels: renderPanels, renderStage: renderStage, syncInputs: syncInputs,
      save: save, say: say, toPartJSON: toPartJSON, savePart: savePart, openFile: openFile, startDrag: startDrag, snapXY: snapXY, afterFont: afterFont, download: download, toJSON: toJSON, parseHand: parseHand,
      cardLayout: cardLayout, cardSize: cardSize, drawArtwork: drawArtwork, drawObjects: drawObjects, makeGradients: makeGradients, parseHandX: null, unitF: unitF, getLayer: getLayer, slug: slug, mix: mix, round: round, fitView: fitView, fontFamilyCss: fontFamilyCss,
      loadText: loadText, deselectAll: deselectAll, mkLayer: mkLayer, normLayer: normLayer, groupBegin: groupBegin, groupEnd: groupEnd
    };
    try { config = normConfig(JSON.parse(localStorage.getItem(KEY_CONFIG) || "null")); } catch (e) { config = defaultConfig(); }
    state = defaults();
    var loaded = false;
    try {
      var fr = localStorage.getItem(KEY_FONTS);
      if (fr) PTD.fonts.restoreStorage(JSON.parse(fr));
      var raw = localStorage.getItem(KEY_PROJECT), legacy = localStorage.getItem(KEY_LEGACY);
      if (raw) { var o = JSON.parse(raw); adoptProject(o); loaded = true; }
      else if (legacy) { adoptProject(JSON.parse(legacy)); loaded = true; }
    } catch (e) { loaded = false; }
    if (!loaded) { state = defaults(); PTD.guides.resolve(); state.layers.forEach(function (l) { PTD.fonts.load(l.font); }); }
    renderPanels(); renderStage();
    fitView();
    hist.last = snapshot(); updateHistoryButtons();
    if (window.ResizeObserver) new ResizeObserver(function () { requestRender(); }).observe(stageWrap);
    document.fonts.addEventListener("loadingdone", requestRender);
    window.addEventListener("resize", requestRender);
  }
  boot();
})(window.PTD = window.PTD || {});
