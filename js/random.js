/* Randomizer: shuffles fonts, sizes and layout of the artwork texts (and, if asked, the table shapes)
 * on a timer, and can invent a whole casino name with helper texts from nothing.
 * Everything a run changes is one undo step. Text always stays inside the player area. */
(function (PTD) {
  "use strict";
  var R = {};
  var C = function () { return PTD.core; };
  var G = PTD.geom, F = PTD.fonts, T = PTD.tables;

  R.opts = { interval: 5, shape: false, bet: true };
  var run = { on: false, t0: 0, timer: null, plan: null, busy: false, last: "" };

  /* ---------- random helpers ---------- */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function irnd(a, b, step) { step = step || 1; return a + step * Math.floor(Math.random() * ((b - a) / step + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function chance(p) { return Math.random() < p; }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

  /* ---------- name inventor ---------- */
  var ADJ = ["Golden", "Silver", "Royal", "Velvet", "Crimson", "Midnight", "Lucky", "Imperial", "Noble", "Emerald", "Ivory", "Scarlet",
    "Sapphire", "Black", "Grand", "Regal", "Gilded", "Sovereign", "Wild", "Silent", "Blue", "Red", "Crystal", "Eternal", "Amber", "Onyx"];
  var NOUN = ["Aces", "Crown", "Kings", "Queens", "Spade", "Heart", "Diamond", "Club", "Dragon", "Phoenix", "Falcon", "Raven", "Lion",
    "Tiger", "Orchid", "Rose", "Palace", "Fortune", "Chance", "Jackpot", "Joker", "River", "Bluff", "Dealer", "Chip", "Dice", "Flush",
    "Straight", "Pocket", "Wager", "Gambit", "Ante"];
  var PLACE = ["Monaco", "Riviera", "Venice", "Istanbul", "Havana", "Marrakesh", "Capri", "Lisbon", "Vienna", "Baroque", "Orient",
    "Sahara", "Atlantic", "Nordic", "Baltic", "Paris", "Praha", "Biarritz", "Cannes"];
  var NAME = ["Molino", "Beaumont", "Montague", "Valentino", "Casanova", "Fontaine", "Lafayette", "Sinclair", "Monroe", "Delacroix",
    "Romanov", "Medici", "Borgia", "Sterling", "Winchester", "Hartley", "Rothschild", "Kingsley"];
  var SUFFIX = ["Royale", "Palace", "Club", "Lounge", "Society", "Salon", "Grand", "Noir", "Rouge", "Parlour", "House"];
  var FR = ["Le", "La", "Les"];
  var FRNOUN = { Le: ["Roi", "Joker", "Diamant", "Coeur"], La: ["Reine", "Dame", "Fortune", "Chance"], Les: ["Rois", "As", "Jetons"] };
  var HELPERS = ["CASINO", "POKER CLUB", "TEXAS HOLD'EM", "PRIVATE TABLE", "HIGH STAKES", "BY INVITATION ONLY", "FIVE CARD DRAW",
    "LUCK FAVOURS THE BOLD", "ALL IN", "THE HOUSE ALWAYS SMILES", "FORTUNE FAVOURS THE BRAVE", "OPEN ALL NIGHT", "NO LIMIT"];

  R.inventName = function () {
    var out = "", tries = 0, n;
    do {
      switch (irnd(0, 5)) {
        case 0: n = pick(ADJ) + " " + pick(NOUN); break;
        case 1: n = pick(NAME) + " " + pick(SUFFIX); break;
        case 2: n = pick(ADJ) + " " + pick(PLACE); break;
        case 3: var a = pick(FR); n = a + " " + pick(FRNOUN[a]) + (chance(0.5) ? " " + pick(["Rouge", "Noir", "Royal", "Doré"]) : ""); break;
        case 4: n = pick(PLACE) + " " + pick(NOUN); break;
        default: n = pick(ADJ) + " " + pick(NOUN) + " " + pick(SUFFIX);
      }
      out = n; tries++;
    } while (out === run.last && tries < 20);
    run.last = out;
    return out;
  };
  R.inventHelpers = function () {
    var count = pick([0, 1, 1, 1, 2, 2, 2, 3]), list = [], pool = HELPERS.slice();
    while (list.length < count && pool.length) {
      var t = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (chance(0.15)) t = "EST. " + irnd(1920, 2026);
      list.push(t);
    }
    return list;
  };

  /* ---------- fonts ---------- */
  function fontSets() {
    var all = F.LIST, cut = all.indexOf("Josefin Sans"), script = all.slice(0, cut), sans = all.slice(cut);
    var imported = C().state().fonts.map(function (f) { return f.family; }).filter(function (n) { return F.status(n) === "ok"; });
    var favs = C().cfg().favouriteFonts.slice();
    var favScript = favs.filter(function (n) { return script.indexOf(n) >= 0; }), favSans = favs.filter(function (n) { return sans.indexOf(n) >= 0; });
    return {
      script: script.concat(favScript, favScript, imported, imported),
      sans: sans.concat(favSans, favSans),
      display: ["Cinzel", "Cinzel Decorative", "Limelight", "Abril Fatface", "Bodoni Moda", "Playfair Display", "Italiana", "Marcellus", "Poiret One"]
    };
  }
  function okFont(name, pool, fallback) {
    if (F.status(name) === "ok") return name;
    var good = pool.filter(function (n) { return F.status(n) === "ok"; });
    return good.length ? pick(good) : fallback;
  }
  function loadAll(names) { uniq(names).forEach(function (n) { if (n && !F.status(n)) F.load(n); }); }

  /* ---------- text measuring ---------- */
  var ctx = document.createElement("canvas").getContext("2d");
  function width100(text, font, weight, italic) {
    ctx.font = (italic ? "italic " : "") + weight + " 100px " + C().fontFamilyCss(font);
    return ctx.measureText(text).width;
  }
  function shownText(l) { return l.upper ? l.text.toUpperCase() : l.text; }

  /* ---------- play area ---------- */
  function mainTable() { return C().state().tables.filter(function (t) { return t.visible; })[0] || null; }
  function playArea() {
    var t = mainTable(), poly = null;
    if (t) {
      var inset = (t.bet ? t.bet.inset + t.bet.thick / 2 : 250) + 15;
      var local = G.offsetPolygon(G.flatten(t.nodes, 0.5), -inset, 0.5);
      if (local && local.length > 2) poly = G.transformPoints(local, t.x, t.y, t.rot);
    }
    if (!poly) poly = [[-1000, -420], [1000, -420], [1000, 420], [-1000, 420]];
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    poly.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    return { poly: poly, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }
  function rectInside(r, poly) {
    var xs = [r.x0, (r.x0 + r.x1) / 2, r.x1], ys = [r.y0, (r.y0 + r.y1) / 2, r.y1];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) if (!G.pointInPolygon([xs[i], ys[j]], poly)) return false;
    return true;
  }

  /* ---------- layout ---------- */
  /* items: {role, text, w (width of the text at the item's size), size, ...}. Returns positions (x centre, y baseline). */
  function layout(items, area) {
    var mains = items.filter(function (i) { return i.role === "main"; }), helps = items.filter(function (i) { return i.role !== "main"; });
    var style = mains.length > 1 ? pick(["row", "row", "stack", "scatter"]) : pick(["row", "row", "scatter"]);
    var stagger = chance(0.3), k;
    mains.forEach(function (m) { m.x = 0; m.y = 0; });
    if (style === "row") {
      var avg = mains.reduce(function (a, m) { return a + m.size; }, 0) / (mains.length || 1), gap = rnd(-0.03, 0.2) * avg;
      var total = mains.reduce(function (a, m) { return a + m.w; }, 0) + gap * (mains.length - 1), x = -total / 2;
      mains.forEach(function (m, i) { m.x = x + m.w / 2; m.y = (stagger ? (i % 2 ? 1 : -1) * 0.16 * m.size : rnd(-0.05, 0.05) * m.size); x += m.w + gap; });
    } else if (style === "stack") {
      var step = mains.reduce(function (a, m) { return a + m.size; }, 0) / (mains.length || 1) * rnd(0.55, 0.85);
      mains.forEach(function (m, i) { m.x = (stagger ? (i % 2 ? 1 : -1) * 0.1 * m.w : rnd(-0.08, 0.08) * m.w); m.y = (i - (mains.length - 1) / 2) * step; });
    } else {
      var order = mains.slice().sort(function () { return Math.random() - 0.5; });
      order.forEach(function (m, i) { m.x = (i - (mains.length - 1) / 2) * area.w * 0.28 + rnd(-0.05, 0.05) * area.w; m.y = rnd(-0.18, 0.18) * area.h; });
    }
    var bottom = -1e9, top = 1e9, left = 1e9, right = -1e9;
    mains.forEach(function (m) { bottom = Math.max(bottom, m.y + 0.28 * m.size); top = Math.min(top, m.y - 0.8 * m.size); left = Math.min(left, m.x - m.w / 2); right = Math.max(right, m.x + m.w / 2); });
    if (!mains.length) { bottom = 0; top = 0; left = -area.w * 0.2; right = area.w * 0.2; }
    var above = chance(0.25), below = bottom, over = top;
    helps.forEach(function (h) {
      var align = pick(["c", "c", "c", "l", "r"]);
      h.x = align === "c" ? (left + right) / 2 : align === "l" ? left + h.w / 2 : right - h.w / 2;
      if (style === "scatter") { h.x = rnd(-0.35, 0.35) * area.w; h.y = rnd(-0.3, 0.3) * area.h; return; }
      if (above) { over -= h.size * 0.5; h.y = over; over -= h.size * 1.1; }
      else { below += h.size * 1.2; h.y = below; below += h.size * 0.6; }
    });
    /* centre the group near the middle of the area */
    var gx0 = 1e9, gx1 = -1e9, gy0 = 1e9, gy1 = -1e9;
    items.forEach(function (i) { gx0 = Math.min(gx0, i.x - i.w / 2); gx1 = Math.max(gx1, i.x + i.w / 2); gy0 = Math.min(gy0, i.y - 0.8 * i.size); gy1 = Math.max(gy1, i.y + 0.28 * i.size); });
    var tx = area.cx + rnd(-0.05, 0.05) * area.w - (gx0 + gx1) / 2, ty = area.cy - 0.16 * area.h + rnd(-0.05, 0.04) * area.h - (gy0 + gy1) / 2;
    items.forEach(function (i) { i.x += tx; i.y += ty; });
    /* shrink about the area centre until every text rectangle is inside the player area */
    var px = 0, py = 0;
    items.forEach(function (i) { px += i.x / items.length; py += i.y / items.length; });
    for (k = 0; k < 40; k++) {
      var okAll = items.every(function (i) { return rectInside({ x0: i.x - i.w / 2, x1: i.x + i.w / 2, y0: i.y - 0.8 * i.size, y1: i.y + 0.28 * i.size }, area.poly); });
      if (okAll) break;
      items.forEach(function (i) {
        i.x = px + (i.x - px) * 0.95; i.y = py + (i.y - py) * 0.95;
        i.size *= 0.95; i.w *= 0.95; i.ls *= 0.95;
      });
    }
    return style;
  }

  /* ---------- planning (fonts chosen early so they can load while the bar fills) ---------- */
  function planFor(layers, specs) {
    /* specs: per layer {role}. Picks fonts and style numbers; no measuring yet. */
    var sets = fontSets(), plan = { items: [], serifMain: chance(0.2) }, names = [];
    layers.forEach(function (l, i) {
      var role = specs[i].role, font;
      if (role === "main") font = pick(plan.serifMain ? sets.display : sets.script);
      else font = pick(sets.sans);
      names.push(font);
      plan.items.push({ layer: l, role: role, font: font, pool: role === "main" ? (plan.serifMain ? sets.display : sets.script) : sets.sans,
        ls: role === "main" ? (plan.serifMain ? irnd(0, 10) : 0) : irnd(4, 20), weight: role === "main" ? 400 : pick([300, 400, 500, 600]),
        hsize: irnd(18, 42), upper: specs[i].upper !== undefined ? specs[i].upper : (role === "main" ? plan.serifMain : true) });
    });
    loadAll(names);
    plan.fonts = names;
    return plan;
  }
  function existingSpecs(layers) {
    var biggest = layers.reduce(function (a, l) { return Math.max(a, l.size); }, 0);
    return layers.map(function (l) { return { role: l.size >= biggest * 0.6 ? "main" : "helper", upper: l.upper }; });
  }
  /* Measures with the loaded fonts and writes the result into the layers. */
  function commit(plan) {
    var area, items = [];
    tableChanges();
    area = playArea();
    var mains = plan.items.filter(function (p) { return p.role === "main"; }), common = rnd(0.85, 1.1);
    plan.items.forEach(function (p) {
      p.font = okFont(p.font, p.pool, p.layer.font);
      p.w100 = width100(shownText(p.layer) || " ", p.font, p.weight, false);
      p.tw = p.w100 / 100;
    });
    /* sizes: mains fill a share of the area width, helpers use their own small size */
    var share = rnd(0.5, 0.82) * area.w, sumTw = mains.reduce(function (a, p) { return a + p.tw; }, 0) || 1;
    var rowSize = share / sumTw;
    plan.items.forEach(function (p) {
      var size = p.role === "main" ? Math.min(rowSize * common, area.h * 0.5) : p.hsize;
      size = Math.max(p.role === "main" ? 70 : 14, Math.min(p.role === "main" ? 420 : 60, size));
      items.push({ p: p, role: p.role, size: size, ls: p.ls, text: shownText(p.layer), w: p.tw * size + p.ls * Math.max(0, shownText(p.layer).length - 1) });
    });
    layout(items, area);
    items.forEach(function (i) {
      var l = i.p.layer;
      l.font = i.p.font; l.size = Math.round(i.size); l.ls = Math.round(i.ls * 10) / 10; l.weight = i.p.weight;
      l.x = Math.round(i.x); l.y = Math.round(i.y);
      if (i.p.upper !== undefined) l.upper = i.p.upper;
    });
    C().renderPanels(); C().renderStage(); C().save("random");
  }
  function shapeOnly() { tableChanges(); C().renderPanels(); C().renderStage(); C().save("random"); }

  /* ---------- table shapes ---------- */
  function shapeTables() {
    C().state().tables.forEach(function (t) {
      if (t.locked || !t.preset) return;
      var type = pick(["stadium", "stadium", "rect", "octagon", "circle"]), p = T.defaultPreset(type);
      if (type === "circle") { p.w = p.h = irnd(1200, 1600, 50); }
      else {
        p.h = irnd(1000, 1300, 50);
        p.w = type === "stadium" ? irnd(Math.max(2000, p.h * 1.6), 2800, 50) : irnd(1800, 2800, 50);
        p.r = irnd(0, 300, 25); p.chamfer = irnd(150, Math.min(400, Math.floor(p.h / 2) - 50), 25);
      }
      if (type !== "circle" && chance(0.25)) {
        p.notch.on = true; p.notch.style = pick(["scoop", "box"]); p.notch.w = irnd(600, 800, 50); p.notch.d = irnd(120, 200, 10); p.notch.r = irnd(40, 80, 10);
      }
      t.preset = p; T.regen(t);
    });
  }

  /* The player-area line is shown on some rounds and hidden on others. */
  function betToggle() {
    C().state().tables.forEach(function (t) { if (!t.locked && t.visible) t.bet.on = chance(0.65); });
  }
  function tableChanges() {
    if (R.opts.shape) shapeTables();
    if (R.opts.bet) betToggle();
  }

  /* ---------- timer ---------- */
  function textLayers() { return C().state().layers.filter(function (l) { return !l.frozen; }); }
  function waitFonts(names, ms, done) {
    var t0 = Date.now();
    (function poll() {
      var pending = names.some(function (n) { return F.status(n) === "loading"; });
      if (!pending || Date.now() - t0 > ms) done(); else setTimeout(poll, 100);
    })();
  }
  function newPlan() {
    var ls = textLayers();
    return ls.length ? planFor(ls, existingSpecs(ls)) : null;
  }
  function refreshPane() {
    var pane = document.getElementById("randomPane");
    if (!pane) return;
    var a = document.activeElement, keep = a && pane.contains(a) && a.dataset ? a : null;
    if (keep && keep.tagName === "INPUT" && keep.type !== "checkbox") return;   /* do not disturb typing */
    pane.innerHTML = R.panelHTML(); C().syncInputs();
  }
  function paintBar() {
    var bar = document.getElementById("randBar"), txt = document.getElementById("randTime");
    if (!bar) return;
    var span = R.opts.interval * 1000, el = run.on ? Math.min(span, Date.now() - run.t0) : 0;
    bar.style.width = (span ? el / span * 100 : 0) + "%";
    if (txt) txt.textContent = run.on ? (el / 1000).toFixed(1) + " s elapsed · " + ((span - el) / 1000).toFixed(1) + " s left" : "Stopped";
  }
  function tick() {
    if (!run.on) return;
    paintBar();
    if (run.busy || Date.now() - run.t0 < R.opts.interval * 1000) return;
    cycle();
  }
  function cycle() {
    run.busy = true;
    var plan = run.plan;
    if (!plan || !plan.items.every(function (p) { return C().state().layers.indexOf(p.layer) >= 0; })) plan = newPlan();
    if (plan) commit(plan); else if (R.opts.shape || R.opts.bet) shapeOnly();
    run.plan = newPlan();       /* fonts for the next round start loading now */
    run.t0 = Date.now(); run.busy = false;
  }
  R.start = function () {
    if (run.on) return;
    if (!textLayers().length && !R.opts.shape && !R.opts.bet) { C().say("There is no text to shuffle. Add a text, tick one of the table boxes, or press Create casino."); return; }
    C().groupBegin();
    run.on = true; run.plan = newPlan(); run.t0 = Date.now() - R.opts.interval * 1000;   /* first change happens at once */
    run.busy = true;
    waitFonts(run.plan ? run.plan.fonts : [], 2500, function () {
      if (!run.on) return;
      run.busy = false; cycle(); refreshPane();
    });
    run.timer = setInterval(tick, 100);
    refreshPane();
  };
  R.stop = function () {
    if (!run.on) return;
    run.on = false; clearInterval(run.timer); run.timer = null; run.plan = null;
    C().groupEnd();
    refreshPane();
  };
  R.once = function () {
    R.stop();
    var ls = textLayers();
    if (!ls.length && !R.opts.shape) { C().say("There is no text to shuffle. Add a text, tick one of the table boxes, or press Create casino."); return; }
    var plan = ls.length ? planFor(ls, existingSpecs(ls)) : null;
    C().groupBegin();
    waitFonts(plan ? plan.fonts : [], 2500, function () {
      if (plan) commit(plan); else shapeOnly();
      C().groupEnd();
    });
  };

  /* ---------- Create casino ---------- */
  R.create = function () {
    R.stop();
    var core = C(), st = core.state(), name = R.inventName(), helpers = R.inventHelpers(), specs = [], layers = [];
    name.split(" ").forEach(function (w) { layers.push(core.mkLayer(w, "Mea Culpa", 170, 0, 400, 0, 0, true, false)); specs.push({ role: "main" }); });
    helpers.forEach(function (h) { layers.push(core.mkLayer(h, "Josefin Sans", 28, 8, 400, 0, 0, false, true)); specs.push({ role: "helper", upper: true }); });
    core.groupBegin();
    st.layers = layers.map(function (l, i) { l.outline = specs[i].role === "helper"; return core.normLayer(l, i); });
    st.band.at = st.layers.length;   /* the lines and cards stay above all texts */
    st.selected = st.layers[0].id; st.name = name;
    var plan = planFor(st.layers, specs);
    core.renderPanels(); core.renderStage();
    waitFonts(plan.fonts, 2500, function () {
      commit(plan);
      core.groupEnd();
      core.say("Created “" + name + "”" + (helpers.length ? " with " + helpers.length + " helper text" + (helpers.length > 1 ? "s" : "") : " with no helper texts") + ".");
    });
  };

  /* ---------- panel ---------- */
  R.panelHTML = function () {
    var h = C().h;
    return '<h3 class="sec">Randomize</h3><p class="small">Shuffles the fonts, sizes and positions of your texts. The words stay as you wrote them, and the texts stay inside the player area. Stop it and the whole run can be undone in one step. The toolbar switches for the player-area line, the dealer line and the centre mark work while it runs; untick "show or hide the player-area line" below if the random run should leave that line as you set it.</p>' +
      '<div class="row2">' + h.numField("Change every (seconds)", "rand", "interval", "0.5") + '<div class="fld"><span>&nbsp;</span>' + h.chk("Also change table shape", "rand", "shape") + h.chk("Also show or hide the player-area line", "rand", "bet") + '</div></div>' +
      '<div class="progress" role="progressbar" aria-label="Time until the next change"><div class="bar" id="randBar"></div></div><div class="small" id="randTime">' + (run.on ? "" : "Stopped") + '</div>' +
      '<div class="btnrow">' + (run.on ? '<button class="btn gold" type="button" data-act="randstop">Stop</button>' : '<button class="btn gold" type="button" data-act="randstart">Start</button>') +
      '<button class="btn" type="button" data-act="randonce">Shuffle once</button></div>' +
      '<h3 class="sec">Start from nothing</h3><p class="small">Invents a casino name, decides whether there are helper texts and how many, and picks fonts, sizes and positions. This replaces all current texts (one undo brings them back). The table, lines and cards are not touched.</p>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="randcreate">Create casino</button></div>';
  };
  R.act = function (act) {
    if (act === "randstart") { R.start(); return true; }
    if (act === "randstop") { R.stop(); return true; }
    if (act === "randonce") { R.once(); return true; }
    if (act === "randcreate") { R.create(); return true; }
    return false;
  };
  PTD.scopes = PTD.scopes || {}; PTD.onChange = PTD.onChange || {};
  PTD.scopes.rand = function () { return R.opts; };
  PTD.onChange.rand = function (obj, key) { if (key === "interval") obj.interval = Math.max(0.5, Math.min(600, obj.interval || 5)); };
  var stage = document.getElementById("stage");
  if (stage) stage.addEventListener("pointerdown", function () { R.stop(); }, true);
  R.isRunning = function () { return run.on; };

  PTD.random = R;
})(window.PTD = window.PTD || {});
