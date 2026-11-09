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
  var ui = { tool: "select", outlines: true, view: { cx: 0, cy: 0, z: 0.25 }, open: {}, extra: {}, marquee: null, bounds: {}, tbox: {}, fontHold: {},
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
      outline: true, outlineAuto: true, outlineColor: "felt", outlineW: 3, x: x, y: y, frozen: null, box: null, uid: "",
      nameWord: false, gen: "", styleHidden: false, exact: true   /* exact: the visible text is centred on x (new texts); older saved texts keep the browser's centring, which includes one trailing letter space. Part of the casino name; made by a randomizer name style; hidden by a name style */
    };
  }
  /* The artwork origin: the point every text, the lines and the hand are measured from. It is a free point on the
   * cloth, given as x and y in mm from the cloth centre (the default is the cloth centre itself), and it never moves
   * by itself. `distance` and `table` only feed the quick button that places it that far in from the dealer edge. */
  function defaultOrigin() { return { x: 0, y: 0, distance: 300, table: "" }; }
  function normOrigin(o) {
    var d = defaultOrigin(), r = Object.assign(d, o && typeof o === "object" ? o : {});
    r.x = num(r.x, 0); r.y = num(r.y, 0); r.distance = Math.max(0, num(r.distance, 300)); r.table = String(r.table || "");
    delete r.mode; delete r.sideways;
    return r;
  }
  /* The table the quick button measures from: the chosen one, else the first visible one. */
  function anchorTable() {
    var vis = PTD.tables.visible(), id = state.origin.table;
    return vis.filter(function (t) { return t.id === id; })[0] || vis[0] || null;
  }
  /* The point `dist` mm in from the dealer position of a table (the bottom of the notch when there is one). */
  function edgePoint(t, dist) {
    var f = PTD.tables.dealerFrame(t);
    return { x: f.x - f.nx * dist, y: f.y - f.ny * dist };
  }
  function artOrigin() { return { x: state.origin.x, y: state.origin.y }; }
  function placeOrigin() {
    var t = anchorTable();
    if (!t) { say("There is no visible table to measure from."); return; }
    var p = edgePoint(t, state.origin.distance);
    state.origin.x = round(p.x, 1); state.origin.y = round(p.y, 1);
    renderStage(); syncInputs(); save("origin:place");
    say("Artwork origin placed " + fmtLen(state.origin.distance) + " in from the dealer edge of " + t.name + ".");
  }
    function defaultArtwork() {
    /* positions are measured from the artwork origin, which starts at the cloth centre */
    var big1 = mkLayer("Molino", "Mea Culpa", 170, 0, 400, -170, -65, true, false), big2 = mkLayer("Royale", "Mea Culpa", 170, 0, 400, 190, -65, true, false);
    big1.outline = false; big2.outline = false; big1.nameWord = true; big2.nameWord = true;   /* the two big texts have no outline by default; every other text and the lines do */
    return {
      origin: defaultOrigin(), casinoName: "Molino Royale",
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
      pxmm: 0.5, picObjects: true, bTable: "", bTex: 4096, bTableH: 740, bRailH: 50,
      cutter: "", format: "svg", useCalib: true, useKerf: true, scaleX: 1, scaleY: 1, scaleLock: true, texts: true, upper: true, lower: true, sel: false, keepPos: false, jobName: "", jobs: [] };
  }
  function defaults() {
    var a = defaultArtwork();
    var d0 = {
      name: "Molino Royale", casinoName: a.casinoName, origin: a.origin, layers: a.layers.map(function (l, i) { l.id = "l" + (i + 1); return l; }), band: a.band, cards: a.cards, selected: "l1",
      cloth: { real: false, w: 3200, h: 2000, x: 0, y: 0, color: "felt" },
      tables: [PTD.tables.make("t1", "Table 1", "stadium", 0)], guides: [], constraints: [], measures: [], cpoints: [], graph: { nodes: [], wires: [] },
      palette: DEFAULT_PALETTE.map(function (c) { return Object.assign({}, c); }), fonts: [], export: defaultExport(), words: PTD.words.defaultProject()
    };
    ensureUids(d0.layers);
    return d0;
  }
  function normLayer(l, i, fb) {
    var base = mkLayer("", "Mea Culpa", 100, 0, 400, 0, 0, true, false);
    base.exact = false;   /* saved data without the field keeps its old centring */
    base.outline = false;   /* saved data without the field keeps its old look; only new texts start with an outline */
    var m = Object.assign(base, l || {});
    m.id = "l" + (i + 1);
    m.text = String(m.text == null ? "" : m.text);
    m.font = String(m.font || "Mea Culpa");
    ["size", "ls", "weight", "rot", "opacity", "capScale", "outlineW", "x", "y"].forEach(function (k) { m[k] = num(m[k], base[k]); });
    ["italic", "upper", "gradient", "hidden", "cap", "capAll", "outline", "outlineAuto", "nameWord", "styleHidden", "locked", "exact"].forEach(function (k) { m[k] = !!m[k]; });
    m.gen = ["split", "mono"].indexOf(m.gen) >= 0 ? m.gen : "";
    m.uid = String(m.uid || "");
    m.group = String(m.group || "");   /* the uid of the group the text is in (REQ-008) */
    m.color = colourId(m.color, "gold");
    m.outlineColor = colourId(m.outlineColor, "felt");
    if (!(m.frozen && typeof m.frozen.d === "string")) m.frozen = null;
    if (m.pattern) {   /* a pattern (REQ-047): a glyph-like layer whose shape is made from a recipe; the shape is cached in millimetres */
      m.pattern = { out: String(m.pattern.out || "") };
      if (!m.frozen) m.frozen = { d: "M0 0Z", x0: 0, y0: 0, x1: 1, y1: 1 };
      m.glyph = true; m.gen = ""; m.group = "";
    } else m.pattern = null;
    m.glyph = !!m.glyph && !!m.frozen && m.frozen.y1 > m.frozen.y0;   /* a glyph (REQ-033) is a frozen layer whose shape is scaled by its size */
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
    /* files from before the origin existed keep their look: their positions are measured from the cloth centre */
    var v33 = art.origin && art.origin.mode ? art.origin : null;   /* a V33 file: the origin followed the table, now it is a fixed point */
    s.origin = art.origin ? normOrigin(art.origin) : normOrigin(null);
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
    /* files from before the casino name existed: the big texts (at least 60 % of the biggest size) are the name */
    if (s.layers.length && !arr.some(function (l) { return l && l.nameWord !== undefined; })) {
      var big = s.layers.reduce(function (a, l) { return Math.max(a, l.size); }, 0);
      s.layers.forEach(function (l) { l.nameWord = l.size >= big * 0.6; });
    }
    s.casinoName = typeof art.casinoName === "string" ? art.casinoName :
      s.layers.filter(function (l) { return l.nameWord && !l.gen; }).map(function (l) { return l.text.trim(); }).filter(Boolean).join(" ");
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
    if (v33) {
      var vis = s.tables.filter(function (t) { return t.visible; }), at = vis.filter(function (t) { return t.id === v33.table; })[0] || vis[0];
      var edge = v33.mode === "edge" || (v33.mode === "auto" && vis.length === 1);
      if (edge && at) { var q = edgePoint(at, num(v33.distance, 300)), f = PTD.tables.dealerFrame(at); s.origin.x = round(q.x + f.ex * num(v33.sideways, 0), 1); s.origin.y = round(q.y + f.ey * num(v33.sideways, 0), 1); }
      else { s.origin.x = num(v33.sideways, 0); s.origin.y = 0; }
    }
    s.guides = (Array.isArray(o.guides) ? o.guides : []).map(function (g, i) { return PTD.guides.normalize(g, String((g && g.id) || "g" + (i + 1))); });
    s.constraints = (Array.isArray(o.constraints) ? o.constraints : []).map(function (c, i) { return PTD.guides.normalizeCons(c, String((c && c.id) || "c" + (i + 1))); });
    var gids = {}; s.guides.forEach(function (g) { gids[g.id] = 1; });
    s.constraints = s.constraints.filter(function (c) { return c.ids.length && c.ids.every(function (i) { return gids[i]; }); });
    s.fonts = []; s.export = PTD.exporter.norm(Object.assign(defaultExport(), o.export || {}));
    s.words = PTD.words.normProject(o.words);
    s.measures = PTD.measure.normalize(o.measures);
    ensureUids(s.layers);
    s.graph = PTD.graph.norm(art.graph);   /* the procedural graph (REQ-049) */
    s.groups = PTD.groups.normalizeAll(art.groups); PTD.groups.settle(s);   /* groups of texts (REQ-008) */
    s.cpoints = PTD.cpoints.normalize(o.cpoints, s);   /* after the uids: a point hangs on a text by its uid */
    s.selected = s.layers.length ? s.layers[0].id : "band";
    return s;
  }
  function defaultProjectJSON() {
    var d = defaults();
    return { format: PROJECT_FORMAT, version: 1, name: d.name, artwork: { origin: d.origin, casinoName: d.casinoName, layers: d.layers, band: d.band, cards: d.cards, groups: [], graph: { nodes: [], wires: [] } }, cloth: d.cloth,
      tables: d.tables, guides: [], constraints: [], measures: [], cpoints: [], palette: d.palette, fonts: [], export: d.export, words: PTD.words.projectJSON(d.words) };
  }
  /* The view switches, the randomizer settings and the cutter profile belong to the project, but they are not
   * part of the undo history (switching a view option is not a design step). They live in `config` and `PTD.random.opts`
   * while the project is open. */
  var VIEW_KEYS = ["showExtremes", "showGrid", "gridMm", "showCentre", "showOrigin", "showDealer", "showNames", "showMeasures", "dimOutside", "preview"];
  function viewJSON() { var v = {}; VIEW_KEYS.forEach(function (k) { v[k] = config[k]; }); return v; }
  function applySession(o) {
    var v = o && o.view && typeof o.view === "object" ? o.view : {}, dv = defaultConfig();
    var nv = normConfig(Object.assign({}, dv, v));
    VIEW_KEYS.forEach(function (k) { config[k] = nv[k]; });
    if (PTD.random && PTD.random.setOpts) PTD.random.setOpts(o && o.randomizer);
  }
  function toJSON(forFile, forHistory) {
    var s = state;
    var out = {
      format: PROJECT_FORMAT, version: 1, name: s.name,
      artwork: { origin: s.origin, casinoName: s.casinoName, layers: s.layers.map(function (l) { var c = Object.assign({}, l); delete c.id; return c; }), band: s.band, cards: s.cards, groups: (s.groups || []).map(function (g) { return Object.assign({}, g); }), graph: JSON.parse(JSON.stringify(s.graph || { nodes: [], wires: [] })) },
      cloth: s.cloth, tables: s.tables, guides: s.guides, constraints: s.constraints, measures: s.measures || [], cpoints: s.cpoints || [], palette: s.palette,
      fonts: forFile ? PTD.fonts.toProject() : s.fonts, export: s.export, words: PTD.words.projectJSON(s.words)
    };
    if (!forHistory) {
      out.view = viewJSON();
      out.randomizer = PTD.random && PTD.random.opts ? JSON.parse(JSON.stringify(PTD.random.opts)) : undefined;
    }
    return out;
  }
  /* One part of the project as a file: "artwork" (texts, lines, cards, cloth, fonts and colours used) or "tables"
   * (tables with player-area lines, guides, constraints, colours used). "project" is everything. Same format, parts left out. */
  function toPartJSON(part, forFile) {
    if (part === "words") return Object.assign({ format: PTD.words.FORMAT, version: 1, name: state.name }, PTD.words.projectJSON(state.words));
    if (part === "universal") return PTD.words.universal();
    if (part === "settings") return configJSON();
    if (part === "cutters") return PTD.cutters.toJSON();
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
  function adoptProject(o, keepSession) {
    ui.fontHold = {};
    if (PTD.random) PTD.random.stop();
    var keepFonts = o && o.fonts;
    var s = fromJSON(o);
    state = s;
    state.fonts = (PTD.fonts.fromProject(keepFonts || []));
    ui.extra = {}; ui.selTable = null; ui.selNode = null; ui.selGuide = null; ui.conflicts = []; ui.measure = null; ui.dim = null; ui.selMeasure = null;
    PTD.guides.resolve();
    if (!keepSession) applySession(o);
    state.layers.forEach(function (l) { PTD.fonts.load(l.font); });
  }

  /* ---------- configuration ---------- */
  function defaultConfig() {
    return { units: "mm", snap: true, preview: "shaded", dimOutside: false, showExtremes: false, showGrid: false, gridMm: 50, showCentre: true, showOrigin: true, showDealer: true, showNames: true, showMeasures: true, traceRes: 10, dragReadout: true, keepOriginal: false, openOnSelect: true,
      layout: { sideW: 430, sideOpen: true, dockH: 300 }, cutters: [PTD.cutters.make(1)], pressMm: 380, favouriteFonts: PTD.fonts.FAVS.slice(), favsSeed: 2, hitMode: "shape" };
  }
  function normConfig(o) {
    var c = Object.assign(defaultConfig(), o || {});
    delete c.palette;   /* the palette is part of the project now */
    if (c.words) { var wd = PTD.words.normalize(c.words); c.words = PTD.words.count(wd) ? wd : null; } else delete c.words;
    if (!UNIT_MM[c.units]) c.units = "mm";
    c.snap = c.snap !== false; c.dimOutside = !!c.dimOutside; c.showExtremes = !!c.showExtremes; c.showGrid = !!c.showGrid; c.showCentre = c.showCentre !== false; c.showOrigin = c.showOrigin !== false; c.showDealer = c.showDealer !== false; c.showNames = c.showNames !== false; c.showMeasures = c.showMeasures !== false; c.traceRes = Math.max(2, Math.min(40, num(c.traceRes, 10)));
    c.preview = c.preview === "flat" ? "flat" : "shaded";
    c.hitMode = c.hitMode === "box" || c.hitMode === "geom" || c.hitMode === "buffer" ? c.hitMode : "shape"; c.keepOriginal = !!c.keepOriginal; c.dragReadout = c.dragReadout !== false; c.openOnSelect = c.openOnSelect !== false;   /* an option (REQ-018): the value next to the pointer while dragging */
    if (o && !Array.isArray(o.cutters) && (o.cutter || o.calib)) {   /* older settings had one cutter and one calibration length */
      var oc = c.cutter && typeof c.cutter === "object" ? c.cutter : {}, ol = c.calib && c.calib.lengthMm ? Number(c.calib.lengthMm) : 480;
      c.cutters = [{ name: oc.name || "Cutter 1", widthMm: oc.widthMm || 500, maxLengthMm: oc.maxLengthMm || 0, calib: { margin: c.calib && c.calib.marginMm, x: { lengths: [100, 250, Math.max(60, Math.min(oc.widthMm || 500, ol))] }, y: { lengths: [100, 250, ol] } } }];
    }
    c.cutters = PTD.cutters.normList(c.cutters);
    delete c.cutter; delete c.cutterProfiles; delete c.calib;
    var lo = c.layout && typeof c.layout === "object" ? c.layout : {};   /* sizes of the panes (REQ-054): the settings of the user, not of the project */
    c.layout = { sideW: Math.max(240, Math.min(1400, Math.round(num(lo.sideW, 430)))), sideOpen: lo.sideOpen !== false, dockH: Math.max(120, Math.min(1400, Math.round(num(lo.dockH, 300)))) };
    c.pressMm = Math.max(0, num(c.pressMm, 380));
    c.gridMm = Math.max(0, num(c.gridMm, 50));
    if (!Array.isArray(c.favouriteFonts)) c.favouriteFonts = PTD.fonts.FAVS.slice();
    if (c.favsSeed !== 2) {   /* one-time: older saved configs gain the two core fonts */
      ["Mea Culpa", "Josefin Sans"].forEach(function (f) { if (c.favouriteFonts.indexOf(f) < 0) c.favouriteFonts.unshift(f); });
      c.favsSeed = 2;
    }
    return c;
  }
  /* The settings file: units, snapping, cutter, favourite fonts and the user's own universal words. The view switches
   * are saved with each project, so they are left out here. */
  function configJSON() {
    var o = Object.assign({ format: CONFIG_FORMAT, version: 1 }, config);
    VIEW_KEYS.forEach(function (k) { delete o[k]; });
    if (!o.words) delete o.words;
    return o;
  }
  var cfgTimer;
  function saveConfig() {
    clearTimeout(cfgTimer);
    cfgTimer = setTimeout(function () { try { localStorage.setItem(KEY_CONFIG, JSON.stringify(configJSON())); } catch (e) {} }, 300);
    scheduleAutosave();   /* a changed view switch belongs to the project */
  }

  /* ---------- history and autosave ---------- */
  var undoBtn = document.getElementById("undoBtn"), redoBtn = document.getElementById("redoBtn");
  function snapshot() { return JSON.stringify(toJSON(false, true)); }
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
  /* Every text keeps a permanent uid (the l1, l2 ... ids are renumbered when a text is deleted), so measurements can follow it. */
  function ensureUids(layers) {
    var seen = {}, max = 0;
    layers.forEach(function (l) { var n = parseInt(String(l.uid).slice(1), 10); if (l.uid && isFinite(n) && n > max) max = n; });
    layers.forEach(function (l) { if (!l.uid || seen[l.uid]) l.uid = "u" + (++max); seen[l.uid] = 1; });
  }
  function save(tag) {
    ensureUids(state.layers);
    if (PTD.groups) PTD.groups.prune(state);   /* groups that lost their members go away */
    var cur = snapshot();
    if (hist.last !== null && cur !== hist.last && !grp) {
      var now = Date.now();
      if (tag && tag === hist.tag && now - hist.time < 1200) { /* merged into the previous step */ }
      else { hist.undo.push(hist.last); trimHistory(); }
      hist.redo = []; hist.tag = tag || null; hist.time = now;
    }
    if (cur !== hist.last) curTab().dirty = true;
    hist.last = cur;
    updateHistoryButtons();
    scheduleAutosave();
  }
  /* ---------- project tabs ---------- */
  /* Each project is a tab with its own undo history and its own autosave key. The open tab lives in `state`; the other
   * tabs are kept as JSON text. The tab list (order and active tab) is autosaved under KEY_TABS. */
  var KEY_TABS = "poker-table-designer-tabs-v1", KEY_TAB = "poker-table-designer-tab-";
  var tabs = [], activeId = null, tabSeq = 0;
  function newHist() { return { undo: [], redo: [], last: null, tag: null, time: 0 }; }
  function curTab() { return tabs.filter(function (t) { return t.id === activeId; })[0] || (tabs[0] = tabs[0] || { id: "p1", json: null, hist: hist, dirty: false }); }
  function tabById(id) { return tabs.filter(function (t) { return t.id === id; })[0]; }
  function newTabId() { var id; do { id = "p" + (++tabSeq); } while (tabById(id)); return id; }
  function fullSnapshot() { return JSON.stringify(toJSON(false)); }
  function writeAutosave() {
    try {
      var t = curTab(); t.json = fullSnapshot(); t.name = state.name;
      tabs.forEach(function (x) { if (x.json) localStorage.setItem(KEY_TAB + x.id, x.json); });
      localStorage.setItem(KEY_TABS, JSON.stringify({ active: activeId, ids: tabs.map(function (x) { return x.id; }) }));
      try { localStorage.setItem(KEY_FONTS, JSON.stringify(PTD.fonts.dataForStorage())); } catch (e2) { localStorage.removeItem(KEY_FONTS); }
    } catch (e) {}
  }
  function scheduleAutosave() { clearTimeout(autoTimer); autoTimer = setTimeout(writeAutosave, 500); }
  function stashActive() { var t = curTab(); t.json = fullSnapshot(); t.name = state.name; t.hist = hist; }
  function showTab(t) {
    var h = t.hist || newHist();
    hist = h;   /* every tab keeps its own history object */
    adoptProject(JSON.parse(t.json));
    activeId = t.id; t.hist = h;
    if (hist.last === null) { hist.last = snapshot(); }
    updateHistoryButtons(); renderPanels(); renderStage(); renderTabs(); fitView();
  }
  function switchTab(id) {
    if (id === activeId || !tabById(id)) return;
    clearTimeout(autoTimer);
    stashActive(); showTab(tabById(id)); writeAutosave();
  }
  /* A new tab with the given project JSON (default project when omitted). */
  function addTab(json, atIndex) {
    stashActive();
    var t = { id: newTabId(), name: "", json: JSON.stringify(json || defaultProjectJSON()), hist: newHist(), dirty: false };
    tabs.splice(atIndex == null ? tabs.length : atIndex, 0, t);
    showTab(t); writeAutosave();
    return t;
  }
  function duplicateTab() {
    stashActive();
    var o = JSON.parse(curTab().json); o.name = o.name + " copy";
    addTab(o, tabs.indexOf(curTab()) + 1);
  }
  function closeTab(id) {
    var t = tabById(id); if (!t) return;
    var h = t.id === activeId ? hist : t.hist, untouched = !t.dirty && !(h && (h.undo.length || h.redo.length));   /* an untouched tab closes without a question */
    if (!untouched && window.confirm && !window.confirm("Are you sure you want to close “" + (t.name || "project") + "”?" + (t.dirty ? " It has changes that were not saved to a file." : ""))) return;
    var i = tabs.indexOf(t);
    if (tabs.length === 1) {   /* the last tab: a fresh empty project takes its place */
      try { localStorage.removeItem(KEY_TAB + t.id); } catch (e) {}
      var f = { id: newTabId(), name: "", json: JSON.stringify(defaultProjectJSON()), hist: newHist(), dirty: false };
      tabs = [f]; showTab(f); writeAutosave(); return;
    }
    var wasActive = t.id === activeId;
    stashActive(); tabs.splice(i, 1);
    try { localStorage.removeItem(KEY_TAB + t.id); } catch (e) {}
    if (wasActive) showTab(tabs[Math.max(0, i - 1)]); else renderTabs();
    writeAutosave();
  }
  function moveTab(id, to) {
    var t = tabById(id); if (!t) return;
    var i = tabs.indexOf(t); to = Math.max(0, Math.min(tabs.length - 1, to));
    tabs.splice(i, 1); tabs.splice(to, 0, t); renderTabs(); scheduleAutosave();
  }
  var tabBar = document.getElementById("ptabs");
  function renderTabs() {
    if (!tabBar) return;
    var t0 = curTab(); t0.name = state.name;
    tabBar.innerHTML = tabs.map(function (t) {
      return '<span class="ptab' + (t.id === activeId ? " on" : "") + '" draggable="true" data-tab-id="' + t.id + '" role="tab" aria-selected="' + (t.id === activeId) + '">' +
        '<button type="button" class="ptabname" data-tabact="go" data-tab-id="' + t.id + '" title="Switch to this project">' + esc(t.name || "Project") + (t.dirty ? " •" : "") + '</button>' +
        '<button type="button" class="ptabx" data-tabact="close" data-tab-id="' + t.id + '" title="Close this project tab" aria-label="Close tab">×</button></span>';
    }).join("") +
      '<button type="button" class="tbtn" data-tabact="new" title="New empty project in a new tab">+ New project</button>' +
      '<button type="button" class="tbtn" data-tabact="dup" title="Copy this project into a new tab">Duplicate tab</button>' +
      '<button type="button" class="tbtn" data-tabact="openNew" title="Open a project file in a new tab">Open in new tab</button>' +
      '<button type="button" class="tbtn" data-tabact="left" title="Move this tab left">◀</button>' +
      '<button type="button" class="tbtn" data-tabact="right" title="Move this tab right">▶</button>';
  }
  if (tabBar) {
    tabBar.addEventListener("click", function (e) {
      var b = e.target.closest("[data-tabact]"); if (!b) return;
      var a = b.dataset.tabact, id = b.dataset.tabId;
      if (a === "go") switchTab(id); else if (a === "close") closeTab(id);
      else if (a === "new") addTab(); else if (a === "dup") duplicateTab();
      else if (a === "openNew") pickFile(document.getElementById("fileProject"), function (t) { openInNewTab(t); });
      else if (a === "left") moveTab(activeId, tabs.indexOf(curTab()) - 1);
      else if (a === "right") moveTab(activeId, tabs.indexOf(curTab()) + 1);
    });
    var dragId = null;
    tabBar.addEventListener("dragstart", function (e) { var t = e.target.closest && e.target.closest("[data-tab-id].ptab"); if (!t) return; dragId = t.dataset.tabId; try { e.dataTransfer.setData("text/plain", dragId); } catch (x) {} });
    tabBar.addEventListener("dragover", function (e) { if (dragId) e.preventDefault(); });
    tabBar.addEventListener("drop", function (e) {
      var t = e.target.closest && e.target.closest(".ptab"); if (!dragId || !t) return;
      e.preventDefault(); moveTab(dragId, tabs.indexOf(tabById(t.dataset.tabId))); dragId = null;
    });
  }
  /* Opens file text in a new tab: the file is merged onto a default project, as in a fresh start. */
  function openInNewTab(text) {
    addTab();
    var r = loadText(text);
    if (!r.ok) closeTabNow();
    else curTab().dirty = false;
    renderTabs();
  }
  function closeTabNow() { var t = curTab(); t.dirty = false; closeTab(t.id); }
  function restore(snap) {
    var sel = state.selected;
    adoptProject(JSON.parse(snap), true);
    if (!sel) state.selected = null;   /* nothing was selected (for example after Random): keep it that way */
    else if (state.layers.some(function (l) { return l.id === sel; }) || sel === "band") state.selected = sel;
    hist.last = snap; hist.tag = null;
    updateHistoryButtons();
    renderPanels(); renderStage();
    scheduleAutosave(); renderTabs();
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
  function clearOther() { ui.selTable = null; ui.selNode = null; ui.selGuide = null; ui.selCp = null; ui.selBet = null; }
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
    state.selected = id; ui.extra = {}; ui.areaSel = false;
    if (id) setTab("artwork");
    renderPanels(); renderStage();
    revealSelected();
  }
  /* Scrolls the selected element's panel into view in the Artwork list. */
  /* With several texts selected only the topmost one in the list opens (REQ-025). */
  function openTopmostSelected() {
    if (!config.openOnSelect) return;
    var best = null;
    selectedIds().forEach(function (k) { var l = getLayer(k); if (!l) return; var o = panelOrder(state.layers.indexOf(l)); if (!best || o < best.o) best = { o: o, l: l }; });
    if (best) { ui.open[best.l.id] = true; GR.chain(state, best.l).forEach(function (g) { g.open = true; }); }
  }
  function revealSelected() {
    if (ui.tab !== "artwork" || !state.selected) return;
    var n = state.selected === "band" ? bandPanel : layersEl.querySelector('[data-panel="' + state.selected + '"]');
    if (n && n.scrollIntoView) n.scrollIntoView({ block: "nearest" });
  }
  function toggleSel(id) {
    var ids = selectedIds(), i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1); else ids.push(id);
    ui.areaSel = false; setSelection(ids);
  }
  function pickItem(id, e) { if (e.shiftKey || e.ctrlKey || e.metaKey) toggleSel(id); else select(id, true); }
  function stackIds() { var a = state.layers.map(function (l) { return l.id; }); a.splice(state.band.at, 0, "band"); return a; }
  function moveInStack(id, dir) {
    var l = id === "band" ? "band" : getLayer(id);
    if (l) GR.move(state, id === "band" ? "band" : { l: l }, dir);   /* a group moves as one block; a text inside a group stays inside it */
  }

  /* Stack order of the selection: "front", "back" (all the way) or "up", "down" (one step), the same words as in any drawing program.
     The selected things keep their order among themselves; a group moves as one block. */
  function actStack(how) {
    var ids = selectedIds(); if (!ids.length) return;
    var before = stackIds().join();
    var pos = function (u) { return u.g ? Math.min.apply(null, GR.layersIn(state, u.g.uid).map(function (l) { return stackIds().indexOf(l.id); })) : stackIds().indexOf(u.id); };
    var up = how === "front" || how === "up", all = how === "front" || how === "back";
    var asc = how === "front" || how === "down";   /* the order in which the selected things move, so that they keep their order among themselves */
    /* A text that is in a group moves with its whole outermost group, as one block: the order inside the group stays as it is. */
    var units = [];
    ids.forEach(function (id) {
      var l = id === "band" ? null : getLayer(id), top = l ? GR.top(state, l) : null, u = top ? { g: top } : { id: id };
      if (!units.some(function (x) { return u.g ? x.g === u.g : x.id === u.id; })) units.push(u);
    });
    units.sort(function (a, b) { return asc ? pos(a) - pos(b) : pos(b) - pos(a); });
    units.forEach(function (u) {
      for (var n = 0, cur = stackIds().join(); n < 400; n++) {
        if (u.g) GR.move(state, { g: u.g }, up ? 1 : -1); else moveInStack(u.id, up ? 1 : -1);
        var now = stackIds().join(); if (now === cur) break; cur = now;
        if (!all) break;
      }
    });
    if (stackIds().join() === before) { say(up ? "Already at the top." : "Already at the bottom."); return; }
    renderPanels(); renderStage(); save("stack:" + Date.now());
    say({ front: "Brought to the front.", back: "Sent to the back.", up: "Brought forward one step.", down: "Sent backward one step." }[how]);
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
  /* ---- hit testing helpers (see the comment in renderStage) ---- */
  function hitMode() { var m = config.hitMode; return m === "box" || m === "geom" || m === "buffer" ? m : "shape"; }
  var scratch = null;
  function scratchCtx() { if (!scratch) { var c = document.createElement("canvas"); c.width = c.height = 1; scratch = c.getContext("2d"); } return scratch; }
  function entHits(e, qx, qy) {   /* (qx,qy) in artwork coordinates */
    if (e.rot) { var a = -e.rot * Math.PI / 180, dx = qx - e.px, dy = qy - e.py, c = Math.cos(a), sn = Math.sin(a); qx = e.px + dx * c - dy * sn; qy = e.py + dx * sn + dy * c; }
    if (!e.fz) { var r = e.rect; return qx >= r.x && qx <= r.x + r.w && qy >= r.y && qy <= r.y + r.h; }
    if (!e.path2d) e.path2d = new Path2D(e.fz.d);
    var cx = scratchCtx(), u = (qx - e.lx) / e.gk, w = (qy - e.ly) / e.gk;
    if (cx.isPointInPath(e.path2d, u, w, e.rule)) return true;
    cx.lineWidth = e.sw / e.gk; cx.lineJoin = "round";
    return cx.isPointInStroke(e.path2d, u, w);
  }
  function pickGeom(p) {
    var AO = artOrigin(), l = ui.pickList || [], qx = p.x - AO.x, qy = p.y - AO.y;
    for (var i = l.length - 1; i >= 0; i--) if (entHits(l[i], qx, qy)) return l[i].id;
    return null;
  }
  function pickBuffer(e) {
    var l = ui.pickList || [], s = stageSize(), v = ui.view, AO = artOrigin();
    if (!ui.idbuf || ui.idbuf.w !== Math.ceil(s.w) || ui.idbuf.h !== Math.ceil(s.h)) {
      var cv = document.createElement("canvas"); cv.width = Math.ceil(s.w); cv.height = Math.ceil(s.h);
      var cx = cv.getContext("2d", { willReadFrequently: true });
      l.forEach(function (en, i) {
        var n = i + 1, col = "rgb(" + (n & 255) + "," + (n >> 8) + "," + (((n & 255) ^ (n >> 8) ^ 90) & 255) + ")";
        cx.setTransform(v.z, 0, 0, v.z, s.w / 2 - v.cx * v.z + AO.x * v.z, s.h / 2 - v.cy * v.z + AO.y * v.z);
        if (en.rot) cx.rotate(en.rot * Math.PI / 180, en.px, en.py);
        cx.fillStyle = col; cx.strokeStyle = col;
        if (en.fz) {
          cx.translate(en.lx, en.ly); cx.scale(en.gk, en.gk);
          if (!en.path2d) en.path2d = new Path2D(en.fz.d);
          cx.lineWidth = en.sw / en.gk; cx.lineJoin = "round"; cx.stroke(en.path2d); cx.fill(en.path2d, en.rule);
        } else cx.fillRect(en.rect.x, en.rect.y, en.rect.w, en.rect.h);
      });
      ui.idbuf = { w: cv.width, h: cv.height, cx: cx };
    }
    var r = svg.getBoundingClientRect(), x = Math.floor(e.clientX - r.left), y = Math.floor(e.clientY - r.top);
    if (x < 0 || y < 0 || x >= ui.idbuf.w || y >= ui.idbuf.h) return null;
    var d = ui.idbuf.cx.getImageData(x, y, 1, 1).data;
    if (d[3] !== 255) return null;
    var n = d[0] | (d[1] << 8);
    if (!n || n > l.length || d[2] !== (((n & 255) ^ (n >> 8) ^ 90) & 255)) return null;   /* an anti-aliased edge pixel is not a valid code */
    return l[n - 1].id;
  }
  /* The item under an event: PTD.idOf(target) is what the other modules use instead of target.closest("[data-id]"). */
  function pickFor(e) {
    var m = hitMode(); if (m === "box" || m === "shape") return null;
    return m === "geom" ? pickGeom(toWorld(e)) : pickBuffer(e);
  }
  function idOf(target) {
    var m = hitMode(), hn = target && target.closest && target.closest("[data-h]");
    if (m === "box" || m === "shape" || hn) { var n = target && target.closest && target.closest("[data-id]"); return n ? n.dataset.id : null; }
    return ui.pickId || null;
  }
  PTD.idOf = idOf;

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
  /* While a previewed font is still loading the stage keeps drawing the font that was on the screen, so that no fallback font flashes (REQ-012). */
  function shownFont(l) {
    var hold = ui.fontHold && ui.fontHold[l.id];
    if (hold) {
      var st = PTD.fonts.status(l.font);
      if (st === "ok" || st === "fail" || st === "missing") delete ui.fontHold[l.id]; else return hold;
    }
    return l.font;
  }
  /* The scale of a glyph: millimetres per glyph unit (1 for a frozen text, whose outlines are already in millimetres). */
  /* The browser adds the letter space after the last character too and centres that: shift by half of it so the visible text is centred on x. */
  function exactDx(l) { return !l.glyph && !l.frozen && l.exact && l.ls ? l.ls / 2 : 0; }
  /* The turning point of a text (REQ-041): the middle of its box for exactly centred texts, the position point (baseline) for older ones and glyphs.
   * The data keep x and the baseline y; the pivot lies c below/above the baseline, measured on every render. */
  var pcOff = {};
  function pcOf(l) {   /* from the saved box (stable, the same after a reload); the live measure only before a box has been saved */
    if (!l || !l.exact || l.glyph) return 0;
    if (l.box) return l.box.dy + l.box.h / 2;
    return pcOff[l.id] || 0;
  }
  function pivotOf(l) { return { x: l.x, y: l.y + pcOf(l) }; }
  function turnAttr(l) { var P = pivotOf(l); return "rotate(" + l.rot + " " + P.x + " " + P.y + ")"; }
  function glyphK(l) { return PTD.glyph.k(l); }
  function drawArtwork(art, flat) {
    var b = state.band, cloth = state.cloth, O = artOrigin();
    art = el("g", { transform: "translate(" + O.x + " " + O.y + ")" }, art);   /* everything below is measured from the artwork origin */
    var at = Math.max(0, Math.min(state.layers.length, Math.round(b.at || 0)));
    function drawBand() {
      if (b.hidden) return;
      if (b.show) {
        var oc = colorHex(b.outlineAuto ? cloth.color : b.outlineColor), ow = b.outline ? Math.max(0, b.outlineW) : 0;
        var ys = [b.y - b.gap / 2 - b.thick / 2, b.y + b.gap / 2 - b.thick / 2];   /* gap = distance between the centre lines */
        if (ow > 0) ys.forEach(function (yy) { el("rect", { x: b.x - b.len / 2 - ow, y: yy - ow, width: b.len + ow * 2, height: b.thick + ow * 2, fill: oc }, art); });
        ys.forEach(function (yy) { el("rect", { x: b.x - b.len / 2, y: yy, width: b.len, height: b.thick, fill: colorHex(b.color) }, art); });
      }
    }
    var texts = {}, bboxes = {}, gs = {};
    state.layers.forEach(function (l, li) {
      if (li === at) drawBand();
      if (l.hidden) return;
      var g = el("g", { transform: turnAttr(l), opacity: l.opacity }, art); gs[l.id] = g;
      var fill = l.gradient && !flat ? "url(#gr-" + l.id + ")" : colorHex(l.color);
      var oc2 = colorHex(l.outlineAuto ? cloth.color : l.outlineColor);
      if (l.frozen) {
        var fz = l.frozen, gk = glyphK(l), pg = el("g", { transform: "translate(" + l.x + " " + l.y + ")" + (gk !== 1 ? " scale(" + gk + ")" : "") }, g);
        if (l.outline && l.outlineW > 0) el("path", { d: fz.d, fill: oc2, stroke: oc2, "stroke-width": l.outlineW * 2 / gk, "stroke-linejoin": "round" }, pg);
        el("path", { d: fz.d, fill: fill, "fill-rule": l.glyph ? "evenodd" : "nonzero" }, pg);
        bboxes[l.id] = { x: l.x + fz.x0 * gk, y: l.y + fz.y0 * gk, width: (fz.x1 - fz.x0) * gk, height: (fz.y1 - fz.y0) * gk };
        return;
      }
      var t = el("text", { x: l.x + exactDx(l), y: l.y, "text-anchor": "middle", "font-size": l.size, "font-weight": l.weight, "font-style": l.italic ? "italic" : "normal", fill: fill }, g);
      t.style.fontFamily = fontFamilyCss(shownFont(l));
      t.style.letterSpacing = l.ls + "px";
      if (l.outline && l.outlineW > 0) {
        t.setAttribute("stroke", oc2); t.setAttribute("stroke-width", l.outlineW * 2);
        t.setAttribute("stroke-linejoin", "round"); t.setAttribute("stroke-linecap", "round"); t.style.paintOrder = "stroke";
      }
      fillText(t, l, l.upper ? l.text.toUpperCase() : l.text);
      texts[l.id] = t;
    });
    if (at >= state.layers.length) drawBand();
    return { texts: texts, bboxes: bboxes, gs: gs };
  }
  /* Things lying on the table, drawn above everything printed, the player-area line included.
   * Bottom to top: muck, burn cards, the poker hand, pot chips, players. The hand is a table object,
   * not cloth pattern, so the layer order never affects it. The Blender texture keeps only the hand
   * (onlyHand); the rest become 3D objects there. Returns the hand group (or null). */
  function drawObjects(parent, onlyHand) {
    var hand = null, show = state.cards.show && !state.band.hidden;
    function drawHand(g) { if (show) { var O = artOrigin(); hand = drawCards(el("g", { transform: "translate(" + O.x + " " + O.y + ")" }, g)); } }
    if (!onlyHand && PTD.scene && PTD.scene.any(state)) PTD.scene.draw(parent, PTD.scene.build(state), { el: el, colorHex: colorHex, hand: drawHand });
    else drawHand(parent);
    return hand;
  }
  var repaintReq;
  function requestRender() { cancelAnimationFrame(repaintReq); repaintReq = requestAnimationFrame(renderStage); }
  function renderStage() {
    if (PTD.pathsui) PTD.pathsui.refresh();   /* patterns follow their paths and objects */
    var s = stageSize(), v = ui.view, b = state.band, flat = config.preview === "flat", AO = artOrigin();
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
    PTD.guides.renderRolls(el("g", {}, svg), ctx);   /* roll bands: above the cloth, under everything else */
    /* artwork */
    var art = el("g", {}, svg);
    var A = drawArtwork(art, flat), texts = A.texts, bboxes = A.bboxes;
    PTD.tables.renderArt(art, ctx);   /* the player-area line lies above all texts */
    var cardsG = drawObjects(art);
    state.layers.forEach(function (l) {
      var t = texts[l.id]; if (!t) return;
      var bb = null;
      try { bb = t.getBBox(); } catch (e) {}
      if (bb && bb.width > 0) {
        var bw = bb.width;
        if (!l.glyph && l.ls > 0 && trailingLS()) bw = Math.max(bb.width - l.ls, bb.width * 0.05);   /* the box ends at the last letter, not after its letter space (REQ-039) */
        bboxes[l.id] = { x: bb.x, y: bb.y, width: bw, height: bb.height };
        if (PTD.fonts.status(l.font) === "ok") l.box = { w: round(bw, 1), h: round(bb.height, 1), dy: round(bb.y - l.y, 1) };
      } else if (l.box) bboxes[l.id] = { x: l.x - l.box.w / 2, y: l.y + l.box.dy, width: l.box.w, height: l.box.h, placeholder: true };
    });
    state.layers.forEach(function (l) {   /* the turning point of exactly centred texts is the middle of the box just measured */
      if (!l.exact || l.glyph || l.hidden) { delete pcOff[l.id]; return; }
      var bb = bboxes[l.id]; if (!bb || !(bb.height > 0)) return;
      pcOff[l.id] = bb.y + bb.height / 2 - l.y;
      if (A.gs[l.id]) A.gs[l.id].setAttribute("transform", turnAttr(l));
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
    /* artwork origin mark: a diamond with a cross, away from the cloth centre mark */
    if (config.showOrigin !== false) {
      var ao = 9 / v.z, ag = el("g", { "pointer-events": "none" }, svg);
      el("path", { d: "M" + AO.x + " " + (AO.y - ao) + "L" + (AO.x + ao) + " " + AO.y + "L" + AO.x + " " + (AO.y + ao) + "L" + (AO.x - ao) + " " + AO.y + "Z", fill: "none", stroke: "#ff7ab8", "stroke-width": 1.4, "vector-effect": "non-scaling-stroke" }, ag);
      el("line", { x1: AO.x - ao * 1.8, y1: AO.y, x2: AO.x + ao * 1.8, y2: AO.y, stroke: "#ff7ab8", "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, ag);
      el("line", { x1: AO.x, y1: AO.y - ao * 1.8, x2: AO.x, y2: AO.y + ao * 1.8, stroke: "#ff7ab8", "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, ag);
    }

    /* hit areas for artwork, selected items raised to the top */
    var hits = el("g", { transform: "translate(" + AO.x + " " + AO.y + ")" }, svg);
    function hitRect(parent, x, y, ww, hh, id) {
      var r = el("rect", { x: x, y: y, width: ww, height: hh, fill: "rgba(0,0,0,0)", "pointer-events": "all", "data-id": id }, parent);
      r.style.cursor = "move";
    }
    var zids = stackIds();
    var zorder = zids.filter(function (k) { return !isSel(k); }).concat(zids.filter(function (k) { return isSel(k) && k !== state.selected; }));
    if (state.selected && zids.indexOf(state.selected) >= 0) zorder.push(state.selected);
    /* Hit testing (config.hitMode): "box" = a transparent rectangle round every item (the old way), "shape" = the real outline of
       frozen shapes as the hit area (the browser picks), "geom" = at click time every item is asked, topmost first, whether the point
       hits its real shape, "buffer" = every item is painted in its own colour on an off-screen canvas and the pixel is read. */
    var hm = hitMode(), plist = [];
    ui.pickList = plist; ui.idbuf = null;
    var tol = 4 / v.z;
    zorder.forEach(function (k) {
      if (k === "band") {
        if (b.show && !b.hidden) [b.y - b.gap / 2, b.y + b.gap / 2].forEach(function (cy) {
          var rx = b.x - b.len / 2, ry = cy - b.thick / 2 - 8 / v.z, rw = b.len, rh = b.thick + 16 / v.z;
          plist.push({ id: "band", rect: { x: rx, y: ry, w: rw, h: rh } });
          if (hm === "box" || hm === "shape") hitRect(hits, rx, ry, rw, rh, "band");
        });
        return;
      }
      var l = getLayer(k), bb = bboxes[k];
      if (!l || !bb || !bb.width || l.hidden) return;
      var P = pivotOf(l), ent = { id: k, rot: l.rot || 0, px: P.x, py: P.y, rect: { x: bb.x, y: bb.y, w: bb.width, h: bb.height } };
      if (l.frozen) { ent.fz = l.frozen; ent.gk = glyphK(l); ent.rule = l.glyph ? "evenodd" : "nonzero"; ent.lx = l.x; ent.ly = l.y; ent.sw = (l.outline && l.outlineW > 0 ? l.outlineW * 2 : 0) + tol * 2; }
      plist.push(ent);
      if (hm === "box" || (hm === "shape" && !ent.fz)) hitRect(el("g", { transform: turnAttr(l) }, hits), bb.x, bb.y, bb.width, bb.height, k);
      else if (hm === "shape") {
        var sg = el("g", { transform: turnAttr(l) }, hits), pg2 = el("g", { transform: "translate(" + l.x + " " + l.y + ")" + (ent.gk !== 1 ? " scale(" + ent.gk + ")" : "") }, sg);
        var hp = el("path", { d: ent.fz.d, fill: "rgba(0,0,0,0)", stroke: "rgba(0,0,0,0)", "stroke-width": ent.sw / ent.gk, "stroke-linejoin": "round", "fill-rule": ent.rule, "pointer-events": "all", "data-id": k }, pg2);
        hp.style.cursor = "move";
      }
    });
    /* the hand lies above everything, so its hit area does too */
    if (cardsG) { try { var cb = cardsG.getBBox(); if (cb.width) { plist.push({ id: "band", rect: { x: cb.x, y: cb.y, w: cb.width, h: cb.height } }); if (hm === "box" || hm === "shape") hitRect(hits, cb.x, cb.y, cb.width, cb.height, "band"); } } catch (e) {} }

    /* bounds of every item (marquee selection and snapping) */
    ui.bounds = {}; ui.tbox = {};
    function boundsOf(pts) {
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
      return { x: x0 + AO.x, y: y0 + AO.y, w: x1 - x0, h: y1 - y0 };   /* bounds are kept in world coordinates */
    }
    state.layers.forEach(function (l) {
      var bb = bboxes[l.id]; if (!bb || !bb.width || l.hidden) return;
      ui.tbox[l.id] = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };   /* the box before the turn, in artwork coordinates (the handles of REQ-013) */
      var ang = l.rot * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang), pv = pivotOf(l);
      ui.bounds[l.id] = boundsOf([[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]].map(function (q) {
        var dx = q[0] - pv.x, dy = q[1] - pv.y; return [pv.x + dx * ca - dy * sa, pv.y + dx * sa + dy * ca];
      }));
    });
    var bpts = [];
    if (b.show && !b.hidden) bpts.push([b.x - b.len / 2, b.y - b.gap / 2 - b.thick / 2], [b.x + b.len / 2, b.y + b.gap / 2 + b.thick / 2]);
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
        dashed(el("g", { transform: "translate(" + AO.x + " " + AO.y + ") " + turnAttr(ly) }, ov), { x: bb.x, y: bb.y, width: bb.width, height: bb.height }, bb.placeholder ? "#e0a36a" : null);
      } else if (sid === "band" && ui.bounds.band) {
        var bd = ui.bounds.band; dashed(ov, { x: bd.x - 6 / v.z, y: bd.y - 6 / v.z, width: bd.w + 12 / v.z, height: bd.h + 12 / v.z });
      }
    });
    state.layers.forEach(function (l) {
      var bb = bboxes[l.id];
      if (bb && bb.placeholder && !l.hidden) dashed(el("g", { transform: "translate(" + AO.x + " " + AO.y + ") " + turnAttr(l) }, ov), { x: bb.x, y: bb.y, width: bb.width, height: bb.height }, "#e0a36a");
    });
    if (ui.snapLines) {
      (ui.snapLines.x || []).forEach(function (sx) { dashed(ov, { tag: "line", x1: sx, x2: sx, y1: w.y0, y2: w.y1 }, "#ff7ab8"); });
      (ui.snapLines.y || []).forEach(function (sy) { dashed(ov, { tag: "line", y1: sy, y2: sy, x1: w.x0, x2: w.x1 }, "#ff7ab8"); });
    }
    if (ui.marquee) { var mq = ui.marquee, mr = dashed(ov, { x: mq.x, y: mq.y, width: mq.w, height: mq.h }); mr.setAttribute("fill", "rgba(90,209,255,0.14)"); }
    if (ui.tool === "clonehere") drawCloneGhosts(ov, AO, dashed);
    PTD.guides.renderMeasure(ov, ctx);
    PTD.tables.renderHandles(el("g", {}, svg), ctx);
    PTD.thandles.render(el("g", {}, svg), ctx);
    PTD.measure.render(el("g", {}, svg), ctx);   /* above the click targets of the artwork, so measurements can be grabbed */
    PTD.cpoints.render(el("g", {}, svg), ctx);
    PTD.align.render(el("g", {}, svg), ctx);
    PTD.measure.renderGhost(el("g", {"pointer-events": "none"}, svg), ctx);
    PTD.measure.syncPin();

    document.getElementById("viewInfo").textContent = "Zoom " + Math.round(v.z * 1000) / 10 + " % · " + fmtLen(100 / v.z) + " per 100 px";
    updateTableSummary(); updateHandMsg(); updateToolbar();
  }

  /* One line per visible table under the status bar: type, size and roundings. */
  function updateTableSummary() {
    var box = document.getElementById("tableSummary"); if (!box) return;
    box.textContent = "";
    PTD.tables.visible().forEach(function (t) {
      var p = t.preset, g = PTD.tables.geo(t), txt;
      if (!p) { var bb = g && g.bbox; txt = "free outline, " + (bb ? "width " + fmtLen(bb.w) + ", height " + fmtLen(bb.h) : "no size"); }
      else if (p.type === "circle" && p.circleLock !== false) txt = "circle, diameter " + fmtLen(p.w);
      else {
        txt = (p.type === "circle" ? "oval" : p.type) + ", width " + fmtLen(p.w) + ", height " + fmtLen(p.h);
        if (p.type === "stadium") txt += ", end radius " + fmtLen(Math.min(p.w, p.h) / 2);
        else if (p.type === "rect") txt += ", corner radius " + fmtLen(p.r);
        else if (p.type === "octagon") txt += ", chamfer " + fmtLen(p.chamfer);
      }
      var sp = document.createElement("span"), b = document.createElement("b");
      b.textContent = t.name; sp.appendChild(b); sp.appendChild(document.createTextNode(": " + txt)); box.appendChild(sp);
    });
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
    /* `nstep` (optional) is the step of the small arrows of the number field; the slider and the sideways drag over the number keep `step` (REQ-011). */
    pair: function (label, scope, key, min, max, step, nmin, nmax, nstep) {
      var base = 'data-scope="' + scope + '" data-key="' + key + '"';
      var ns = nstep ? nstep : step, scrub = nstep ? ' data-scrub="' + step + '"' : "";
      return '<div class="pair"><span>' + label + '</span><input type="range" ' + base + ' min="' + min + '" max="' + max + '" step="' + step + '"><input type="number" ' + base + scrub + ' min="' + nmin + '" max="' + nmax + '" step="' + ns + '"></div>';
    }
  };
  /* Lock (REQ-024): one flag `locked` on texts, the lines and cards, control points, measurements, tables and guides.
     A lock stops what the user does directly (drag, nudge, handles, fields, font and size keys, Delete, align, the randomizer);
     it does not stop a thing from following its parent, and it can still be selected, hidden and shown. */
  var LOCK_SVG = '<svg class="lockicon" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>';
  function lockIcon(on) { return on ? LOCK_SVG : ""; }
  function lockOwner(name, id) {
    switch (name) {
      case "layer": return getLayer(id);
      case "band": case "cards": return state.band;
      case "table": case "preset": case "notch": case "bet": case "players": return PTD.tables.get(id);
      case "node": return PTD.tables.get(String(id).split(":")[0]);
      case "cp": case "cpparent": return PTD.cpoints.get(id);
      case "guide": case "guideref": return PTD.guides.get(id);
      case "meas": return (state.measures || []).filter(function (m) { return m.id === id; })[0];
      default: return null;
    }
  }
  function isLockedKey(k) { return k === "band" ? !!state.band.locked : !!(getLayer(k) && getLayer(k).locked); }
  /* Fields of a locked thing are disabled (except its own Locked box), and enabled again when it is unlocked. */
  function applyLockState() {
    document.querySelectorAll("[data-scope]").forEach(function (inp) {
      var sc = inp.dataset.scope, i = sc.indexOf(":"), name = i < 0 ? sc : sc.slice(0, i), id = i < 0 ? "" : sc.slice(i + 1);
      var o = inp.dataset.key === "locked" ? null : lockOwner(name, id), lk = !!(o && o.locked);
      if (lk) { if (!inp.disabled) { inp.disabled = true; inp.dataset.lockdis = "1"; } }
      else if (inp.dataset.lockdis) { inp.disabled = false; delete inp.dataset.lockdis; }
    });
  }
  /* The things that the Lock button, the L key and the lock buttons work on: the selected texts, the lines and cards, a table, a guide, a measurement or a control point. */
  function lockables() {
    var out = [];
    selectedIds().forEach(function (k) { var o = k === "band" ? state.band : getLayer(k); if (o) out.push(o); });
    [PTD.tables.get(ui.selTable), PTD.guides.get(ui.selGuide), PTD.cpoints.get(ui.selCp), lockOwner("meas", ui.selMeasure)].forEach(function (o) { if (o) out.push(o); });
    return out;
  }
  /* H hides or shows the selected texts, glyphs and the lines and cards: the first one decides, all the others get the same. Shift+H shows everything hidden. */
  function hideables() {
    return selectedIds().map(function (k) { return k === "band" ? state.band : getLayer(k); }).filter(Boolean);
  }
  function toggleHideSelection() {
    var objs = hideables();
    if (!objs.length) { say("Nothing is selected. Select something to hide or show it (Shift+H shows everything that is hidden)."); return; }
    var hideIt = !objs[0].hidden;
    objs.forEach(function (o) { o.hidden = hideIt; });
    renderPanels(); renderStage(); save("hide:" + Date.now());
    say((hideIt ? "Hid " : "Showed ") + objs.length + (objs.length > 1 ? " things." : " thing.") + (hideIt ? " Shift+H shows everything that is hidden." : ""));
  }
  function showAllHidden() {
    var objs = state.layers.concat([state.band]).filter(function (o) { return o.hidden; });
    if (!objs.length) { say("Nothing is hidden."); return; }
    objs.forEach(function (o) { o.hidden = false; });
    renderPanels(); renderStage(); save("hide:" + Date.now());
    say("Showed " + objs.length + (objs.length > 1 ? " hidden things." : " hidden thing."));
  }
  function toggleLockSelection() {
    var objs = lockables();
    if (!objs.length) { say("Nothing is selected. Select something to lock or unlock it."); return; }
    var lockIt = objs.some(function (o) { return !o.locked; });
    objs.forEach(function (o) { o.locked = lockIt; });
    renderPanels(); renderStage(); save("lock:" + Date.now());
    say((lockIt ? "Locked " : "Unlocked ") + objs.length + (objs.length > 1 ? " things." : " thing.") + (lockIt ? " A locked thing cannot be changed directly; it can still be selected, hidden and shown, and it follows its parent." : ""));
  }
  /* A small padlock at the pointer while it is over a locked thing on the stage. */
  var lockBadgeEl = document.getElementById("lockBadge");
  function lockedUnder(target) {
    if (!target || !target.closest) return false;
    var hn = target.closest("[data-h]");
    if (hn) {
      var p = hn.dataset.h.split(":"), k = p[0], o = null;
      if (k === "guide") o = PTD.guides.get(p[1]);
      else if (k === "cp") o = PTD.cpoints.get(p[1]);
      else if (k === "meas") o = lockOwner("meas", p[1]);
      else if (k === "tedge" || k === "tnode" || k === "tbulge" || k === "tbet") o = PTD.tables.get(p[1]);
      if (o) return !!o.locked;
    }
    var lid = idOf(target);
    return lid ? isLockedKey(lid) : false;
  }
  function lockHover(e) {
    if (!lockBadgeEl) return;
    if (ui.dragging || !lockedUnder(e.target)) { lockBadgeEl.hidden = true; return; }
    lockBadgeEl.hidden = false;
    lockBadgeEl.style.left = (e.clientX + 14) + "px"; lockBadgeEl.style.top = (e.clientY + 14) + "px";
  }
  /* The text panels are ordered on the screen by this number (smaller is higher in the list). */
  function panelOrder(i) { var nL = state.layers.length, atB = state.band.at; return ((i >= atB ? nL - 1 - i : nL - i) - 1000) * 16; }   /* times 16: the group rows fit in between */
  function layerPanel(l, i) {
    var sc = "layer:" + l.id, open = !!ui.open[l.id], nL = state.layers.length, atB = state.band.at;
    var nSel = isSel(l.id) ? selectedIds().filter(function (k) { return !!getLayer(k); }).length : 0;
    var ord = panelOrder(i), gch = PTD.groups.chain(state, l);
    if (gch.some(function (g) { return !g.open; })) return "";   /* a collapsed group hides its texts */
    var head = '<header><button class="chev" type="button" data-act="toggle" data-id="' + l.id + '" aria-expanded="' + open + '" title="' + (open ? "Collapse" : "Expand") + '" aria-label="' + (open ? "Collapse" : "Expand") + ' text settings">' + (open ? "▲" : "▼") + '</button>' +
      '<button class="selbtn" type="button" data-act="select" data-id="' + l.id + '"><span class="idx">' + (nL - i) + '</span><span class="ttl">' + lockIcon(l.locked) + esc(l.text || "(empty)") + '</span>' + (l.pattern ? '<span class="small">pattern</span>' : l.glyph ? '<span class="small">glyph</span>' : l.frozen ? '<span class="small">outlines</span>' : "") + '</button>' +
      '<div class="tools">' + eyeBtn(l.id, l.hidden, "this text") +
      '<button type="button" class="lockbtn' + (l.locked ? " on" : "") + '" data-act="lock" data-id="' + l.id + '" aria-pressed="' + !!l.locked + '" title="' + (l.locked ? "Unlock" : "Lock") + ' this text" aria-label="' + (l.locked ? "Unlock" : "Lock") + ' this text">' + LOCK_SVG + '</button>' +
      '<button type="button" class="pickbtn' + (isSel(l.id) ? " on" : "") + '" data-act="pick" data-id="' + l.id + '" aria-pressed="' + isSel(l.id) + '" title="Select this text on the canvas. Shift or Ctrl adds it to the selection.">Select</button>' +
      (gch.length ? '<button type="button" data-act="lout" data-id="' + l.id + '" title="Take this text out of its group (it goes directly above the group)" aria-label="Take out of group">⇱</button>' : "") +
      '<button type="button" data-act="back" data-id="' + l.id + '" title="Send backward" aria-label="Send backward">↓</button>' +
      '<button type="button" data-act="front" data-id="' + l.id + '" title="Bring forward" aria-label="Bring forward">↑</button>' +
      '<button type="button" data-act="del" data-id="' + l.id + '" title="Delete" aria-label="Delete text">✕</button></div></header>';
    var cls = 'panel layer' + (open ? " open" : "") + (isSel(l.id) ? " sel" : "") + (l.hidden ? " hid" : "") + (gch.length ? " gm" : ""), ind = gch.length ? ";margin-left:" + gch.length * 14 + "px" : "";
    if (!open) return '<section class="' + cls + '" style="order:' + ord + ind + '" data-panel="' + l.id + '">' + head + '</section>';
    var chips = config.favouriteFonts.map(function (f) { return '<button class="chip" type="button" data-act="fav" data-id="' + l.id + '" data-font="' + esc(f) + '">' + esc(f) + '</button>'; }).join("");
    var weights = [100, 200, 300, 400, 500, 600, 700, 800, 900].map(function (w) { return '<option value="' + w + '">' + w + '</option>'; }).join("");
    var frozen = !!l.frozen;
    var body = '<div class="body">' +
      (nSel > 1 ? '<p class="small multi">' + nSel + ' texts are selected. Changes here apply to all of them, except the text itself and its X and Y position.</p>' : '') +
      (l.gen ? '<p class="small multi">Made by the randomizer name style (' + l.gen + '). “Back to my own texts” (Artwork tab, top) removes it.</p>' : '') +
      (l.styleHidden ? '<p class="small multi">Hidden by the randomizer name style. “Back to my own texts” shows it again.</p>' : '') +
      (frozen ? '<p class="small multi">This text is frozen to outlines. Unfreeze it to change the text, font or size.</p>' : '') +
      '<fieldset class="plain"' + (frozen ? " disabled" : "") + '>' +
      '<label class="fld"><span>Text</span><input type="text" data-scope="' + sc + '" data-key="text" autocomplete="off"></label>' +
      '<div class="fld"><span>Font (click to list, or type to filter)</span><div class="combo"><input type="text" role="combobox" aria-autocomplete="list" data-scope="' + sc + '" data-key="font" data-fontinput="1" autocomplete="off" spellcheck="false"><button class="combobtn" type="button" data-act="fontmenu" aria-label="Show all fonts">▾</button></div></div>' +
      '<div class="chips">' + chips + '</div><div class="fstat" data-fstat="' + l.id + '"></div>' +
      H.pair("Size (mm)", sc, "size", 5, 800, 1, 1, 3000, 0.5) + H.pair("Letter space", sc, "ls", -30, 100, 1, -200, 400) +
      '<div class="row2"><label class="fld"><span>Weight</span><select data-scope="' + sc + '" data-key="weight" data-num="1">' + weights + '</select></label>' +
      '<div class="checks">' + H.chk("Italic", sc, "italic") + H.chk("Uppercase", sc, "upper") + H.chk("Centre exactly", sc, "exact") + '</div></div>' +
      '<div class="checks">' + H.chk("Bigger first letter", sc, "cap") + H.chk("Every word", sc, "capAll") + '</div>' +
      H.pair("Cap size ×", sc, "capScale", 0.5, 4, 0.05, 0.1, 10) + '</fieldset>' +
      H.pair("Rotation", sc, "rot", -180, 180, 1, -360, 360) + H.pair("Opacity", sc, "opacity", 0, 1, 0.01, 0, 1) +
      '<div class="colorrow" data-colour="' + sc + ':color:Colour"></div>' +
      '<div class="checks">' + H.chk("Gold shading (shaded preview only)", sc, "gradient") + H.chk("Part of the casino name", sc, "nameWord") + '</div>' +
      '<div class="checks">' + H.chk("Outline (hides what is below)", sc, "outline") + H.chk("Use cloth colour", sc, "outlineAuto") + '</div>' +
      H.pair("Outline width", sc, "outlineW", 0, 50, 0.5, 0, 300) +
      '<div class="colorrow" data-colour="' + sc + ':outlineColor:Outline colour, used when the cloth colour is off"></div>' +
      '<div class="row2">' + H.len("Centre X", sc, "x") + H.len("Baseline Y", sc, "y") + '</div>' +
      '<div class="btnrow">' + (frozen ? '<button class="btn" type="button" data-act="unfreeze" data-id="' + l.id + '">Unfreeze (back to live text)</button>' : '<button class="btn" type="button" data-act="freeze" data-id="' + l.id + '">Freeze to outlines</button>') + '</div>' +
      '</div>';
    if (l.pattern) body = PTD.pathsui.body(l, sc, nSel); else if (l.glyph) body = glyphBody(l, sc, nSel);
    return '<section class="' + cls + '" style="order:' + ord + ind + '" data-panel="' + l.id + '">' + head + body + '</section>';
  }
  /* The panel body of a glyph (REQ-033): the same shared fields as a text, without the font, and the SVG buttons. */
  function glyphBody(l, sc, nSel) {
    var k = glyphK(l), w = (l.frozen.x1 - l.frozen.x0) * k;
    function hgt(h) { return h.replace(/<input /g, '<input title="Height of the glyph in millimetres. The shape is scaled evenly, so the width follows." '); }
    return '<div class="body">' +
      (nSel > 1 ? '<p class="small multi">' + nSel + ' items are selected. Changes here apply to all of them, except the name and the position.</p>' : '') +
      '<p class="small multi">A glyph is a single-colour vector picture. Drag its handles to scale it, or set the height. Width: ' + Math.round(w * 10) / 10 + ' mm.</p>' +
      '<label class="fld"><span>Name</span><input type="text" data-scope="' + sc + '" data-key="text" autocomplete="off"></label>' +
      hgt(H.pair("Height (mm)", sc, "size", 5, 800, 1, 1, 3000, 0.5)) +
      H.pair("Rotation", sc, "rot", -180, 180, 1, -360, 360) + H.pair("Opacity", sc, "opacity", 0, 1, 0.01, 0, 1) +
      '<div class="colorrow" data-colour="' + sc + ':color:Colour"></div>' +
      '<div class="checks">' + H.chk("Gold shading (shaded preview only)", sc, "gradient") + '</div>' +
      '<div class="checks">' + H.chk("Outline (hides what is below)", sc, "outline") + H.chk("Use cloth colour", sc, "outlineAuto") + '</div>' +
      H.pair("Outline width", sc, "outlineW", 0, 50, 0.5, 0, 300) +
      '<div class="colorrow" data-colour="' + sc + ':outlineColor:Outline colour, used when the cloth colour is off"></div>' +
      '<div class="row2">' + H.len("Centre X", sc, "x") + H.len("Centre Y", sc, "y") + '</div>' +
      '<div class="btnrow"><button class="btn" type="button" data-act="glyphcopy" data-id="' + l.id + '">Copy as SVG</button><button class="btn" type="button" data-act="glyphsave" data-id="' + l.id + '">Save SVG file</button></div>' +
      '</div>';
  }
  /* Adds a glyph (REQ-033): a frozen layer whose shape is scaled by its size (the height in mm). It lands in the middle of the view. */
  function actAddGlyph(shape, name, opts) {
    opts = opts || {};
    var base = mkLayer(String(name || "Glyph"), "Mea Culpa", opts.size > 0 ? opts.size : 150, 0, 400, 0, 0, true, false), AO = artOrigin();
    base.frozen = { d: shape.d, x0: shape.x0, y0: shape.y0, x1: shape.x1, y1: shape.y1 }; base.glyph = true;
    base.x = Math.round(ui.view.cx - AO.x); base.y = Math.round(ui.view.cy - AO.y);
    base.id = "l" + (state.layers.length + 1);
    state.layers.push(base); state.selected = base.id; ui.extra = {}; ui.open[base.id] = true; clearOther();
    renderPanels(); renderStage(); save("glyph:" + Date.now());
    return base;
  }
  function glyphSVG(l) { return PTD.glyph.toSVG(l.frozen, { colour: colorHex(l.color), sizeMm: l.size }); }
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
      '<h3 class="sec">Project</h3><p class="small">The project file holds the tables, guides, constraints, artwork, palette, fonts, export choices, the casino-name words, the randomizer options, the view switches and the name of the cutter it used last (the cutter itself is not saved in the project). Each project is a tab above the canvas with its own undo history; the browser keeps an automatic copy of every tab. The settings file (toolbar button Settings) and the cutters (toolbar button Cutters) are shared by all projects.</p>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="psave">Save project</button><button class="btn" type="button" data-act="popen">Open project</button><button class="btn" type="button" data-act="pnew">New project</button><button class="btn" type="button" data-act="jsonopen">JSON…</button></div>' +
      '<h3 class="sec">Project as text</h3><textarea id="projectText" spellcheck="false" aria-label="Project JSON"></textarea>' +
      '<div class="btnrow"><button class="btn" type="button" data-act="ptext">Show current project</button><button class="btn" type="button" data-act="papply">Apply this text</button></div>' +
      '<p class="small">Use this when downloads or file pickers are not available.</p><div class="msg" id="projMsg"></div>';
  }
  /* On/off options (REQ-018). A new option needs its default in defaultConfig, a line in FT (js/help.js) and a test. */
  var OPTIONS = [{ key: "dragReadout", label: "Show the value next to the pointer while dragging" }, { key: "openOnSelect", label: "Open the panel of a clicked text" }, { key: "keepOriginal", label: "Split words and Join texts keep the original text(s)" }];
  function optionsHTML() {
    return '<h3 class="sec">Options</h3><p class="small">Choices about how the program behaves. They are saved in the settings file, so they are the same in all projects.</p><div class="checks">' + OPTIONS.map(function (o) { return H.chk(o.label, "cfg", o.key); }).join("") + '</div><div class="row2"><label class="fld"><span>How a click finds the item under it</span><select data-scope="cfg" data-key="hitMode"><option value="shape">Real shape (browser picks)</option><option value="geom">Real shape (tested at the click)</option><option value="buffer">Picture of the items (ID buffer)</option><option value="box">Bounding box (old)</option></select></label><div></div></div>';
  }
  function settingsHTML() {
    return optionsHTML() + '<h3 class="sec">Settings file</h3><p class="small">The settings are shared by all projects and are not part of any project file: units, snapping, the list of cutters with their calibration, the heat press size, favourite fonts and your own universal words. The browser keeps them automatically; the file is for moving them to another computer or browser.</p>' +
      '<div class="btnrow"><button class="btn" type="button" data-act="csave">Save settings</button><button class="btn" type="button" data-act="copen">Open settings</button><button class="btn" type="button" data-act="creset">Reset settings</button><button class="btn" type="button" data-lay="reset" title="Put the panes back to their usual sizes (side panel width, graph editor height).">Reset layout</button><button class="btn" type="button" data-act="jsonopen" data-part="settings">Settings JSON…</button></div>' +
      '<p class="small">The cutters, their calibration and the heat press size are behind the Cutters button in the toolbar.</p>' +
      '<p class="small">Old logo-editor settings files open in the Project tab (or paste their text there): positions are moved so the old canvas centre becomes the cloth centre, and one pixel becomes one millimetre.</p><div class="msg" id="setMsg"></div>';
  }
  function panelOfTab(t) { return document.getElementById("tab-" + t); }
  function setTab(name) {
    ui.tab = name;
    document.querySelectorAll("#tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === name); });
    document.querySelectorAll("[data-gtab]").forEach(function (b) { var on = b.dataset.gtab === name; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
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
    layersEl.innerHTML = state.layers.map(function (l, i) { return layerPanel(l, i); }).reverse().join("") + (state.groups || []).map(groupPanel).join("");
    var nB = state.layers.length, atN = state.band.at;
    bandPanel.style.order = String((nB - atN - 1000) * 16);
    bandPanel.classList.toggle("sel", isSel("band"));
    var be = bandPanel.querySelector('[data-act="eye"]');
    if (be) { var bt = (state.band.hidden ? "Show" : "Hide") + " lines and cards"; be.classList.toggle("off", !!state.band.hidden); be.setAttribute("aria-pressed", String(!state.band.hidden)); be.title = bt; be.setAttribute("aria-label", bt); }
    var bl = bandPanel.querySelector('[data-act="lock"]');
    if (bl) { bl.classList.toggle("on", !!state.band.locked); bl.setAttribute("aria-pressed", String(!!state.band.locked)); bl.title = (state.band.locked ? "Unlock" : "Lock") + " the lines and cards"; }
    var bp = bandPanel.querySelector('[data-act="pick"]');
    if (bp) { bp.classList.toggle("on", isSel("band")); bp.setAttribute("aria-pressed", String(isSel("band"))); }
    document.getElementById("tablesPane").innerHTML = PTD.tables.panelHTML();
    document.getElementById("guidesPane").innerHTML = PTD.guides.panelHTML() + PTD.measure.panelHTML() + PTD.cpoints.panelHTML();
    document.getElementById("coloursPane").innerHTML = coloursHTML();
    document.getElementById("fontsPane").innerHTML = PTD.fonts.panelHTML();
    document.getElementById("exportPane").innerHTML = PTD.exporter ? PTD.exporter.panelHTML() : "";
    if (PTD.exporter && PTD.exporter.afterRender) PTD.exporter.afterRender();
    document.getElementById("randomPane").innerHTML = PTD.random ? PTD.random.panelHTML() : "";
    if (PTD.random && PTD.random.paint) PTD.random.paint();
    document.getElementById("projectPane").innerHTML = projectHTML();
    document.getElementById("settingsPane").innerHTML = settingsHTML();
    if (PTD.pathsui) PTD.pathsui.paint();
    document.getElementById("cuttersPane").innerHTML = PTD.cutters.panelHTML();
    if (PTD.cutters.refresh) PTD.cutters.refresh();
    if (PTD.help) PTD.help.applyTips(document.getElementById("controls"));
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
    makeCollapsible();
    revealChanged();
    if (PTD.layout) PTD.layout.update();
  }

  /* ---------- collapsible parts ----------
   * Every heading (h3.sec) of the Tables, Guides, Colours and Fonts tabs and every panel with a title row
   * (guides, constraints, measurements, colours, fonts, the casino name) gets an arrow button at its left that
   * hides or shows the rest. The state is kept in memory per part (ui.coll), so it survives a redraw. */
  ui.coll = {};
  function collBtn(key, closed, what) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "chev sm"; b.dataset.act = "collapse"; b.dataset.key = key;
    b.textContent = closed ? "▼" : "▲"; b.setAttribute("aria-expanded", String(!closed));
    b.title = closed ? "Expand" : "Collapse"; b.setAttribute("aria-label", (closed ? "Expand " : "Collapse ") + what);
    return b;
  }
  function collTargets(btn) {
    var h = btn.parentNode;
    if (h.tagName === "H3") { var out = [], n = h.nextElementSibling; while (n && !(n.tagName === "H3" && n.classList.contains("sec"))) { out.push(n); n = n.nextElementSibling; } return out; }
    var body = h.parentNode, out2 = [];
    for (var i = 0; i < body.children.length; i++) if (body.children[i] !== h) out2.push(body.children[i]);
    return out2;
  }
  function applyColl(btn) {
    var closed = !!ui.coll[btn.dataset.key];
    collTargets(btn).forEach(function (n) { if (closed) n.setAttribute("data-collhide", ""); else n.removeAttribute("data-collhide"); });
    btn.textContent = closed ? "▼" : "▲"; btn.setAttribute("aria-expanded", String(!closed)); btn.title = closed ? "Expand" : "Collapse";
  }
  function makeCollapsible() {
    ["tablesPane", "guidesPane", "coloursPane", "fontsPane", "cuttersPane", "randomPane", "exportPane", "projectPane", "settingsPane"].forEach(function (pid) {
      var pane = document.getElementById(pid), seen = {};
      if (!pane) return;
      function key(base) { var k = pid + ":" + base; seen[k] = (seen[k] || 0) + 1; return seen[k] > 1 ? k + "#" + seen[k] : k; }
      Array.prototype.slice.call(pane.querySelectorAll("h3.sec")).forEach(function (h) {
        if (h.querySelector('[data-act="collapse"]')) return;
        var k = key("h:" + h.textContent.trim()); h.classList.add("collh");
        h.insertBefore(collBtn(k, !!ui.coll[k], h.textContent.trim()), h.firstChild);
      });
      Array.prototype.slice.call(pane.querySelectorAll(".panel")).forEach(function (pn) {
        var body = pn.querySelector(":scope > .body"); if (!body || body.querySelector(':scope > [data-act="collapse"]')) return;
        var head = body.firstElementChild; if (!head) return;
        /* a panel right under a heading (Display and snapping, Selected table) is covered by the heading arrow */
        var ps = pn.previousElementSibling;
        if (!head.classList.contains("colorrow") && ps && ps.tagName === "H3" && !pn.querySelector('[data-act="msel"]')) return;
        if (!head.classList.contains("colorrow")) {
          /* a panel without a title row (a measurement): make one from its first line */
          var ttl = head.querySelector("b"), row = document.createElement("div");
          row.className = "colorrow collhead"; var t = document.createElement("b"); t.style.fontWeight = "400";
          t.textContent = ttl ? ttl.textContent + " " + ((head.querySelector(".small") || {}).textContent || "") : "Part"; row.appendChild(t);
          body.insertBefore(row, head); head = row;
        }
        var idEl = pn.querySelector("[data-scope], [data-id]"), id = idEl ? (idEl.dataset.scope || "") + (idEl.dataset.id || "") : (head.textContent.trim().slice(0, 30));
        var k = key("p:" + id);
        head.insertBefore(collBtn(k, !!ui.coll[k], "this part"), head.firstChild);
      });
      Array.prototype.slice.call(pane.querySelectorAll('[data-act="collapse"]')).forEach(applyColl);
    });
    var np = document.getElementById("namePanel");
    if (np) {
      var head = np.querySelector(".collhead");
      if (head && !head.querySelector('[data-act="collapse"]')) head.insertBefore(collBtn("art:name", !!ui.coll["art:name"], "the casino name"), head.firstChild);
      var nb = head && head.querySelector('[data-act="collapse"]'); if (nb) applyColl(nb);
    }
  }
  /* When the selection changes (on the stage or in a list) its panel is scrolled into view in the tab that is
   * shown; it is not opened. */
  var lastSel = "";
  function revealChanged() {
    var sig = [ui.selGuide, ui.selTable, ui.selMeasure, state.selected, ui.tab].join("|");
    if (sig === lastSel) return;
    lastSel = sig;
    var pane = document.getElementById("tab-" + ui.tab), n = pane && pane.querySelector(".panel.sel");
    if (n && n.scrollIntoView) n.scrollIntoView({ block: "nearest" });
  }

  /* ---------- scopes: which object a data-scope names ---------- */
  PTD.scopes = PTD.scopes || {};
  PTD.onChange = PTD.onChange || {};
  PTD.scopes.layer = function (id) { return getLayer(id); };
  PTD.scopes.band = function () { return state.band; };
  PTD.scopes.cards = function () { return state.cards; };
  PTD.scopes.origin = function () { return state.origin; };
  PTD.scopes.proj = function () { return state; };
  PTD.scopes.cloth = function () { return state.cloth; };
  PTD.scopes.cfg = function () { return config; };
  PTD.scopes.xp = function () { return state.export; };
  PTD.scopes.pal = function (id) { return state.palette.filter(function (c) { return c.id === id; })[0]; };
  PTD.scopes.font = function (id) { return PTD.fonts.entry(id); };
  function resolveScope(name, id) { var f = PTD.scopes[name]; return f ? f(id) : null; }
  PTD.onChange.cfg = function (o, key) {
    if (key === "units") renderPanels();
    saveConfig();
  };
  PTD.onChange.cloth = function () { updateSwatches(); };
  PTD.onChange.pal = function (o, key) { if (key === "name") { var keep = document.activeElement; fillColourSlots(); syncInputs(); if (keep && keep.focus) keep.focus(); } };
  PTD.onChange.cards = function () { updateHandMsg(); };
  PTD.onChange.layer = function (o, key, id, v) {
    if (key === "text") { var t = layersEl.querySelector('[data-panel="' + id + '"] .ttl'); if (t) t.textContent = v || "(empty)"; }
  };

  function syncInputs() {
    syncGroupFields();
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
    applyLockState();
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
  /* Fills the table list of the quick button (only when it changed, so an open list is not disturbed). */
  function updateOriginUI() {
    var sel = document.getElementById("anchorTable"); if (!sel) return;
    var key = JSON.stringify(state.tables.map(function (t) { return [t.id, t.name, t.visible]; }));
    if (sel.dataset.key2 !== key) {
      sel.dataset.key2 = key;
      sel.innerHTML = '<option value="">First visible table</option>' + state.tables.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.name) + (t.visible ? "" : " (hidden)") + '</option>'; }).join("");
    }
    if (document.activeElement !== sel) sel.value = state.origin.table;
    var t = anchorTable(), btn = document.getElementById("placeOriginBtn"), info = document.getElementById("originInfo");
    if (btn) { btn.disabled = !t; btn.textContent = "Place at " + fmtNum(round(state.origin.distance, 2)) + " mm from dealer edge"; }
    if (info) {
      if (!t) info.textContent = "No visible table to measure from.";
      else {
        var f = PTD.tables.dealerFrame(t), dx = state.origin.x - f.x, dy = state.origin.y - f.y;
        var inward = -(dx * f.nx + dy * f.ny), side = dx * f.ex + dy * f.ey;
        info.textContent = "Origin is " + fmtNum(round(Math.abs(inward), 1)) + " mm " + (inward >= 0 ? "in from" : "outside") + " the dealer edge of " + t.name + ", " + fmtNum(round(side, 1)) + " mm sideways.";
      }
    }
  }
  function updateToolbar() {
    updateOriginUI();
    document.getElementById("cloneBtn").disabled = !selectedIds().some(function (k) { return !!getLayer(k); });
    var stx = selectedIds().map(getLayer).filter(Boolean);
    document.getElementById("splitBtn").disabled = !(stx.length === 1 && !stx[0].locked && !stx[0].frozen && wordsOf(stx[0].text).length > 1);
    document.getElementById("joinBtn").disabled = !(stx.length > 1 && !stx.some(function (l) { return l.locked || l.frozen; }));
    document.getElementById("groupBtn").disabled = !(stx.length > 1 && GR.units(state, stx).length > 1 && !stx.some(function (l) { return l.gen; }));
    document.getElementById("ungroupBtn").disabled = !GR.units(state, stx).some(function (u) { return !!u.g; });
    document.querySelectorAll("[data-tool]").forEach(function (b) { b.classList.toggle("on", b.dataset.tool === ui.tool); });
    var ob = document.getElementById("outlineBtn"); ob.textContent = ui.outlines ? "Hide outline" : "Show outline"; ob.setAttribute("aria-pressed", String(!ui.outlines));
    stageWrap.style.cursor = ui.tool === "select" ? "" : "crosshair";
  }
  function updateFontStatus() {
    document.querySelectorAll("[data-fstat]").forEach(function (n) {
      var l = getLayer(n.dataset.fstat); if (!l) return;
      var s = PTD.fonts.status(l.font), msg = "", bad = false, btn = false;
      if (ui.fontHold && ui.fontHold[l.id]) msg = "Loading the font…";
      else if (s === "ok") msg = "Font loaded.";
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
  /* Changing the size of a text keeps the middle of its box where it is (the baseline is the anchor, so the box would grow upwards from it otherwise).
     Only texts with exact centring; the box offset from the baseline scales with the size, and turns with the text. */
  function keepCentreOnSize(ts, size) {
    ts.forEach(function (t) {
      var tb = ui.tbox[t.id];
      if (!t.exact || t.glyph || t.frozen || !tb || !(t.size > 0) || !(size > 0)) return;
      var c = pcOf(t), k = size / t.size;   /* the turning point (the middle of the box) stays: the baseline moves by the change of its distance */
      t.y = round(t.y + c * (1 - k), 2);
    });
  }
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
    if (name === "layer" && key === "size") keepCentreOnSize(editTargets(obj).filter(function (t) { return !t.locked; }), v);
    if (name === "layer" && key !== "text" && key !== "x" && key !== "y") editTargets(obj).filter(function (t) { return !t.locked; }).forEach(function (t) { t[key] = v; });
    else obj[key] = v;
    var hook = PTD.onChange[name];
    if (hook) hook(obj, key, id, v, old);
    renderStage(); syncInputs(); syncToolbar(); save(sc + ":" + key);
  }
  document.addEventListener("input", onInput);

  /* Drag sideways over a number field (or its label) to change the value; a plain click still edits the text.
     One step per pixel, Shift makes it ten times coarser, Alt ten times finer. */
  function numberSelector(inp) {
    if (inp.id) return 'input[type="number"]#' + (window.CSS && CSS.escape ? CSS.escape(inp.id) : inp.id);
    var q = 'input[type="number"]', any = false;
    Array.prototype.forEach.call(inp.attributes, function (a) { if (a.name.indexOf("data-") === 0) { q += "[" + a.name + '="' + String(a.value).replace(/"/g, '\\"') + '"]'; any = true; } });
    return any ? q : "";
  }
  document.addEventListener("wheel", function (e) {   /* the wheel over a number field that has the focus changes it: Shift x10, Alt /10 (Ctrl keeps the browser zoom) */
    var el = document.activeElement;
    if (e.ctrlKey || !el || el.type !== "number" || e.target !== el || !PTD.scrubbable(el)) return;
    var st = Number(el.dataset.scrub || el.getAttribute("step")); st = isFinite(st) && st > 0 ? st : 1;
    var d = (e.deltaY < 0 ? 1 : -1) * st * (e.shiftKey ? 10 : e.altKey ? 0.1 : 1), v = Number(el.value) || 0, dec = Math.max(((String(st).split(".")[1]) || "").length, e.altKey ? 1 : 0, Math.min(3, ((String(v).split(".")[1]) || "").length));
    var nv = v + d; if (el.min !== "") nv = Math.max(Number(el.min), nv); if (el.max !== "") nv = Math.min(Number(el.max), nv);
    e.preventDefault(); el.value = String(Number(nv.toFixed(dec)));
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  }, { passive: false });
  PTD.scrubbable = function (el) { return !!(el && el.matches && el.matches('input[type="number"]:not([data-noscrub])') && !el.disabled && !el.readOnly); };
  document.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    var GSEL = 'input[type="number"]:not([data-noscrub])';   /* every number field scrubs, except the ones marked data-noscrub (slow to recompute) */
    var inp = e.target.closest ? e.target.closest(GSEL) : null;
    if (!inp && e.target.closest) { var lab = e.target.closest("label.fld,.fld,.pair"); if (lab && e.target.tagName === "SPAN") inp = lab.querySelector(GSEL); }
    if (!inp || inp.disabled || inp.readOnly) return;
    var x0 = e.clientX, v0 = Number(inp.value), scrub = false;
    /* A change can rebuild the panel, which replaces this input; look the live one up by scope and key each time. */
    var selector = inp.dataset.scope ? 'input[type="number"][data-scope="' + inp.dataset.scope + '"][data-key="' + inp.dataset.key + '"]' : numberSelector(inp);   /* the number field, not the slider next to it: the slider rounds to its own step */
    function live() { return (selector && document.querySelector(selector)) || inp; }
    var ownEvents = !inp.dataset.scope;   /* fields of the main panels save on input; every other field also gets change when the drag ends */
    if (!isFinite(v0)) return;
    var stepAttr = Number(inp.dataset.scrub || inp.getAttribute("step")), step = isFinite(stepAttr) && stepAttr > 0 ? stepAttr : 1;   /* data-scrub: a drag step apart from the arrow step */
    var lo = inp.min !== "" ? Number(inp.min) : -Infinity, hi = inp.max !== "" ? Number(inp.max) : Infinity;
    function move(ev) {
      var dx = ev.clientX - x0;
      if (!scrub) {
        if (Math.abs(dx) < 4) return;
        scrub = true; document.body.classList.add("scrubbing"); PTD.hints.drag("scrub");
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      }
      ev.preventDefault();
      var s = step * (ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1), v = v0 + Math.round(dx) * s;
      var dec = Math.max(((String(s).split(".")[1]) || "").length, Math.min(3, ((String(v0).split(".")[1]) || "").length));   /* keep the decimals the field started with (12.5 stays x.5) */
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
      if (scrub) PTD.hints.dragEnd();
      if (scrub && ownEvents) { var lv = live(); lv.dispatchEvent(new Event("change", { bubbles: true })); }   /* fields of other panels may listen for change only */
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
    var hint = '<div class="hint" role="presentation">Up and down arrows show the font on the text. Enter or a click elsewhere keeps it. Esc puts the original back.</div>';
    if (!menuItems.length) { menu.innerHTML = '<div class="empty">No match in the list. Press Enter to try “' + esc(cur) + '” as a Google Fonts name, or import a font file on the Fonts tab.</div>' + hint; return; }
    menu.innerHTML = menuItems.map(function (n, i) {
      var fav = config.favouriteFonts.indexOf(n) >= 0, imp = PTD.fonts.isImported(n);
      return '<div class="opt' + (n === cur ? " cur" : "") + (i === menuIdx ? " act" : "") + '" role="option" data-font="' + esc(n) + '">' + (fav ? '<span class="star">★</span> ' : "") + esc(n) + (imp ? ' <span class="note">file</span>' : "") + '</div>';
    }).join("") + hint;
    var a = menu.querySelector(".act"); if (a) a.scrollIntoView({ block: "nearest" });
  }
  function openMenu(inp, showAll) {
    menuInput = inp; menuItems = showAll ? PTD.fonts.allNames() : filterFonts(inp.value);
    menuIdx = menuItems.indexOf(inp.value);
    menu.hidden = false; positionMenu(); drawMenu();
  }
  /* Font preview (REQ-010). While the list is open the up and down arrows show a font on the selected texts at once,
     without an undo step. Enter or a click elsewhere keeps the font (one undo step for all the texts), Esc puts every
     text back to the font it had. Only texts change (other selected things are left alone), and frozen texts are skipped. */
  var preview = null, previewTimer = null;
  /* Sets a font on texts. While it is not loaded the stage keeps showing the font that is on the screen now (REQ-012). */
  function applyFont(targets, name) {
    targets.forEach(function (t) {
      var shown = shownFont(t);
      t.font = name;
      if (PTD.fonts.status(name) === "ok") delete ui.fontHold[t.id]; else ui.fontHold[t.id] = shown;
    });
  }
  function fontTargets(l) { return editTargets(l).filter(function (t) { return t && !t.frozen && !t.locked; }); }
  function closeMenu() { menu.hidden = true; menuInput = null; preview = null; clearTimeout(previewTimer); }
  function previewFont(inp, name) {
    var l = getLayer(inp.dataset.scope.split(":")[1]); if (!l || !name) return;
    clearTimeout(fontTimer);   /* a typed name that is still waiting must not commit the preview */
    if (!preview) {
      if (PTD.random && PTD.random.isRunning && PTD.random.isRunning()) PTD.random.stop();   /* the randomizer must not change fonts meanwhile */
      preview = { id: l.id, orig: fontTargets(l).map(function (t) { return { t: t, font: t.font }; }) };
    }
    applyFont(preview.orig.map(function (o) { return o.t; }), name);
    inp.value = name;
    renderStage();
    clearTimeout(previewTimer);   /* load the font file a moment after the last arrow press, so fast scrolling does not fetch every font */
    previewTimer = setTimeout(function () { PTD.fonts.load(name); updateFontStatus(); }, 150);
    updateFontStatus();
  }
  function revertPreview(keepInput) {
    if (!preview) return;
    var p = preview; preview = null; clearTimeout(previewTimer);
    p.orig.forEach(function (o) { o.t.font = o.font; delete ui.fontHold[o.t.id]; });
    var l = getLayer(p.id);
    if (!keepInput && menuInput && l) menuInput.value = l.font;
    renderStage(); updateFontStatus();
  }
  function commitPreview() {
    if (!preview) return;
    var p = preview; preview = null; clearTimeout(previewTimer);
    var l = getLayer(p.id);
    if (l) PTD.fonts.load(l.font);
    renderStage(); syncInputs(); updateFontStatus(); save("font");
  }
  function dismissMenu() { commitPreview(); closeMenu(); }   /* leaving the list in any way except Esc keeps what is shown */
  function setFont(inp, name) {
    var l = getLayer(inp.dataset.scope.split(":")[1]); if (!l) return;
    preview = null; clearTimeout(previewTimer);
    applyFont(fontTargets(l), name);
    inp.value = name; PTD.fonts.load(name);
    closeMenu();
    if (inp.blur) inp.blur();   /* the keyboard goes back to the canvas keys: F again, Ctrl+Z, the arrow keys (REQ-019) */
    renderStage(); syncInputs(); save("font");
  }
  function onFontInput(e) {
    var inp = e.target, l = getLayer(inp.dataset.scope.split(":")[1]); if (!l) return;
    if (preview) revertPreview(true);   /* typing starts a new choice: the shown font goes back, the typed letters stay */
    openMenu(inp, false);
    clearTimeout(fontTimer);
    fontTimer = setTimeout(function () { if (PTD.fonts.allNames().indexOf(inp.value) >= 0 || inp.value.length > 2) { applyFont(fontTargets(l), inp.value); PTD.fonts.load(inp.value); renderStage(); updateFontStatus(); save("font"); } }, 700);
  }
  menu.addEventListener("mousedown", function (e) {
    e.preventDefault();
    var o = e.target.closest(".opt"); if (o && menuInput) setFont(menuInput, o.dataset.font);
  });
  document.addEventListener("keydown", function (e) {
    if (menu.hidden || !menuInput || document.activeElement !== menuInput) return;
    if (e.key === "ArrowDown") { menuIdx = Math.min(menuItems.length - 1, menuIdx + 1); if (menuItems[menuIdx]) previewFont(menuInput, menuItems[menuIdx]); drawMenu(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { menuIdx = Math.max(0, menuIdx - 1); if (menuItems[menuIdx]) previewFont(menuInput, menuItems[menuIdx]); drawMenu(); e.preventDefault(); }
    else if (e.key === "Enter") { setFont(menuInput, menuIdx >= 0 && menuItems[menuIdx] ? menuItems[menuIdx] : menuInput.value.trim()); e.preventDefault(); }
    else if (e.key === "Escape") { var escInp = menuInput; revertPreview(); closeMenu(); if (escInp && escInp.blur) escInp.blur(); e.preventDefault(); e.stopPropagation(); }   /* the field lets go of the focus, so the next Esc works as before */
  }, true);
  /* A click anywhere outside the list keeps the shown font. This runs before the click's own work, so a click on another
     text commits the font to the texts that were selected, not to the new one. */
  document.addEventListener("pointerdown", function (e) {
    if (!preview) return;
    if (menu.contains(e.target) || (menuInput && menuInput.parentNode && menuInput.parentNode.contains(e.target))) return;
    dismissMenu();
  }, true);
  document.addEventListener("focusout", function (e) {
    if (!preview || e.target !== menuInput) return;
    if (e.relatedTarget && menu.contains(e.relatedTarget)) return;
    dismissMenu();
  });
  /* A click on the font field opens the list again when the field still has the focus after Enter or Esc closed it. */
  document.addEventListener("click", function (e) {
    if (e.target.dataset && e.target.dataset.fontinput && menu.hidden && document.activeElement === e.target) openMenu(e.target, true);
  });
  document.addEventListener("focusin", function (e) {
    if (e.target.dataset && e.target.dataset.fontinput) { openMenu(e.target, true); var fe = e.target; setTimeout(function () { if (document.activeElement === fe) fe.select(); }, 0); }
    else if (!menu.contains(e.target)) dismissMenu();
  });

  /* ---------- clicks in the panels ---------- */
  /* The box around the given texts, in world coordinates ({x, y, w, h}), or null. */
  function unionOf(ids) {
    var u = null;
    ids.forEach(function (k) {
      var b = ui.bounds[k]; if (!b) return;
      u = u ? { x: Math.min(u.x, b.x), y: Math.min(u.y, b.y), x2: Math.max(u.x2, b.x + b.w), y2: Math.max(u.y2, b.y + b.h) } : { x: b.x, y: b.y, x2: b.x + b.w, y2: b.y + b.h };
    });
    return u ? { x: u.x, y: u.y, w: u.x2 - u.x, h: u.y2 - u.y } : null;
  }
  /* Clone (REQ-028): every selected text gets a new instance with all the data the same, directly above its original in the list, and the
     clones become the selection. Without `opts` they move 10 % of the width of the box around the whole selection to the right and 10 % of its
     height down, so that they keep their places relative to each other and can be told apart; opts {dx, dy} gives the move in millimetres
     (clone to cursor). The toolbar button, Ctrl+D and the right-click menu all come here. */
  function actClone(opts) {
    var ids = selectedIds().filter(function (k) { return !!getLayer(k); });
    if (!ids.length) { say("No text selected. Select a text to clone it."); return false; }
    if (PTD.random && PTD.random.isRunning && PTD.random.isRunning()) PTD.random.stop();
    var u = unionOf(ids), dx = opts && opts.dx != null ? opts.dx : (u ? u.w * 0.1 : 10), dy = opts && opts.dy != null ? opts.dy : (u ? u.h * 0.1 : 10);
    dx = Math.round(dx * 1000) / 1000; dy = Math.round(dy * 1000) / 1000;
    var made = [], srcs = [], chosen = ids.map(getLayer);
    var cloneGroups = (state.groups || []).filter(function (g) { return GR.layersIn(state, g.uid).every(function (m) { return chosen.indexOf(m) >= 0; }); });   /* groups whose texts are all cloned get a copy */
    ids.forEach(function (id) {
      var l = getLayer(id), c = Object.assign({}, l);
      c.frozen = l.frozen ? Object.assign({}, l.frozen) : null; c.pattern = l.pattern ? (PTD.pathsui ? PTD.pathsui.cloneOut(l.pattern) : { out: "" }) : null;
      c.gen = ""; c.styleHidden = false; c.nameWord = false; c.locked = false; c.uid = "";   /* a copy is the user's own text: not a part of the name or of a name style, unlocked, with a new uid */
      c.x = Math.round((l.x + dx) * 1000) / 1000; c.y = Math.round((l.y + dy) * 1000) / 1000;
      state.layers.splice(state.layers.indexOf(l) + 1, 0, c);
      if (state.layers.indexOf(l) < state.band.at) state.band.at++;
      made.push(c); srcs.push(l);
    });
    if (cloneGroups.length) {
      var gmap = {};
      cloneGroups.forEach(function (g) { var ng = Object.assign({}, g); ng.uid = ""; gmap[g.uid] = ng; });
      var maxNo = (state.groups || []).reduce(function (a, x) { return Math.max(a, x.autoNo || 0); }, 0);
      cloneGroups.forEach(function (g) {
        var ng = gmap[g.uid], u = 1, taken = function (n) { return state.groups.some(function (x) { return x.uid === "g" + n; }); };
        while (taken(u)) u++;
        ng.uid = "g" + u; ng.autoNo = ++maxNo; state.groups.push(ng);
      });
      cloneGroups.forEach(function (g) { var ng = gmap[g.uid]; ng.parent = gmap[g.parent] ? gmap[g.parent].uid : g.parent; });
      made.forEach(function (c, i) { var og = srcs[i].group; if (og && gmap[og]) c.group = gmap[og].uid; });
    }
    state.layers.forEach(function (l, i) { l.id = "l" + (i + 1); });
    if (cloneGroups.length) { GR.settle(state); state.layers.forEach(function (l, i) { l.id = "l" + (i + 1); }); }
    var newIds = made.map(function (c) { return c.id; });
    setSelection(newIds); openTopmostSelected(); renderPanels(); save("clone:" + Date.now());
    say("Cloned " + made.length + (made.length > 1 ? " texts." : " text."));
    return true;
  }
  /* Split words (REQ-031) and Join texts (REQ-032). */
  function wordsOf(t) { return String(t || "").split(/\s+/).filter(function (w) { return w.length; }); }
  function copyLayer(l, text, x, y) {
    var c = Object.assign({}, l);
    c.frozen = l.frozen ? Object.assign({}, l.frozen) : null;
    c.gen = ""; c.styleHidden = false; c.locked = false; c.uid = ""; c.nameWord = !!l.nameWord;   /* the pieces of a name word are name words too */
    c.text = text; c.x = Math.round(x * 1000) / 1000; c.y = Math.round(y * 1000) / 1000;
    return c;
  }
  function renumberLayers() { state.layers.forEach(function (l, i) { l.id = "l" + (i + 1); }); }
  function actSplit(opts) {
    var keep = opts && opts.keep != null ? !!opts.keep : !!config.keepOriginal;
    var ids = selectedIds().filter(function (k) { return !!getLayer(k); });
    if (ids.length !== 1) { say("Select one text to split it into words."); return false; }
    var l = getLayer(ids[0]), words = wordsOf(l.text), n = words.length;
    if (l.locked) { say("The text is locked, so it cannot be split."); return false; }
    if (l.frozen) { say("The text is frozen (its shape is fixed), so it cannot be split."); return false; }
    if (n < 2) { say("The text has only one word, so there is nothing to split."); return false; }
    var box = ui.tbox[l.id];
    if (!box) { say("The text has no measured size yet (it is hidden or not drawn). Show it first, then split it."); return false; }
    if (PTD.random && PTD.random.isRunning && PTD.random.isRunning()) PTD.random.stop();
    var dx = Math.round(box.w / n * 1000) / 1000, dy = Math.round(box.h / n * 1000) / 1000, x0 = l.x, y0 = l.y, made = [], prev = l;
    var from = keep ? 0 : 1;
    if (!keep) l.text = words[0];
    for (var k = 1; k <= (keep ? n : n - 1); k++) {
      var c = copyLayer(l, words[k - 1 + (keep ? 0 : 1)], x0 + k * dx, y0 + k * dy);
      state.layers.splice(state.layers.indexOf(prev) + 1, 0, c);
      if (state.layers.indexOf(prev) < state.band.at) state.band.at++;
      made.push(c); prev = c;
    }
    var sel = (keep ? [] : [l]).concat(made);
    renumberLayers();
    setSelection(sel.map(function (o) { return o.id; })); openTopmostSelected(); renderPanels(); save("split:" + Date.now());
    say("Split into " + n + " words" + (keep ? "; the original was kept." : "."));
    return true;
  }
  function joinOrder(texts) {
    if (!ui.areaSel) return texts;
    return texts.slice().sort(function (a, b) {
      var A = ui.tbox[a.id] || { x: a.x, y: a.y, h: 0 }, B = ui.tbox[b.id] || { x: b.x, y: b.y, h: 0 };
      var rowA = A.y + A.h / 2, rowB = B.y + B.h / 2, tol = Math.min(A.h, B.h) / 2;
      return Math.abs(rowA - rowB) > tol ? rowA - rowB : A.x - B.x;
    });
  }
  function actJoin(opts) {
    var keep = opts && opts.keep != null ? !!opts.keep : !!config.keepOriginal;
    var all = selectedIds().map(getLayer).filter(Boolean);
    if (all.length < 2) { say("Select two or more texts to join them."); return false; }
    if (all.some(function (l) { return l.locked; })) { say("A selected text is locked, so the texts cannot be joined."); return false; }
    if (all.some(function (l) { return l.frozen; })) { say("A selected text is frozen (its shape is fixed), so the texts cannot be joined."); return false; }
    var texts = joinOrder(all).filter(function (l) { return wordsOf(l.text).length > 0; });
    if (texts.length < 2) { say("Fewer than two of the selected texts have any text, so there is nothing to join."); return false; }
    if (PTD.random && PTD.random.isRunning && PTD.random.isRunning()) PTD.random.stop();
    var joined = texts.map(function (l) { return String(l.text).trim(); }).join(" "), first = texts[0], target = first;
    if (keep) {
      var u = unionOf([first.id]), dx = u ? u.w * 0.1 : 10, dy = u ? u.h * 0.1 : 10;
      target = copyLayer(first, joined, first.x + dx, first.y + dy);
      state.layers.splice(state.layers.indexOf(first) + 1, 0, target);
      if (state.layers.indexOf(first) < state.band.at) state.band.at++;
    } else {
      ensureUids(state.layers);
      var gone = all.filter(function (l) { return l !== first; }), uids = gone.map(function (l) { return l.uid; });
      PTD.cpoints.list().forEach(function (cp) {
        if (cp.parent.kind === "text" && uids.indexOf(cp.parent.id) >= 0) PTD.cpoints.reparent(cp, { kind: "text", id: first.uid });   /* the point keeps its place on the cloth */
      });
      first.text = joined;
      gone.forEach(function (l) { var i = state.layers.indexOf(l); if (i < 0) return; state.layers.splice(i, 1); if (i < state.band.at) state.band.at -= 1; });
    }
    renumberLayers();
    setSelection([target.id]); openTopmostSelected(); renderPanels(); save("join:" + Date.now());
    say("Joined " + texts.length + " texts" + (keep ? "; the originals were kept." : "."));
    return true;
  }
  /* ---------- groups (REQ-008) ---------- */
  var GR = PTD.groups; GR.pc = function (l) { return pcOf(l); };
  function selLayers() { return selectedIds().map(getLayer).filter(Boolean); }
  /* The group that is selected as a whole (all its texts and nothing else are selected), or null. */
  function curGroup() {
    var ids = selectedIds(), ls = ids.map(getLayer);
    if (ids.length < 2 || ls.some(function (l) { return !l; })) return null;
    var cand = (state.groups || []).filter(function (g) {
      var m = GR.layersIn(state, g.uid); return m.length === ids.length && m.every(function (l) { return ids.indexOf(l.id) >= 0; });
    });
    return cand.length ? cand[0] : null;
  }
  /* A text on the canvas stands for its outermost group: the ids of the texts of that group, or just the text. */
  function unitIds(id) {
    var l = getLayer(id), g = l ? GR.top(state, l) : null;
    return g ? GR.layersIn(state, g.uid).map(function (x) { return x.id; }) : [id];
  }
  function expandIds(ids) {
    var out = [];
    ids.forEach(function (k) { (k === "band" ? [k] : unitIds(k)).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); });
    return out;
  }
  function toggleUnit(id) {
    var unit = unitIds(id), cur = selectedIds(), on = cur.indexOf(id) >= 0;
    var next = on ? cur.filter(function (k) { return unit.indexOf(k) < 0; }) : cur.concat(unit.filter(function (k) { return cur.indexOf(k) < 0; }));
    ui.areaSel = false; setSelection(next);
  }
  function selectGroup(uid, quiet) {
    var g = GR.get(state, uid); if (!g) return;
    clearOther(); setTab("artwork");
    ui.areaSel = false;
    setSelection(GR.layersIn(state, uid).map(function (l) { return l.id; }));
    var n = layersEl.querySelector('[data-gpanel="' + uid + '"]'); if (n && n.scrollIntoView) n.scrollIntoView({ block: "nearest" });
  }
  /* Double-click on a text of the selected group: select the next level down (a smaller group, or the text alone). */
  function descendInto(l) {
    var cg = curGroup(), chain = GR.chain(state, l), at = cg ? chain.indexOf(cg) : -1;
    if (at > 0) selectGroup(chain[at - 1].uid); else select(l.id, !config.openOnSelect);
  }
  function groupBox(ls) { return unionOf(ls.map(function (l) { return l.id; })); }
  function finishGroupOp(sel, msg, tag) {
    setSelection(sel.map(function (l) { return l.id; })); renderPanels(); renderStage(); save(tag + ":" + Date.now()); say(msg);
  }
  function stopRandom() { if (PTD.random && PTD.random.isRunning && PTD.random.isRunning()) PTD.random.stop(); }
  function actGroup() {
    var ls = selLayers();
    if (ls.length < 2) { say("Select two or more texts to group them."); return false; }
    stopRandom();
    var r = GR.make(state, ls);
    if (r.error) { say(r.error); return false; }
    r.group.open = true;
    finishGroupOp(GR.layersIn(state, r.group.uid), "Grouped " + GR.layersIn(state, r.group.uid).length + " texts: " + GR.displayName(state, r.group) + ".", "group");
    return true;
  }
  function actUngroup() {
    var ls = selLayers(), units = GR.units(state, ls).filter(function (u) { return !!u.g; });
    if (!units.length) { say("Select a whole group to ungroup it (click one of its texts, or its row in the list)."); return false; }
    stopRandom();
    var n = 0; units.forEach(function (u) { GR.ungroup(state, u.g.uid); n++; });
    finishGroupOp(ls, "Ungrouped " + n + (n > 1 ? " groups." : " group.") + " The texts stayed where they were.", "ungroup");
    return true;
  }
  function actTakeOut() {
    var ls = selLayers(), units = GR.units(state, ls).filter(function (u) { return (u.l ? u.l.group : u.g.parent); });
    if (!units.length) { say("The selected texts are not in a group."); return false; }
    stopRandom();
    units.forEach(function (u) { GR.takeOut(state, u); });
    finishGroupOp(ls.filter(function (l) { return state.layers.indexOf(l) >= 0; }), "Took " + units.length + (units.length > 1 ? " things" : " thing") + " out of the group.", "groupout");
    return true;
  }
  function actAddTo(uid) {
    var ls = selLayers(), g = GR.get(state, uid);
    if (!g) return false;
    if (!ls.length) { say("Select texts or groups first, then press Add to group on the group's row."); return false; }
    stopRandom();
    var r = GR.addTo(state, uid, ls);
    if (r.error) { say(r.error); return false; }
    finishGroupOp(GR.layersIn(state, uid), "Added " + r.n + (r.n > 1 ? " things" : " thing") + " to " + GR.displayName(state, GR.get(state, uid) || g) + ".", "groupadd");
    return true;
  }
  /* Scales a set of texts about a fixed world point and puts that point back exactly afterwards (the font metrics are not quite proportional). */
  function scaleSet(ls, anchorW, k, anchorOf) {
    var AO = artOrigin();
    GR.scale(ls, { x: anchorW.x - AO.x, y: anchorW.y - AO.y }, k);
    renderStage();
    var u2 = groupBox(ls);
    if (u2) {
      var a2 = anchorOf(u2), ex = anchorW.x - a2.x, ey = anchorW.y - a2.y;
      if (Math.abs(ex) > 0.001 || Math.abs(ey) > 0.001) { ls.forEach(function (l) { l.x = round(l.x + ex, 3); l.y = round(l.y + ey, 3); }); renderStage(); }
    }
  }
  function groupFree(ls, what) {
    if (ls.some(function (l) { return l.locked; })) { say("A text in the group is locked, so it cannot be " + what + "."); return false; }
    if (what !== "moved" && ls.some(function (l) { return l.frozen && !l.glyph; })) { say("A text in the group is frozen (outlines), so it cannot be " + what + ". Unfreeze it first."); return false; }
    return true;
  }
  function turnGroup(ls, deg) {
    if (!groupFree(ls, "turned") || !ls.length) return false;
    var u = groupBox(ls); if (!u) return false;
    var AO = artOrigin();
    stopRandom();
    GR.turn(ls, { x: u.x + u.w / 2 - AO.x, y: u.y + u.h / 2 - AO.y }, deg);
    renderStage(); renderPanels(); save("gturn:" + Date.now());
    say("Turned " + ls.length + " texts by " + round(deg, 2) + "°.");
    return true;
  }
  function syncGroupFields() {
    var cg = curGroup(); if (!cg) return;
    var u = groupBox(GR.layersIn(state, cg.uid)), AO = artOrigin(); if (!u) return;
    var vals = { x: u.x - AO.x, y: u.y - AO.y, w: u.w, h: u.h };
    document.querySelectorAll('[data-gfield][data-gid="' + cg.uid + '"]').forEach(function (inp) {
      var k = inp.dataset.gfield; if (inp === document.activeElement || !(k in vals)) return;
      inp.value = fmtNum(vals[k] / unitF());
    });
  }
  function applyGroupField(inp) {
    var g = GR.get(state, inp.dataset.gid); if (!g) return;
    var key = inp.dataset.gfield, ls = GR.layersIn(state, g.uid);
    if (key === "name") { g.name = inp.value.trim(); g.nameAuto = !g.name; renderPanels(); save("gname:" + g.uid); return; }
    if (key === "turn") return;
    var v = parseFloat(inp.value), u = groupBox(ls), AO = artOrigin();
    if (!isFinite(v) || !u) { syncGroupFields(); return; }
    v *= unitF();
    stopRandom();
    if (key === "x" || key === "y") {
      if (!groupFree(ls, "moved")) { syncGroupFields(); return; }
      var d = key === "x" ? v - (u.x - AO.x) : v - (u.y - AO.y);
      ls.forEach(function (l) { if (key === "x") l.x = round(l.x + d, 3); else l.y = round(l.y + d, 3); });
      renderStage(); save("gmove:" + g.uid); syncGroupFields(); return;
    }
    if (!groupFree(ls, "scaled")) { syncGroupFields(); return; }
    var k = v / (key === "w" ? u.w : u.h), kr = GR.kRange(ls, 1, 3000);
    if (!(k > 0)) { syncGroupFields(); return; }
    if (k < kr.min || k > kr.max) { k = Math.max(kr.min, Math.min(kr.max, k)); say("The size of a text stays between 1 and 3000 mm, so the group was scaled only to x" + round(k, 3) + "."); }
    scaleSet(ls, { x: u.x, y: u.y }, k, function (b) { return { x: b.x, y: b.y }; });
    renderPanels(); save("gscale:" + g.uid + ":" + Date.now());
  }
  function groupPanel(g) {
    var ls = GR.layersIn(state, g.uid); if (!ls.length) return "";
    var anc = [], p = GR.get(state, g.parent), n = 0;
    while (p && n++ < 64) { anc.push(p); p = GR.get(state, p.parent); }
    if (anc.some(function (a) { return !a.open; })) return "";   /* inside a collapsed group */
    var top = Math.max.apply(null, ls.map(function (l) { return state.layers.indexOf(l); }));
    var ord = panelOrder(top) - 15 + anc.length, dep = anc.length;
    var hid = ls.every(function (l) { return l.hidden; }), lk = ls.every(function (l) { return l.locked; });
    var sel = !!curGroup() && curGroup().uid === g.uid, nm = GR.displayName(state, g), id = g.uid;
    var head = '<header><button class="chev" type="button" data-act="grptoggle" data-gid="' + id + '" aria-expanded="' + !!g.open + '" title="' + (g.open ? "Hide the texts of this group in the list" : "Show the texts of this group in the list") + '" aria-label="Collapse or expand group">' + (g.open ? "▲" : "▼") + '</button>' +
      '<button class="selbtn" type="button" data-act="grpselect" data-gid="' + id + '" title="Select the whole group (all its texts)"><span class="idx">▣</span><span class="ttl">' + lockIcon(lk) + esc(nm) + '</span><span class="small">' + ls.length + ' texts</span></button>' +
      '<div class="tools">' + eyeBtn(id, hid, "all texts of this group", "grpeye").replace('data-id=', 'data-gid=') +
      '<button type="button" class="lockbtn' + (lk ? " on" : "") + '" data-act="grplock" data-gid="' + id + '" aria-pressed="' + lk + '" title="' + (lk ? "Unlock" : "Lock") + ' all texts of this group" aria-label="Lock group">' + LOCK_SVG + '</button>' +
      '<button type="button" data-act="grpadd" data-gid="' + id + '" title="Add the selected texts or groups to this group" aria-label="Add selection to group">＋</button>' +
      (g.parent ? '<button type="button" data-act="grpout" data-gid="' + id + '" title="Take this group out of the group it is in (it goes directly above that group)" aria-label="Take group out">⇱</button>' : "") +
      '<button type="button" data-act="grpback" data-gid="' + id + '" title="Send this group backward (as one block)" aria-label="Send group backward">↓</button>' +
      '<button type="button" data-act="grpfront" data-gid="' + id + '" title="Bring this group forward (as one block)" aria-label="Bring group forward">↑</button>' +
      '<button type="button" data-act="grpungroup" data-gid="' + id + '" title="Ungroup: the group goes away, its texts stay where they are" aria-label="Ungroup">Ungroup</button>' +
      '<button type="button" data-act="grpdel" data-gid="' + id + '" title="Delete all texts of this group" aria-label="Delete group">✕</button></div></header>';
    var body = "";
    if (sel) {
      body = '<div class="body">' +
        '<label class="fld"><span>Name (empty = from its texts)</span><input type="text" data-gfield="name" data-gid="' + id + '" value="' + esc(g.nameAuto ? "" : g.name) + '" placeholder="' + esc(nm) + '" autocomplete="off" title="The name of the group. Leave it empty and the name is made from the texts in it."></label>' +
        '<div class="row2"><label class="fld"><span>X (' + config.units + ')</span><input type="number" step="any" data-gfield="x" data-gid="' + id + '" title="Left edge of the box around the group, from the artwork origin. Changing it moves the whole group."></label>' +
        '<label class="fld"><span>Y (' + config.units + ')</span><input type="number" step="any" data-gfield="y" data-gid="' + id + '" title="Top edge of the box around the group, from the artwork origin. Changing it moves the whole group."></label></div>' +
        '<div class="row2"><label class="fld"><span>Width (' + config.units + ')</span><input type="number" step="any" data-gfield="w" data-gid="' + id + '" title="Width of the box around the group. Changing it scales the whole group evenly (the top left corner stays)."></label>' +
        '<label class="fld"><span>Height (' + config.units + ')</span><input type="number" step="any" data-gfield="h" data-gid="' + id + '" title="Height of the box around the group. Changing it scales the whole group evenly (the top left corner stays)."></label></div>' +
        '<div class="row2"><label class="fld"><span>Turn by (°)</span><input type="number" step="any" value="0" data-gfield="turn" data-gid="' + id + '" title="Degrees to turn the whole group about the centre of its box (clockwise is positive). Press Turn to apply."></label>' +
        '<div class="btnrow"><button class="btn" type="button" data-act="grpturn" data-gid="' + id + '" title="Turn the whole group by the number of degrees on the left, about the centre of its box.">Turn</button></div></div>' +
        '<p class="small multi">Drag the handles of the box on the canvas to scale the group. A text that is frozen or locked stops scaling and turning.</p></div>';
    }
    return '<section class="panel layer gh' + (sel ? " sel open" : "") + (hid ? " hid" : "") + '" style="order:' + ord + ';margin-left:' + dep * 14 + 'px" data-gpanel="' + id + '">' + head + body + '</section>';
  }
  function groupAct(act, b, e) {
    var uid = b.dataset.gid, g = GR.get(state, uid), ls = g ? GR.layersIn(state, uid) : [];
    if (!g) return;
    switch (act) {
      case "grptoggle": g.open = !g.open; renderPanels(); return;
      case "grpselect": selectGroup(uid); return;
      case "grpeye": { var hide = ls.some(function (l) { return !l.hidden; }); ls.forEach(function (l) { l.hidden = hide; }); renderPanels(); renderStage(); save(); return; }
      case "grplock": { var lock = ls.some(function (l) { return !l.locked; }); ls.forEach(function (l) { l.locked = lock; }); renderPanels(); renderStage(); save("lock:" + Date.now()); return; }
      case "grpadd": actAddTo(uid); return;
      case "grpout": { var keep = selLayers(); GR.takeOut(state, { g: g }); finishGroupOp(keep.length ? keep : ls, "Took the group out of its group.", "groupout"); return; }
      case "grpback": case "grpfront": GR.move(state, { g: g }, act === "grpfront" ? 1 : -1); renderPanels(); renderStage(); save(); return;
      case "grpungroup": { GR.ungroup(state, uid); finishGroupOp(ls, "Ungrouped. The texts stayed where they were.", "ungroup"); return; }
      case "grpdel": { selectGroup(uid); deleteSelection(!!e.altKey); return; }
      case "grpturn": { var inp = b.closest(".body").querySelector('[data-gfield="turn"]'), deg = parseFloat(inp && inp.value); if (isFinite(deg) && deg) turnGroup(ls, deg); return; }
    }
  }
  /* Clone to cursor: ghosts of the selected texts hang on the pointer by the centre of their box; a click puts the clones there
     (Shift+click puts them and stays in the mode to put more). */
  function startCloneHere() {
    var ids = selectedIds().filter(function (k) { return !!getLayer(k); });
    if (!ids.length) { say("No text selected. Select a text to clone it."); return; }
    ensureUids(state.layers);
    ui.cloneHere = { uids: ids.map(function (k) { return getLayer(k).uid; }), u: unionOf(ids), ids: ids, d: null };
    setTool("clonehere");
    if (ui.lastPtr) cloneHereMove(ui.lastPtr);
  }
  function cloneHereMove(ev) {
    var ch = ui.cloneHere; if (!ch || !ch.u) return;
    var p = toWorld(ev), u = ch.u, dx = p.x - (u.x + u.w / 2), dy = p.y - (u.y + u.h / 2);
    if (config.snap && !ev.altKey && !ev.ctrlKey) { var r = snapGroup(u, dx, dy, ch.ids); dx = r.dx; dy = r.dy; }
    else { dx = round(dx, 1); dy = round(dy, 1); ui.snapLines = null; }
    ch.d = { dx: dx, dy: dy };
    showReadout("dx " + fmtLen(dx) + "   dy " + fmtLen(dy), ev);
    requestRender();
  }
  function cloneHereClick(e) {
    var ch = ui.cloneHere; if (!ch || !ch.d) return;
    var d = ch.d, ids = ch.uids.map(function (uid) { return state.layers.filter(function (l) { return l.uid === uid; })[0]; }).filter(Boolean).map(function (l) { return l.id; });
    if (!ids.length) { setTool("select"); return; }
    setSelection(ids);
    actClone({ dx: d.dx, dy: d.dy });
    if (e.shiftKey) { ch.ids = ch.uids.map(function (uid) { var l = state.layers.filter(function (q) { return q.uid === uid; })[0]; return l && l.id; }).filter(Boolean); requestRender(); }
    else { hideReadout(); setTool("select"); }
  }
  /* The ghosts of the clone to cursor: the box around the selection and faint real copies of the texts. */
  function drawCloneGhosts(parent, AO, dashedFn) {
    var ch = ui.cloneHere; if (!ch || !ch.d || !ch.u) return;
    var d = ch.d;
    dashedFn(parent, { x: ch.u.x + d.dx, y: ch.u.y + d.dy, width: ch.u.w, height: ch.u.h }, "#5ad1ff");
    ch.uids.forEach(function (uid) {
      var l = state.layers.filter(function (q) { return q.uid === uid; })[0]; if (!l || l.hidden) return;
      var g = el("g", { transform: "translate(" + (AO.x + d.dx) + " " + (AO.y + d.dy) + ") " + turnAttr(l), opacity: 0.5 }, parent);
      if (l.frozen) { el("path", { d: l.frozen.d, fill: colorHex(l.color), transform: "translate(" + l.x + " " + l.y + ")" + (l.glyph ? " scale(" + glyphK(l) + ")" : "") }, g); return; }
      var t = el("text", { x: l.x + exactDx(l), y: l.y, "text-anchor": "middle", "font-size": l.size, "font-weight": l.weight, "font-style": l.italic ? "italic" : "normal", fill: colorHex(l.color) }, g);
      t.style.fontFamily = fontFamilyCss(shownFont(l)); t.style.letterSpacing = l.ls + "px";
      fillText(t, l, l.upper ? l.text.toUpperCase() : l.text);
    });
  }
  function actDelLayer(id, alt) {
    var i = state.layers.findIndex(function (l) { return l.id === id; }); if (i < 0) return;
    if (state.layers[i].uid) PTD.cpoints.cascade("text", state.layers[i].uid, alt);   /* what hangs on it goes with it; with Alt it stays (REQ-027) */
    state.layers.splice(i, 1); delete ui.extra[id];
    if (i < state.band.at) state.band.at -= 1;
    state.layers.forEach(function (l, k) { l.id = "l" + (k + 1); });
    state.selected = state.layers.length ? state.layers[Math.max(0, i - 1)].id : "band"; ui.extra = {};
  }
  /* The Delete key on the ordinary selection (REQ-023, REQ-027): texts are deleted with what hangs on them (with Alt the things that hang
     on them stay and hang on the cloth centre), the lines and cards and the player-area line are only hidden, a selected table is left
     alone, and locked things stay. Returns false when nothing it handles is selected. */
  function deleteSelection(alt) {
    var ids = selectedIds(), objs = ids.filter(function (k) { return k !== "band" && getLayer(k); }).map(getLayer);
    var band = ids.indexOf("band") >= 0, bt = ui.selBet ? PTD.tables.get(ui.selBet) : null;
    if (!objs.length && !band && !bt) return false;
    if (PTD.random && PTD.random.isRunning && PTD.random.isRunning()) PTD.random.stop();
    var bad0 = PTD.measure.brokenCount(), lockedN = 0, parts = [], kids = 0;
    var del = objs.filter(function (l) { if (l.locked) { lockedN++; return false; } return true; });
    if (del.length) {
      var uids = del.map(function (l) { return l.uid; });
      kids = PTD.cpoints.list().filter(function (c) { return c.parent.kind === "text" && uids.indexOf(c.parent.id) >= 0; }).length;
      var gone = 0;
      del.forEach(function (l) {
        var i = state.layers.indexOf(l); if (i < 0) return;
        if (l.uid) gone += PTD.cpoints.cascade("text", l.uid, alt);
        state.layers.splice(i, 1); if (i < state.band.at) state.band.at -= 1;
      });
      state.layers.forEach(function (l, k) { l.id = "l" + (k + 1); });
      state.selected = null; ui.extra = {};
      parts.push("Deleted " + del.length + (del.length > 1 ? " texts" : " text") + (alt ? (kids ? "; " + kids + " control point" + (kids > 1 ? "s" : "") + " that hung on " + (del.length > 1 ? "them" : "it") + " now hang on the cloth centre" : "") : (gone ? " and " + gone + " control point" + (gone > 1 ? "s" : "") + " that hung on " + (del.length > 1 ? "them" : "it") : "")));
    }
    if (band) { if (state.band.locked) lockedN++; else { state.band.hidden = true; parts.push("hid the lines and cards"); } }
    if (bt) { if (bt.locked) lockedN++; else { bt.bet.on = false; ui.selBet = null; parts.push("hid the player-area line"); } }
    var bad = PTD.measure.brokenCount() - bad0;
    var msg = (parts.length ? parts.join("; ") : "Nothing was deleted") + (lockedN ? "; " + lockedN + " locked left as it was" : "") + (bad > 0 ? "; " + bad + " measurement" + (bad > 1 ? "s are" : " is") + " now broken" : "") + ". Ctrl+Z undoes it.";
    renderPanels(); renderStage(); save("del:" + Date.now()); say(msg.charAt(0).toUpperCase() + msg.slice(1));
    return true;
  }
  /* The Delete key in the align mode works on the align selection: texts, the lines and cards, control points, guides (a table is left alone). */
  function deleteAlignSelection(alt) {
    var keys = PTD.align.state().items || [];
    if (!keys.length) return false;
    var texts = [], band = false, other = 0;
    keys.forEach(function (k) {
      if (k === "band") band = true;
      else if (k.indexOf("text:") === 0) { var l = state.layers.filter(function (q) { return q.uid === k.slice(5); })[0]; if (l) texts.push(l.id); }
    });
    state.selected = texts[0] || (band ? "band" : null); ui.extra = {};
    texts.slice(1).forEach(function (t) { ui.extra[t] = true; });
    if (band && texts.length) ui.extra.band = true;
    var did = deleteSelection(alt);
    keys.forEach(function (k) {
      if (k.indexOf("cp:") === 0) { var cp = PTD.cpoints.get(k.slice(3)); if (cp) { PTD.cpoints.remove(cp.id, alt); did = true; } }
      else if (k.indexOf("guide:") === 0) { var g = PTD.guides.get(k.slice(6)); if (g && !g.locked) { PTD.guides.remove(g.id); did = true; } }
    });
    return did;
  }
  function projMsg(t) { var m = document.getElementById("projMsg"); if (m) m.textContent = t || ""; var m2 = document.getElementById("setMsg"); if (m2) m2.textContent = t || ""; say(t); }
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
      m.artwork = { origin: conv.origin, casinoName: conv.casinoName, layers: conv.layers.map(function (l) { var c = Object.assign({}, l); delete c.id; return c; }), band: conv.band, cards: conv.cards };
      m.cloth = conv.cloth; hasArt = true; hasTab = false;
      o = { name: o.name };
    } else {
      if (o.artwork) {
        m.artwork = Object.assign({}, cur.artwork, o.artwork);
        if (!o.artwork.origin) m.artwork.origin = defaultOrigin();   /* an older file: measured from the cloth centre */
        if (typeof o.artwork.casinoName !== "string") delete m.artwork.casinoName;   /* an older file: the name comes from its big texts */
      }
      if (o.cloth) m.cloth = Object.assign({}, cur.cloth, o.cloth);
      if (o.tables) m.tables = o.tables;
      if (o.guides) m.guides = o.guides;
      if (o.constraints) m.constraints = o.constraints;
      if (o.measures) m.measures = o.measures;
      if (o.cpoints) m.cpoints = o.cpoints;   /* partial files (artwork only, tables only) do not carry control points */
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
    if (o.words && typeof o.words === "object") { m.words = o.words; info.extras.push("words"); }
    if (o.view && typeof o.view === "object") m.view = o.view;
    if (o.randomizer && typeof o.randomizer === "object") m.randomizer = o.randomizer;
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
  /* Replaces the settings but keeps the view switches, which belong to the open project. */
  function replaceConfig(c) { var v = viewJSON(); config = c; VIEW_KEYS.forEach(function (k) { config[k] = v[k]; }); saveConfig(); }
  /* Words: "project" replaces the words of the open project (one undo step); "universal" replaces the user's universal words
   * (kept in the settings); "reset" goes back to the shipped words. Returns {ok, msg}. */
  function applyWords(kind, o) {
    var W = PTD.words;
    if (kind === "reset") { delete config.words; saveConfig(); renderPanels(); return { ok: true, msg: "The universal words are the shipped words again." }; }
    var r = typeof o === "string" ? W.parse(o) : { doc: W.normalize(o), useUniversal: o.useUniversal, problems: [] };
    if (!r.doc) return { ok: false, msg: r.problems[0] };
    var n = W.count(r.doc), note = r.problems.length ? " " + r.problems.join(" ") : "";
    if (kind === "universal-add") {
      if (!n) return { ok: false, msg: "There are no words to add." };
      config.words = W.normalize(W.merge([W.universal(), r.doc])); saveConfig(); renderPanels();
      return { ok: true, msg: "Added the words to the universal list (" + W.count(config.words) + " words now)." + note };
    }
    if (kind === "all-add") {   /* copies into every open project; the copies are separate from the universal list */
      if (!n) return { ok: false, msg: "There are no words to add." };
      var add = function (cur) { var q = W.normProject(cur); return { useUniversal: q.useUniversal, words: W.normalize(W.merge([q.words, r.doc])) }; };
      tabs.forEach(function (t) {
        if (t.id === activeId) { state.words = add(state.words); return; }
        var o2 = JSON.parse(t.json); o2.words = W.projectJSON(add(o2.words)); t.json = JSON.stringify(o2);
        if (t.hist && t.hist.last) { var h2 = JSON.parse(t.hist.last); h2.words = o2.words; t.hist.undo.push(t.hist.last); t.hist.last = JSON.stringify(h2); t.hist.redo = []; }
        t.dirty = true;
      });
      save(); renderPanels(); renderTabs();
      return { ok: true, msg: "Added the words to " + tabs.length + " open project(s)." + note };
    }
    if (kind === "universal") {
      if (!n) return { ok: false, msg: "The universal words are empty: nothing was changed. Use Reset to go back to the shipped words." };
      config.words = r.doc; saveConfig(); renderPanels();
      return { ok: true, msg: "Universal words loaded (" + n + " words)." + note };
    }
    state.words = { useUniversal: typeof r.useUniversal === "boolean" ? r.useUniversal : state.words.useUniversal, words: r.doc };
    save(); renderPanels();
    return { ok: true, msg: "Project words loaded (" + n + " words)." + note };
  }
  /* What a JSON text is, from its keys (the "format" key is only a help; any JSON can be pasted anywhere). */
  function kindOf(o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return "";
    if (o.format === CONFIG_FORMAT) return "settings";
    if (o.format === PROJECT_FORMAT) return "project";
    if (o.format === PTD.words.FORMAT) return "words";
    if (PTD.cutters.isCutterJSON(o)) return "cutters";
    var k = Object.keys(o);
    if (k.some(function (x) { return ["tables", "artwork", "guides", "constraints", "cloth", "layers", "stage"].indexOf(x) >= 0; })) return "project";
    if (k.some(function (x) { return PTD.words.LISTS.concat(PTD.words.MAPS, PTD.words.ENTRIES).indexOf(x) >= 0; })) return "words";
    if (k.some(function (x) { return ["units", "snap", "favouriteFonts", "cutterProfiles", "pressMm"].indexOf(x) >= 0; })) return "settings";
    return "";
  }
  /* Asks where a words list should go. scope "universal": the question from the universal window; "any": from a place that does not say. */
  function askWords(text, scope) {
    var opts = [["universal", "Replace the universal list"], ["universal-add", "Add to the universal list"],
      ["all-add", "Copy into every open project (adds; later changes to the universal list do not reach these copies)"]];
    if (scope === "any") opts.push(["project", "This project only (replaces its words)"]);
    var box = document.createElement("div");
    box.className = "modal"; box.id = "wordsAsk"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.innerHTML = '<div class="card"><p>These are word lists. Where should they go?</p><div class="bar" style="flex-direction:column;align-items:stretch">' +
      opts.map(function (o) { return '<button class="btn" type="button" data-choice="' + o[0] + '">' + esc(o[1]) + '</button>'; }).join("") +
      '<button class="btn" type="button" data-choice="cancel">Cancel</button></div></div>';
    document.body.appendChild(box);
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-choice]"); if (!b && e.target !== box) return;
      var c = b ? b.dataset.choice : "cancel";
      box.parentNode.removeChild(box);
      if (c === "cancel") { projMsg("Nothing was changed."); return; }
      var r = applyWords(c, text); projMsg(r.msg);
      var jb = PTD.jsonbox; if (jb && jb.isOpen()) jb.close();
    });
    var first = box.querySelector("button"); if (first) first.focus();
    return { ok: true, msg: "Choose where the words go." };
  }
  function applyPart(part, text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { return projDone(false, "That is not valid JSON."); }
    var k = kindOf(o);
    if (part === "words") { if (k === "project" || k === "settings") return loadText(text); var rw = applyWords("project", text); return projDone(rw.ok, rw.msg); }
    if (part === "universal") { if (k === "project" || k === "settings") return loadText(text); return askWords(text, "universal"); }
    if (part === "cutters") { if (k === "project" || k === "settings") return loadText(text); var rc = PTD.cutters.applyJSON(o.cutters || o.name !== undefined ? o : { cutters: [] }); return projDone(rc.ok, rc.msg); }
    if (part === "settings") return loadText(text);
    return loadText(text);
  }
  function projDone(ok, m) { projMsg(m); return { ok: ok, msg: m }; }
  /* Loads project (whole or partial), configuration or old logo-editor settings text. Returns {ok, msg}. */
  function loadText(text) {
    function done(ok, m) { projMsg(m); return { ok: ok, msg: m }; }
    var o;
    try { o = JSON.parse(text); } catch (e) { return done(false, "That is not valid JSON."); }
    if (o && (o.format === CONFIG_FORMAT || (!o.format && kindOf(o) === "settings"))) { replaceConfig(normConfig(o)); renderPanels(); renderStage(); return done(true, "Settings loaded."); }
    if (kindOf(o) === "words") return askWords(text, "any");
    if (kindOf(o) === "cutters") { var rk = PTD.cutters.applyJSON(o); return done(rk.ok, rk.msg); }
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
    if (part === "project") { curTab().dirty = false; renderTabs(); }
    projMsg("Saved " + name + " (" + d[1] + ").");
  }
  function projectToFile() { savePart("project"); }
  function openFile() { pickFile(document.getElementById("fileProject"), function (t) { loadText(t); }); }
  function newProject() { addTab(); }   /* a new project always opens in a new tab; the current one stays as it is */
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
    ui.altClick = !!e.altKey;   /* Alt held while clicking a delete button gives the Alt behaviour of REQ-027 */
    var l = id ? getLayer(id) : null;
    switch (act) {
      case "collapse": { ui.coll[d.key] = !ui.coll[d.key]; applyColl(b); return; }
      case "bandtoggle": {
        /* Lines & cards opens and closes with the same arrow button as a text panel. */
        bandPanel.open = !bandPanel.open;
        b.textContent = bandPanel.open ? "▲" : "▼"; b.setAttribute("aria-expanded", String(bandPanel.open));
        var bt2 = bandPanel.open ? "Collapse" : "Expand"; b.title = bt2; b.setAttribute("aria-label", bt2 + " lines and cards settings");
        return;
      }
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
      case "fontmenu": { var fi = b.parentNode.querySelector("input"); if (!menu.hidden && menuInput === fi) dismissMenu(); else { fi.focus(); openMenu(fi, true); } return; }
      case "select": if (e.shiftKey || e.ctrlKey || e.metaKey) toggleSel(id); else select(id); return;
      case "pick": pickItem(id || "band", e); return;
      case "eye":
        if (id && l) l.hidden = !l.hidden; else if (!id) state.band.hidden = !state.band.hidden; else return;
        renderPanels(); renderStage(); save(); return;
      case "lock":
        if (id && l) l.locked = !l.locked; else if (!id) state.band.locked = !state.band.locked; else return;
        renderPanels(); renderStage(); save("lock:" + Date.now()); return;
      case "grptoggle": case "grpselect": case "grpeye": case "grplock": case "grpadd": case "grpout": case "grpback": case "grpfront": case "grpungroup": case "grpdel": case "grpturn": groupAct(act, b, e); return;
      case "lout": if (l) { var keepSel = selLayers(); GR.takeOut(state, { l: l }); finishGroupOp(keepSel.length ? keepSel : [l], "Took the text out of its group.", "groupout"); } return;
      case "fav": if (l) { editTargets(l).forEach(function (t) { t.font = d.font; }); PTD.fonts.load(l.font); syncInputs(); renderStage(); save(); } return;
      case "front": moveInStack(id, 1); renderPanels(); renderStage(); save(); return;
      case "back": moveInStack(id, -1); renderPanels(); renderStage(); save(); return;
      case "bandup": moveInStack("band", 1); renderPanels(); renderStage(); save(); return;
      case "banddown": moveInStack("band", -1); renderPanels(); renderStage(); save(); return;
      case "del": if (l && l.locked) { say("This text is locked. Unlock it to delete it."); return; } actDelLayer(id, ui.altClick); renderPanels(); renderStage(); save(); return;
      case "placeorigin": placeOrigin(); return;
      case "royal": state.cards.hand = "As Ks Qs Js 10s"; syncInputs(); renderStage(); save(); return;
      case "random": {
        var deck = [], ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"], suits = ["s", "h", "d", "c"];
        ranks.forEach(function (r) { suits.forEach(function (s) { deck.push(r + s); }); });
        for (var i = deck.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
        state.cards.hand = deck.slice(0, 5).join(" "); syncInputs(); renderStage(); save(); return;
      }
      case "freeze": if (l) freezeLayer(l, true); return;
      case "unfreeze": if (l) freezeLayer(l, false); return;
      case "glyphcopy": if (l && l.glyph) PTD.glyphui.copy(glyphSVG(l)); return;
      case "glyphsave": if (l && l.glyph) { download((String(l.text || "glyph").replace(/[^\w.-]+/g, "-") || "glyph") + ".svg", glyphSVG(l), "image/svg+xml"); say("Saved the glyph as an SVG file."); } return;
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
      case "creset": replaceConfig(defaultConfig()); renderPanels(); renderStage(); projMsg("Configuration reset."); return;
      case "ptext": document.getElementById("projectText").value = JSON.stringify(toJSON(false), null, 1); return;
      case "pload": loadText(document.getElementById("pasteBox").value); return;
      case "papply": loadText(document.getElementById("projectText").value); return;
    }
    if (PTD.tables.act(act, d)) return;
    if (PTD.guides.act(act, d)) return;
    if (PTD.measure.act(act, d)) return;
    if (PTD.cpoints.act(act, d)) return;
    if (PTD.cutters.act(act, d)) return;
    if (PTD.exporter && PTD.exporter.act && PTD.exporter.act(act, d)) return;
    if (PTD.sheet && PTD.sheet.act && PTD.sheet.act(act, d)) return;
    if (PTD.random && PTD.random.act && PTD.random.act(act, d)) return;
  });
  document.getElementById("addText").addEventListener("click", function () {
    var base = getLayer(state.selected) || state.layers[0];
    var n = base ? Object.assign({}, base, { frozen: null, glyph: false, box: null }) : mkLayer("", "Mea Culpa", 120, 0, 400, 0, 0, true, false);
    var AO0 = artOrigin(), vcx = ui.view.cx - AO0.x, vcy = ui.view.cy - AO0.y;   /* the new text lands in the middle of the view */
    n.exact = true;   /* a new text is always centred exactly, whatever the text it was copied from */
    n.text = "Word"; n.x = Math.round(vcx); n.y = Math.round(vcy + n.size * 0.35); n.rot = 0; n.nameWord = false; n.gen = ""; n.styleHidden = false;
    n.id = "l" + (state.layers.length + 1);
    state.layers.push(n); state.selected = n.id; ui.extra = {}; ui.open[n.id] = true; clearOther();
    PTD.fonts.load(n.font); renderPanels(); renderStage();
    var tb = ui.tbox[n.id];   /* then the middle of its box is put on the middle of the view */
    if (tb && tb.h > 0) { n.y = Math.round(n.y + vcy - (tb.y + tb.h / 2)); renderStage(); }
    save();
  });

  /* ---------- toolbar ---------- */
  document.getElementById("projectName").addEventListener("input", function (e) { state.name = e.target.value; save("name"); renderTabs(); });
  document.getElementById("newBtn").onclick = newProject;
  document.getElementById("pinBtn").onclick = function () { PTD.measure.pin(); };
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
  document.getElementById("controls").addEventListener("change", function (e) { if (e.target.dataset && e.target.dataset.gfield) applyGroupField(e.target); });
  document.getElementById("lockBtn").onclick = toggleLockSelection;
  document.getElementById("splitBtn").onclick = function () { actSplit(); };
  document.getElementById("joinBtn").onclick = function () { actJoin(); };
  document.getElementById("groupBtn").onclick = function () { actGroup(); };
  document.getElementById("ungroupBtn").onclick = function () { actUngroup(); };
  svg.addEventListener("pointermove", lockHover);
  svg.addEventListener("pointerleave", function () { if (lockBadgeEl) lockBadgeEl.hidden = true; if (ui.tool === "clonehere" && ui.cloneHere) { ui.cloneHere.d = null; hideReadout(); requestRender(); } });
  svg.addEventListener("pointermove", function (e) { ui.lastPtr = { clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey }; if (ui.tool === "clonehere") cloneHereMove(e); });
  document.getElementById("outlineBtn").onclick = function () { ui.outlines = !ui.outlines; renderStage(); };
  document.getElementById("deselectBtn").onclick = function () { setSelection([]); clearOther(); renderPanels(); renderStage(); };
  document.getElementById("fitBtn").onclick = fitView;
  document.querySelectorAll("[data-tool]").forEach(function (b) {
    b.onclick = function () { setTool(b.dataset.tool); };
  });
  function Hp_open() { return !!(PTD.help && PTD.help.isOpen && PTD.help.isOpen()); }
  function setTool(t) {
    ui.tool = t; PTD.hints.tool(t); if (t !== "clonehere") ui.cloneHere = null; if (t !== "measure") ui.measure = null; if (t !== "dim") PTD.measure.cancel(); if (t !== "align") PTD.align.exit();
    say(t === "measure" ? "Click two points to measure. Snapping applies (Tab cycles through the snap points); hold Alt to ignore it." : t === "align" ? "Align: select objects and press Set alignment target, then select the objects to move and click a handle of their box (or drag it onto the target). Alt moves them one by one. Esc ends." : t === "cpoint" ? "Click a text to hang a control point on it, or an empty place for the artwork origin. Click again for more, Esc to stop." : t === "guideX" ? "Click to place a vertical guide." : t === "guideY" ? "Click to place a horizontal guide." : "");
    if (t === "clonehere") say("Click to put the clones where the ghost is. Shift+click puts them and stays in this mode. Esc or a right click cancels.");
    updateToolbar(); renderStage();
  }
  document.querySelectorAll("#tabs button").forEach(function (b) { b.onclick = function () { ui.prevTab = null; setTab(b.dataset.tab); }; });
  /* Cutters and Settings are shared by all projects, so their buttons are in the toolbar; a second click goes back to the tab before. */
  document.querySelectorAll("[data-gtab]").forEach(function (b) {
    b.onclick = function () {
      var g = b.dataset.gtab;
      if (ui.tab === g) setTab(ui.prevTab && ui.prevTab !== g ? ui.prevTab : "artwork");
      else { ui.prevTab = ui.tab; setTab(g); }
    };
  });

  /* ---------- snapping ---------- */
  function candidatesAxis(axis, opts) {
    var out = [{ v: 0, tag: "Cloth centre" }];
    state.guides.forEach(function (g) { if (!g.hidden && g.axis === axis && g.id !== (opts && opts.skipGuide)) PTD.guides.lines(g).forEach(function (k) { out.push(k); }); });
    PTD.cpoints.snapPoints(opts && opts.skipCps).forEach(function (q) { out.push({ v: axis === "x" ? q.x : q.y, tag: q.tag }); });
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
    PTD.cpoints.snapPoints(opts.skipCps).forEach(function (q) {
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
  /* The value next to the pointer while dragging (REQ-017). A drag gives `readout(point, event)`; it is shown only when the option is on. */
  var readoutEl = document.getElementById("dragReadout");
  function hideReadout() { if (readoutEl) readoutEl.hidden = true; }
  function showReadout(text, ev) {
    if (!readoutEl) return;
    if (!config.dragReadout || !text) { readoutEl.hidden = true; return; }
    readoutEl.textContent = text; readoutEl.hidden = false;
    var w = readoutEl.offsetWidth, hh = readoutEl.offsetHeight, x = ev.clientX + 16, y = ev.clientY + 18;
    if (x + w > window.innerWidth - 4) x = ev.clientX - w - 12;
    if (y + hh > window.innerHeight - 4) y = ev.clientY - hh - 12;
    readoutEl.style.left = Math.max(4, x) + "px"; readoutEl.style.top = Math.max(4, y) + "px";
  }
  /* What is selected, to put back after a cancelled drag has restored the project. */
  function keepSelection() {
    var k = { selected: state.selected, extra: Object.assign({}, ui.extra), selTable: ui.selTable, selNode: ui.selNode, selGuide: ui.selGuide, selMeasure: ui.selMeasure, selCp: ui.selCp };
    return function () { state.selected = k.selected; ui.extra = k.extra; ui.selTable = k.selTable; ui.selNode = k.selNode; ui.selGuide = k.selGuide; ui.selMeasure = k.selMeasure; ui.selCp = k.selCp; };
  }
  /* Every drag of the program goes through here. `h`: move(point, event), up(event), and optional
     op (the id of its hint), readout(point, event), cancel() (otherwise Esc restores the project as it was when the drag began)
     and ownEsc (the drag handles Esc itself). Pressing or releasing Shift, Alt or Ctrl runs `move` again with the new key state. */
  function startDrag(e, h) {
    ui.dragging = true;
    var d = { last: { clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, preventDefault: function () {} } };
    var before = h.ownEsc ? null : snapshot();
    if (h.op && PTD.hints) PTD.hints.drag(h.op);
    function run(ev) {
      var q = toWorld(ev);
      h.move(q, ev);
      if (h.readout) showReadout(h.readout(q, ev), ev); else hideReadout();
    }
    function mv(ev) { d.last = ev; run(ev); }
    function finish() {
      ui.dragging = false;
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", upf); window.removeEventListener("pointercancel", upf);
      window.removeEventListener("keydown", keyf, true); window.removeEventListener("keyup", keyf, true);
      hideReadout();
      if (h.op && PTD.hints) PTD.hints.dragEnd();
    }
    function upf(ev) { finish(); if (h.up) h.up(ev); }
    function keyf(ev) {
      if (ev.key === "Escape" && ev.type === "keydown" && !h.ownEsc) {
        ev.preventDefault(); ev.stopPropagation();
        var back = keepSelection();
        finish(); ui.snapLines = null; ui.marquee = null; ui.endDrag = null;
        if (h.cancel) h.cancel(); else if (before) { restore(before); back(); renderPanels(); }
        renderStage(); say("");
        return;
      }
      if (!/^(Shift|Alt|Control|Meta)$/.test(ev.key)) return;
      if (ev.key === "Alt") ev.preventDefault();   /* a lone Alt would otherwise move the focus to the browser menu */
      if (ev.repeat) return;
      var l = d.last, ev2 = { clientX: l.clientX, clientY: l.clientY, shiftKey: ev.shiftKey, altKey: ev.altKey, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, preventDefault: function () {} };
      d.last = ev2; run(ev2);
    }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", upf); window.addEventListener("pointercancel", upf);
    window.addEventListener("keydown", keyf, true); window.addEventListener("keyup", keyf, true);
  }
  var spaceDown = false, hoverStage = false;
  function startPan(e, menu) {
    var sx = e.clientX, sy = e.clientY, cx = ui.view.cx, cy = ui.view.cy, target = e.target, moved = !menu;
    stageWrap.classList.add("panning"); PTD.hints.drag("pan");
    function mv(ev) {
      if (!moved) { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) <= 4) return; moved = true; }
      ui.view.cx = cx - (ev.clientX - sx) / ui.view.z; ui.view.cy = cy - (ev.clientY - sy) / ui.view.z; requestRender();
    }
    function upf(ev) {
      PTD.hints.dragEnd(); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", upf); window.removeEventListener("pointercancel", upf); stageWrap.classList.remove("panning"); updateToolbar();
      if (menu && !moved && ev && ev.type === "pointerup") openCtxMenu(target, ev.clientX, ev.clientY);
    }
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", upf); window.addEventListener("pointercancel", upf);
  }
  /* ---------- the right-click menu (REQ-028) ---------- */
  var ctxEl = document.getElementById("ctxMenu"), ctxItems = [], ctxIdx = -1, ctxAlt = false;
  function closeCtx() { if (ctxEl) ctxEl.hidden = true; ctxItems = []; ctxIdx = -1; }
  function drawCtx() {
    ctxEl.innerHTML = ctxItems.map(function (it, i) {
      if (it.sep) return '<div class="sep"></div>';
      return '<div class="it' + (it.off ? " off" : "") + (i === ctxIdx ? " act" : "") + '" role="menuitem" data-i="' + i + '"' + (it.why ? ' title="' + esc(it.why) + '"' : "") + ">" + esc(it.label) + (it.kbd ? "<kbd>" + esc(it.kbd) + "</kbd>" : "") + "</div>";
    }).join("");
  }
  function openCtxMenu(target, x, y) {
    if (!ctxEl || ui.tool !== "select" || !target || !target.closest) return;
    var id = idOf(target); if (!id) return;
    var items = [];
    if (id === "band") {
      if (!isSel("band")) select("band", true);
      items = [{ label: "Bring to front", run: function () { actStack("front"); } }, { label: "Bring forward", run: function () { actStack("up"); } }, { label: "Send backward", run: function () { actStack("down"); } }, { label: "Send to back", run: function () { actStack("back"); } }, { sep: true }, { label: "Hide", kbd: "Delete", off: !!state.band.locked, why: state.band.locked ? "The lines and cards are locked." : "", run: function () { deleteSelection(ctxAlt); } }];
    } else {
      if (!isSel(id)) select(id, !config.openOnSelect);
      var texts = selectedIds().map(getLayer).filter(Boolean), editable = texts.filter(function (l) { return !l.locked && !l.frozen; });
      var why = editable.length ? "" : (texts.some(function (l) { return l.locked; }) ? "The selected text is locked." : "The selected text is frozen.");
      var splitWhy = texts.length !== 1 ? "Select one text to split it." : texts[0].locked ? "The text is locked." : texts[0].frozen ? "The text is frozen." : wordsOf(texts[0].text).length < 2 ? "The text has only one word." : "";
      var joinWhy = texts.length < 2 ? "Select two or more texts to join them." : texts.some(function (l) { return l.locked; }) ? "A selected text is locked." : texts.some(function (l) { return l.frozen; }) ? "A selected text is frozen." : "";
      var grpWhy = texts.length < 2 ? "Select two or more texts to group them." : GR.units(state, texts).length < 2 ? "These texts already form one group." : texts.some(function (l) { return l.gen; }) ? "A text made by a name style cannot be grouped." : "";
      var one = texts.length === 1 ? texts[0] : null, pat = one && one.pattern ? one : null, mkWhy = !one ? "Select one object." : !one.uid ? "Save the project once so the object has a permanent id." : "";
      var gitems = [];
      if (pat) gitems.push({ label: "Edit graph", run: function () { PTD.pathsui.openEditor(); } });
      Object.keys(PTD.pathsui ? PTD.pathsui.makers : {}).forEach(function (k) { var m = PTD.pathsui.makers[k]; gitems.push({ label: m.label, off: mkWhy !== "", why: mkWhy || m.tip, run: function () { PTD.pathsui.make(k, one); } }); });
      var ungWhy = GR.units(state, texts).some(function (u) { return !!u.g; }) ? "" : "Select a whole group to ungroup it.";
      var outWhy = texts.some(function (l) { return !!l.group; }) ? "" : "The selected text is not in a group.";
      items = [
        { label: "Font", kbd: "F", off: !editable.length, why: why, run: jumpToFont },
        { label: "Size", kbd: "S", off: !editable.length, why: why, run: jumpToSize },
        { label: "Clone", kbd: "Ctrl+D", run: function () { actClone(); } },
        { label: "Clone to cursor", run: startCloneHere },
        { label: "Split words", off: splitWhy !== "", why: splitWhy, run: function () { actSplit(); } },
        { label: "Join texts", off: joinWhy !== "", why: joinWhy, run: function () { actJoin(); } },
        { label: "Group", kbd: "Ctrl+G", off: grpWhy !== "", why: grpWhy, run: function () { actGroup(); } },
        { label: "Ungroup", kbd: "Ctrl+Shift+G", off: ungWhy !== "", why: ungWhy, run: function () { actUngroup(); } },
        { label: "Take out of group", off: outWhy !== "", why: outWhy, run: function () { actTakeOut(); } },
        { sep: true }
      ].concat(gitems, [
        { sep: true },
        { label: "Bring to front", run: function () { actStack("front"); } },
        { label: "Bring forward", run: function () { actStack("up"); } },
        { label: "Send backward", run: function () { actStack("down"); } },
        { label: "Send to back", run: function () { actStack("back"); } },
        { sep: true },
        { label: "Delete", kbd: "Delete", off: !texts.some(function (l) { return !l.locked; }), why: texts.some(function (l) { return !l.locked; }) ? "" : "The selected text is locked.", run: function () { deleteSelection(ctxAlt); } }
      ]);
    }
    ctxItems = items; ctxIdx = -1; drawCtx();
    ctxEl.hidden = false;
    var w = ctxEl.offsetWidth, h = ctxEl.offsetHeight;
    ctxEl.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, x)) + "px"; ctxEl.style.top = Math.max(4, Math.min(window.innerHeight - h - 4, y)) + "px";
  }
  function runCtx(i, alt) {
    var it = ctxItems[i]; if (!it || it.sep || it.off) return;
    ctxAlt = !!alt; closeCtx(); it.run();
  }
  if (ctxEl) {
    ctxEl.addEventListener("mousedown", function (e) { e.preventDefault(); var n = e.target.closest(".it"); if (n) runCtx(Number(n.dataset.i), e.altKey); });
    ctxEl.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    document.addEventListener("pointerdown", function (e) { if (!ctxEl.hidden && !ctxEl.contains(e.target)) closeCtx(); }, true);
    document.addEventListener("keydown", function (e) {
      if (ctxEl.hidden) return;
      var live = ctxItems.map(function (it, i) { return it.sep || it.off ? -1 : i; }).filter(function (i) { return i >= 0; });
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeCtx(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); e.stopPropagation();
        var pos = live.indexOf(ctxIdx), n = live.length; if (!n) return;
        pos = e.key === "ArrowDown" ? (pos + 1) % n : (pos <= 0 ? n - 1 : pos - 1);
        ctxIdx = live[pos]; drawCtx();
      } else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (ctxIdx >= 0) runCtx(ctxIdx, e.altKey); }
    }, true);
  }
  function dragArtwork(e, ids, p, all, toggleOff, descendId) {
    var starts = {}, bnd = {}, items = ids.slice(), skipped = 0;
    if (all) { items = state.layers.map(function (l) { return l.id; }); items.push("band"); }
    items = items.filter(function (k) { if (isLockedKey(k)) { skipped++; return false; } return true; });   /* locked things stay where they are */
    if (skipped && !all) say(skipped === 1 ? "A locked thing stays in place." : skipped + " locked things stay in place.");
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
    var moved = false, cur = { dx: 0, dy: 0 };
    startDrag(e, {
      op: all ? "move-all" : "move",
      readout: function () { return "dx " + fmtLen(cur.dx) + "   dy " + fmtLen(cur.dy); },
      move: function (q, ev) {
        var dx = q.x - p.x, dy = q.y - p.y;
        if (config.snap && !ev.altKey && !ev.ctrlKey && u && !all) { var r = snapGroup(u, dx, dy, items); dx = r.dx; dy = r.dy; }
        else { dx = round(dx, 1); dy = round(dy, 1); ui.snapLines = null; }
        cur.dx = dx; cur.dy = dy;
        if (dx || dy) moved = true;
        items.forEach(function (k) {
          var o = k === "band" ? state.band : getLayer(k);
          o.x = round(starts[k].x + dx, 2); o.y = round(starts[k].y + dy, 2);
        });
        renderStage(); syncInputs();
      },
      up: function () {
        ui.snapLines = null;
        if (!moved && descendId && getLayer(descendId)) { descendInto(getLayer(descendId)); return; }
        if (!moved && toggleOff) { setSelection([]); clearOther(); renderPanels(); }
        renderStage(); if (moved) save("move");
      }
    });
  }
  function marquee(e, p) {
    var add = e.shiftKey || e.ctrlKey || e.metaKey, base = add ? selectedIds() : [], prevSel = selectedIds(), found = 0;
    if (!add) { setSelection([]); clearOther(); renderPanels(); }
    startDrag(e, {
      op: "marquee",
      readout: function () { return (ui.marquee ? fmtLen(ui.marquee.w) + " x " + fmtLen(ui.marquee.h) : "") + "   " + found + " selected"; },
      cancel: function () { ui.marquee = null; setSelection(prevSel); },
      move: function (q) {
        var x0 = Math.min(p.x, q.x), y0 = Math.min(p.y, q.y), w = Math.abs(q.x - p.x), h = Math.abs(q.y - p.y);
        ui.marquee = { x: x0, y: y0, w: w, h: h };
        var hit = Object.keys(ui.bounds).filter(function (k) { var b = ui.bounds[k]; return b.x < x0 + w && b.x + b.w > x0 && b.y < y0 + h && b.y + b.h > y0; });
        var ids = expandIds(base.concat(hit.filter(function (k) { return base.indexOf(k) < 0; })));
        state.selected = ids[0] || null; ui.extra = {}; ids.slice(1).forEach(function (k) { ui.extra[k] = true; });
        found = ids.length; ui.areaSel = true;
        renderStage();
      },
      up: function () { ui.marquee = null; openTopmostSelected(); renderPanels(); renderStage(); }
    });
  }
  svg.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  svg.addEventListener("pointerdown", function (e) {
    closeMenu();
    if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body && !svg.contains(document.activeElement)) document.activeElement.blur();
    var p = toWorld(e);
    if (e.button === 2 && ui.tool === "clonehere") { e.preventDefault(); hideReadout(); setTool("select"); return; }
    if (e.button === 2 || (e.button === 0 && spaceDown)) { e.preventDefault(); startPan(e, e.button === 2); return; }
    if (e.button === 1) { e.preventDefault(); dragArtwork(e, [], p, true); return; }
    if (e.button !== 0) return;
    if (ui.tool === "clonehere") { cloneHereClick(e); return; }
    if (ui.tool === "dim") { PTD.measure.click(p, e); return; }
    if (ui.tool === "cpoint") { PTD.cpoints.click(p, e); return; }
    if (ui.tool === "align") { PTD.align.down(p, e); return; }
    if (ui.tool === "measure") {
      ui.snapLines = null; PTD.measure.tempClick(p, e); return;
    }
    if (ui.tool === "guideX" || ui.tool === "guideY") {
      var sp = config.snap && !e.altKey ? snapXY(p, {}) : { x: round(p.x, 1), y: round(p.y, 1) }; ui.snapLines = null;
      var ax = ui.tool === "guideX" ? "x" : "y"; PTD.guides.add(ax, ax === "x" ? sp.x : sp.y); setTool("select"); return;
    }
    if (ui.selMeasure && !(e.target.closest && e.target.closest('[data-h^="meas:"]'))) ui.selMeasure = null;
    var hnode = e.target.closest && e.target.closest("[data-h]");
    if (hnode) {
      var h = hnode.dataset.h, kind = h.split(":")[0];
      if (kind === "guide" ? PTD.guides.pointerDown(e, h, p) : kind === "meas" ? PTD.measure.pointerDown(e, h, p) : kind === "cp" ? PTD.cpoints.pointerDown(e, h, p) : kind === "thandle" ? PTD.thandles.pointerDown(e, h, p) : PTD.tables.pointerDown(e, h, p)) { e.preventDefault(); return; }
    }
    var pid = idOf(e.target);
    if (pid) {
      var id = pid;
      var fromOtherTab = ui.tab !== "artwork";   /* a click on a text always brings the Artwork tab forward */
      if (fromOtherTab) setTab("artwork");
      if (e.shiftKey || e.ctrlKey || e.metaKey) { toggleUnit(id); openTopmostSelected(); revealSelected(); return; }
      /* a second press on a text of a group within 450 ms goes one level into the group (the stage is redrawn between the presses, so the browser does not send a dblclick) */
      var nowT = Date.now(), dl = id === "band" ? null : getLayer(id), dbl = !!(ui.lastDown && ui.lastDown.id === id && nowT - ui.lastDown.t < 450 && Math.abs(e.clientX - ui.lastDown.x) < 6 && Math.abs(e.clientY - ui.lastDown.y) < 6);
      ui.lastDown = { id: id, t: nowT, x: e.clientX, y: e.clientY };
      if (dbl && dl && dl.pattern && ui.tool === "select" && PTD.pathsui) { PTD.pathsui.openEditor(); ui.lastDown = null; }   /* a double click on a pattern opens its graph */
      var descendId = dbl && dl && dl.group && ui.tool === "select" ? id : null;   /* done when the press ends without a drag */
      if (descendId) ui.lastDown = null;
      var toggleOff = !fromOtherTab && !(dbl && dl && dl.pattern) && isSel(id) && selectedIds().length === 1 ? id : null;   /* a click without a drag on the only selected item deselects it */
      if (!isSel(id)) { var gl = id === "band" ? null : getLayer(id); if (gl && GR.top(state, gl)) selectGroup(GR.top(state, gl).uid); else select(id, !config.openOnSelect); }
      else { clearOther(); if (fromOtherTab || (config.openOnSelect && id !== "band" && !ui.open[id])) { if (config.openOnSelect && id !== "band") ui.open[id] = true; renderPanels(); renderStage(); revealSelected(); } }
      dragArtwork(e, selectedIds(), p, false, toggleOff, descendId); return;
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
  /* the item under the pointer for the modes where the stage does not carry hit elements */
  ["pointerdown", "contextmenu"].forEach(function (n) { svg.addEventListener(n, function (e) { ui.pickId = pickFor(e); }, true); });
  svg.addEventListener("pointermove", function (e) {
    if (e.buttons || hitMode() === "box" || hitMode() === "shape") { if (svg.style.cursor) svg.style.cursor = ""; return; }
    ui.pickId = pickFor(e); svg.style.cursor = ui.pickId && ui.tool === "select" ? "move" : "";
  });
  svg.addEventListener("pointermove", function (e) {
    showTip(e);
    var p = toWorld(e);
    document.getElementById("cursorPos").textContent = "X " + fmtLen(p.x) + "   Y " + fmtLen(p.y);
    if (ui.tool === "dim") PTD.measure.move(p, e);
    if (ui.tool === "align") PTD.align.move(p, e);
    if (ui.tool === "measure") {
      ui.snapLines = null; PTD.measure.tempMove(p, e);
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
  document.addEventListener("keyup", function (e) { if (e.key === "Alt" && ui.altDelete) { e.preventDefault(); ui.altDelete = false; } });
  /* S (REQ-026): like F, for the size. The size field gets the focus with its number selected; Enter keeps the value, Esc puts the size back
     that all the selected texts had, and the field lets go of the focus in both cases. One undo step for the whole edit. */
  function jumpToSize() {
    if (ui.tool !== "select") { say("S works in the Select tool. Press Esc to leave the current tool first."); return; }
    var texts = selectedIds().filter(function (k) { return !!getLayer(k); });
    if (!texts.length) { say("No text selected. Select a text to change its size."); return; }
    var best = null;
    state.layers.forEach(function (l, i) {
      if (texts.indexOf(l.id) < 0 || l.frozen || l.locked) return;
      var o = panelOrder(i);
      if (!best || o < best.o) best = { o: o, l: l };
    });
    if (!best) { say(texts.some(function (k) { return getLayer(k).locked; }) ? "The selected text is locked. Unlock it to change its size." : "The selected text is frozen. Unfreeze it to change its size."); return; }
    if (PTD.random && PTD.random.isRunning && PTD.random.isRunning()) PTD.random.stop();
    say("");
    ui.open[best.l.id] = true; setTab("artwork"); renderPanels();
    var fi = document.querySelector('[data-panel="' + best.l.id + '"] [data-scope="layer:' + best.l.id + '"][data-key="size"][type="number"]');
    if (!fi) return;
    fi.scrollIntoView({ block: "nearest" });
    ui.sizeEdit = { inp: fi, orig: editTargets(best.l).filter(function (t) { return !t.frozen && !t.locked; }).map(function (t) { return { t: t, size: t.size }; }) };
    groupBegin();
    fi.focus(); fi.select();
  }
  document.addEventListener("keydown", function (e) {
    var se = ui.sizeEdit;
    if (!se || document.activeElement !== se.inp) return;
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); se.inp.blur(); }
    else if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      se.orig.forEach(function (o) { o.t.size = o.size; });
      renderStage(); save();
      se.inp.blur(); syncInputs();
    }
  }, true);
  document.addEventListener("focusout", function (e) {
    var se = ui.sizeEdit;
    if (se && e.target === se.inp) { ui.sizeEdit = null; groupEnd(); }
  });
  /* F (REQ-019): bring the Artwork tab forward, jump to the topmost selected text in the list and open its font list. */
  function jumpToFont() {
    if (ui.tool !== "select") { say("F works in the Select tool. Press Esc to leave the current tool first."); return; }
    var texts = selectedIds().filter(function (k) { return !!getLayer(k); });
    if (!texts.length) { say("No text selected. Select a text to change its font."); return; }
    var best = null;
    state.layers.forEach(function (l, i) {
      if (texts.indexOf(l.id) < 0 || l.frozen || l.locked) return;
      var o = panelOrder(i);
      if (!best || o < best.o) best = { o: o, l: l };
    });
    if (!best) { say(texts.some(function (k) { return getLayer(k).locked; }) ? "The selected text is locked. Unlock it to change its font." : "The selected text is frozen. Unfreeze it to change its font."); return; }
    if (PTD.random && PTD.random.isRunning && PTD.random.isRunning()) PTD.random.stop();   /* it replaces fonts and texts every round */
    say("");
    ui.open[best.l.id] = true; setTab("artwork"); renderPanels();
    var fi = document.querySelector('[data-panel="' + best.l.id + '"] [data-fontinput]');
    if (!fi) return;
    fi.scrollIntoView({ block: "nearest" });
    fi.focus();   /* focusing the field opens its list, as a click does */
  }
  /* Does this browser's text box include the letter space after the last character? Probed once. */
  var trailLS = null;
  function trailingLS() {
    if (trailLS !== null) return trailLS;
    try {
      var sv = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      sv.setAttribute("style", "position:absolute;left:-9999px;width:10px;height:10px");
      var tx = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tx.setAttribute("font-size", "20"); tx.textContent = "II";
      sv.appendChild(tx); document.body.appendChild(sv);
      var w0 = tx.getBBox().width; tx.style.letterSpacing = "10px";
      var w1 = tx.getBBox().width; document.body.removeChild(sv);
      trailLS = (w1 - w0) > 15;   /* 20 = both letters carry the space, 10 = only the gap between them */
    } catch (e) { trailLS = false; }
    return trailLS;
  }
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
    /* Esc ends whatever is being placed (a measurement, a guide, the Measure tool) even when a field still has the focus */
    if (e.key === "Escape" && (ui.tool !== "select" || ui.dim || ui.measure) && !Hp_open()) {
      if (isTextField(e.target) && e.target.blur) e.target.blur();
      setTool("select"); ui.measure = null; ui.tempHover = null; PTD.measure.syncPin(); e.preventDefault(); return;
    }
    if (isTextField(e.target)) return;
    /* a focused slider owns the arrow keys (Shift = ten steps); the stage nudge must not steal them (REQ-037) */
    if (e.target && e.target.tagName === "INPUT" && e.target.type === "range") {
      var rk = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (rk) {
        e.preventDefault();
        var rg = e.target, st = parseFloat(rg.step) || 1, mn = parseFloat(rg.min), mx = parseFloat(rg.max);
        var nv = parseFloat(rg.value) + rk * st * (e.shiftKey ? 10 : 1);
        rg.value = Math.min(isNaN(mx) ? nv : mx, Math.max(isNaN(mn) ? nv : mn, nv));
        rg.dispatchEvent(new Event("input", { bubbles: true })); rg.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (/^(Arrow|Page|Home|End)/.test(e.key)) return;
    }
    var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === "y") { e.preventDefault(); redo(); return; }
    if (mod && k === "a") { e.preventDefault(); setSelection(stackIds()); return; }
    if (mod && !e.altKey && k === "d" && !ui.dragging) { e.preventDefault(); if (ui.tool !== "select") say("Clone works in the Select tool. Press Esc to leave the current tool first."); else actClone(); return; }
    if (mod && !e.altKey && k === "g" && !ui.dragging) { e.preventDefault(); if (ui.tool !== "select") say("Group works in the Select tool. Press Esc to leave the current tool first."); else if (e.shiftKey) actUngroup(); else actGroup(); return; }
    if (!mod && !e.altKey && k === "f" && !ui.dragging) { e.preventDefault(); jumpToFont(); return; }
    if (!mod && !e.altKey && k === "s" && !ui.dragging) { e.preventDefault(); jumpToSize(); return; }
    if (!mod && !e.altKey && k === "h" && !ui.dragging) { e.preventDefault(); if (e.shiftKey) showAllHidden(); else toggleHideSelection(); return; }
    if (!mod && !e.altKey && k === "l" && !ui.dragging) { e.preventDefault(); toggleLockSelection(); return; }
    if (e.key === "Escape") { setTool("select"); ui.measure = null; ui.tempHover = null; PTD.measure.syncPin(); return; }
    if (e.key === "Tab" && !mod && PTD.measure.cycle()) { e.preventDefault(); return; }
    if (e.key === "Enter" && ui.tool === "measure" && PTD.measure.pin()) { e.preventDefault(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && e.altKey) ui.altDelete = true;   /* a lone Alt release would take the focus to the browser menu */
    if ((e.key === "Delete" || e.key === "Backspace") && ui.tool === "align" && deleteAlignSelection(e.altKey)) { e.preventDefault(); return; }
    if (PTD.cpoints.key(e)) { e.preventDefault(); return; }
    if (PTD.tables.key(e)) { e.preventDefault(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && ui.selMeasure && PTD.measure.removeSelected()) { e.preventDefault(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && ui.selGuide) { var gid = ui.selGuide; PTD.guides.remove(gid); e.preventDefault(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && ui.tool === "select" && deleteSelection(e.altKey)) { e.preventDefault(); return; }
    var arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key]) {
      var stepMm = e.shiftKey ? 10 : 1, dx = arrows[e.key][0] * stepMm, dy = arrows[e.key][1] * stepMm;
      var t = PTD.tables.get(ui.selTable), g = PTD.guides.get(ui.selGuide);
      if (t && !t.locked) { t.x += dx; t.y += dy; }
      else if (g && !g.locked) { var pos = PTD.guides.abs(g) + (g.axis === "x" ? dx : dy); var r = PTD.guides.resolve({ id: g.id, axis: g.axis, pos: pos }); if (r.ok) PTD.guides.setAbs(g, pos); else say(PTD.guides.conflictText(r)); }
      else { selectedIds().forEach(function (id) { var o = id === "band" ? state.band : getLayer(id); if (o && !o.locked) { o.x += dx; o.y += dy; } }); }
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
      actStack: actStack, stackIds: stackIds, pivotOf: pivotOf, pcOf: pcOf, selectedIds: selectedIds, addGlyph: actAddGlyph, glyphSVG: glyphSVG, actClone: actClone, actSplit: actSplit, actJoin: actJoin, actGroup: actGroup, actUngroup: actUngroup, actTakeOut: actTakeOut, actAddTo: actAddTo, curGroup: curGroup, selectGroup: selectGroup, turnGroup: turnGroup, scaleSet: scaleSet, groupBox: groupBox, startCloneHere: startCloneHere, showReadout: showReadout, hideReadout: hideReadout, deleteSelection: deleteSelection, lockIcon: lockIcon, isLockedKey: isLockedKey, toggleLockSelection: toggleLockSelection, state: function () { return state; }, cfg: function () { return config; }, ui: ui, esc: esc, h: H, fmtLen: fmtLen, colorHex: colorHex, colourId: colourId,
      el: el, eyeBtn: eyeBtn, nextId: nextId, setTab: setTab, renderPanels: renderPanels, renderStage: renderStage, syncInputs: syncInputs,
      save: save, say: say, setTool: setTool, toPartJSON: toPartJSON, savePart: savePart, openFile: openFile, startDrag: startDrag, snapXY: snapXY, afterFont: afterFont, download: download, toJSON: toJSON, parseHand: parseHand,
      cardLayout: cardLayout, cardSize: cardSize, artOrigin: artOrigin, placeOrigin: placeOrigin, anchorTable: anchorTable, drawArtwork: drawArtwork, drawObjects: drawObjects, makeGradients: makeGradients, parseHandX: null, unitF: unitF, getLayer: getLayer, slug: slug, mix: mix, round: round, fitView: fitView, fontFamilyCss: fontFamilyCss,
      saveConfig: saveConfig, isSel: isSel, loadText: loadText, applyPart: applyPart, applyWords: applyWords, kindOf: kindOf, pickFile: pickFile, switchTab: switchTab, addTab: addTab, closeTab: closeTab, tabs: function () { return tabs; }, activeTab: function () { return activeId; }, deselectAll: deselectAll, mkLayer: mkLayer, normLayer: normLayer, groupBegin: groupBegin, groupEnd: groupEnd
    };
    try { config = normConfig(JSON.parse(localStorage.getItem(KEY_CONFIG) || "null")); } catch (e) { config = defaultConfig(); }
    state = defaults();
    var loaded = false;
    try {
      var fr = localStorage.getItem(KEY_FONTS);
      if (fr) PTD.fonts.restoreStorage(JSON.parse(fr));
      var idx = JSON.parse(localStorage.getItem(KEY_TABS) || "null");
      if (idx && Array.isArray(idx.ids)) {
        idx.ids.forEach(function (id) {
          var txt = localStorage.getItem(KEY_TAB + id);
          if (txt) { var o2 = JSON.parse(txt); tabs.push({ id: id, name: String(o2.name || ""), json: txt, hist: newHist(), dirty: false }); var nn = parseInt(String(id).slice(1), 10); if (nn > tabSeq) tabSeq = nn; }
        });
      }
      if (!tabs.length) {   /* first start with tabs: the single project of earlier versions becomes the first tab */
        var raw = localStorage.getItem(KEY_PROJECT), legacy = localStorage.getItem(KEY_LEGACY);
        if (raw || legacy) { var o1 = JSON.parse(raw || legacy); tabs.push({ id: newTabId(), name: String(o1.name || ""), json: raw || legacy, hist: newHist(), dirty: false }); }
      }
      if (tabs.length) {
        var first = tabs.filter(function (t) { return idx && t.id === idx.active; })[0] || tabs[0];
        hist = first.hist; adoptProject(JSON.parse(first.json)); activeId = first.id; loaded = true;
      }
    } catch (e) { loaded = false; tabs = []; }
    if (!loaded) {
      tabs = []; state = defaults(); PTD.guides.resolve(); state.layers.forEach(function (l) { PTD.fonts.load(l.font); });
      var t1 = { id: newTabId(), name: state.name, json: null, hist: hist, dirty: false }; tabs.push(t1); activeId = t1.id;
    }
    curTab().hist = hist;
    if (PTD.layout) PTD.layout.init();
    renderPanels(); renderStage();
    fitView();
    hist.last = snapshot(); updateHistoryButtons(); renderTabs();
    if (window.ResizeObserver) new ResizeObserver(function () { requestRender(); }).observe(stageWrap);
    document.fonts.addEventListener("loadingdone", requestRender);
    window.addEventListener("resize", requestRender);
    PTD.help.init();
  }
  boot();
})(window.PTD = window.PTD || {});
