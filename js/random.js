/* Randomizer: shuffles fonts, sizes and layout of the artwork texts (and, if asked, the table shapes)
 * on a timer, and can invent a whole casino name with helper texts from nothing.
 * Every round is its own undo step, so a stopped run can be stepped back and forward with Undo and Redo.
 * Create casino is one step. Text always stays inside the player area. Nothing is selected after a round. */
(function (PTD) {
  "use strict";
  var R = {};
  var C = function () { return PTD.core; };
  var G = PTD.geom, F = PTD.fonts, T = PTD.tables;

  /* Defaults chosen by the maintainer: tables change shape, the lines, notch (off), hand, pot, burn cards, muck, players and
     the dealer as a player are set, and the number of players and cards per player vary. */
  /* Size limits of the random table shapes (mm; the factor is width divided by height): circles and octagons use
     sizeMin..sizeMax for both sides, rectangles and stadiums use heightMin..heightMax and a width of height times a factor. */
  R.opts = { interval: 5, shape: true, words: false,
    sizeMin: 600, sizeMax: 1200, heightMin: 600, heightMax: 1200, factorMin: 4 / 3, factorMax: 2,
    betVary: false, betSet: true, betVal: true,
    notchVary: false, notchSet: true, notchVal: false,
    handVary: false, handSet: true, handVal: true,
    potVary: false, potSet: true, potVal: true,
    burnVary: false, burnSet: true, burnVal: true,
    muckVary: false, muckSet: true, muckVal: true,
    showVary: false, showSet: true, showVal: true,
    playersVary: true, playersSet: false, playersVal: 6,
    cardsVary: false, cardsSet: true, cardsVal: 2,
    dealerVary: false, dealerSet: true, dealerVal: true };
  function tableOpts() { var o = R.opts; return o.words || o.shape || ROWS.some(function (r) { return o[r.key + "Vary"] || o[r.key + "Set"]; }); }
  var run = { on: false, t0: 0, timer: null, plan: null, busy: false, last: "" };

  /* ---------- random helpers ---------- */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function irnd(a, b, step) { step = step || 1; return a + step * Math.floor(Math.random() * ((b - a) / step + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function chance(p) { return Math.random() < p; }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

  /* ---------- name inventor ---------- */
  var ADJ = ["Golden", "Silver", "Royal", "Velvet", "Crimson", "Midnight", "Lucky", "Imperial", "Noble", "Emerald", "Ivory", "Scarlet",
    "Sapphire", "High", "Black", "Grand", "Regal", "Gilded", "Sovereign", "Wild", "Silent", "Blue", "Red", "Crystal", "Eternal", "Amber", "Onyx"];
  var NOUN = ["Aces", "Crown", "Kings", "Queens", "Spade", "Heart", "Diamond", "Club", "Dragon", "Phoenix", "Falcon", "Raven", "Lion",
    "Tiger", "Horse", "Unicorn", "Orchid", "Rose", "Palace", "Fortune", "Chance", "Jackpot", "Joker", "River", "Bluff", "Dealer", "Chip", "Dice", "Flush",
    "Straight", "Pocket", "Wager", "Gambit", "Ante"];
  var PLACE = ["Monaco", "Riviera", "Venice", "Istanbul", "Havana", "Marrakesh", "Capri", "Lisbon", "Vienna", "Baroque", "Orient",
    "Sahara", "Atlantic", "Nordic", "Baltic", "Paris", "Praha", "Biarritz", "Cannes"];
  var NAME = ["Molino", "Beaumont", "Montague", "Valentino", "Casanova", "Fontaine", "Lafayette", "Sinclair", "Monroe", "Delacroix",
    "Romanov", "Medici", "Borgia", "Sterling", "Winchester", "Hartley", "Rothschild", "Kingsley"];
  var SUFFIX = ["Royale", "Palace", "Club", "Lounge", "Society", "Salon", "Grand", "Noir", "Rouge", "Parlour", "House"];
  var FR = ["Le", "La", "Les"];

  /* Card words. Ranks: "Two" and "Deuce" are the same card and each turns up about half of the time. */
  var RANKS = ["Ace", "King", "Queen", "Jack", "Ten", "Nine", "Eight", "Seven", "Six", "Five", "Four", "Three", "Two|Deuce"];
  var SUITS = ["Spade", "Heart", "Diamond", "Club"];
  var SUITS_PL = ["Spades", "Hearts", "Diamonds", "Clubs"];
  /* Famous starting hands, used alone or with a suffix. Add more here, one word or phrase each. */
  var HANDS = ["Big Slick", "Pocket Rockets", "Rockets", "Cowboys", "Ladies", "Snowman", "Seven Deuce", "Ducks", "Hooks", "Bullets", "Big Chick", "Dolly Parton"];
  /* Possessive names ("Devil's Gambit"). Each owner group only takes heads that sound right with it; this is
   * what keeps out silly pairs. Add an owner to the group whose theme fits it. */
  var OWNERS = {
    dark: ["Devil", "Demon", "Satan", "Lucifer", "Imp", "Sinner", "Hell"],
    holy: ["Angel", "Saint", "Heaven"],
    card: ["King", "Queen", "Jack", "Ace", "Joker"].concat(SUITS),
    table: ["Gambler", "Dealer"],
    beast: ["Dragon", "Lion", "Fortune"]
  };
  var HEADS = {
    dark: ["Gambit", "Ante", "Dice", "Deal", "Bargain", "Wager", "Den", "Hand", "Table", "Paradise", "Luck", "Playground", "Chance"],
    holy: ["Gate", "Gambit", "Hand", "Table", "Garden", "Luck", "Chance", "Palace", "Grace", "Meadow"],
    card: ["Gambit", "Court", "Table", "Palace", "Hand", "Wager", "Chance", "Luck", "Parlour", "Salon", "Lounge"],
    table: ["Gambit", "Ante", "Dice", "Wager", "Table", "Hand", "Choice", "Luck", "Chance", "Den", "Palace", "Lounge", "Meadow", "Paradise", "Heaven"],
    beast: ["Den", "Palace", "Lounge", "Luck", "Chance", "Hand", "Table", "Wager"]
  };
  /* Themed words only go with adjectives that suit them ("Black Devil", "Golden Heaven"), never with places. */
  var THEMED = [
    { adj: ["Black", "Crimson", "Scarlet", "Midnight", "Red", "Silent", "Wild", "Onyx", "Eternal", "Blue"], nouns: ["Devil", "Demon", "Inferno", "Brimstone", "Sinner"] },
    { adj: ["Golden", "Silver", "Ivory", "Royal", "Gilded", "Crystal", "Eternal", "Sapphire", "Emerald", "Amber"], nouns: ["Angel", "Saint", "Heaven", "Paradise"] },
    { adj: ADJ, nouns: ["Gambler", "Meadow"] }
  ];
  function themedName() { var g = pick(THEMED); return pick(g.adj) + " " + pick(g.nouns) + (chance(0.3) ? " " + pick(SUFFIX) : ""); }
  /* "X of Y": a title or rank on the left, a plural or a place on the right. */
  var OF_PLACES = ["Heaven", "Paradise", "Hell", "Monaco", "Venice", "Vienna", "Havana"];
  var OF_TITLES = [
    { left: ["King", "Queen", "Jack", "Ace"], right: SUITS_PL.concat(["Devils", "Angels"], OF_PLACES) },
    { left: ["Gambler", "Dealer"], right: ["Heaven", "Paradise", "Hell", "Fortune", "Monaco", "Venice", "Havana"] },
    { left: ["Devil", "Angel", "Saint", "Sinner"], right: OF_PLACES }
  ];
  /* Pairs that came out silly in review ("left|right", lower case); add to this list when a name looks bad. */
  var BLOCK = ["hell|paradise", "satan|paradise", "lucifer|paradise", "imp|paradise", "imp|bargain", "heaven|gate", "saint|ante", "saint|dice", "angel|dice", "angel|ante"];
  function rank() { return pick(pick(RANKS).split("|")); }
  function blocked(a, b) { return BLOCK.indexOf((a + "|" + b).toLowerCase()) >= 0; }
  function ownerName() {
    var g = pick(Object.keys(OWNERS)), o, h, i = 0;
    do { o = pick(OWNERS[g]); h = pick(HEADS[g]); i++; } while (blocked(o, h) && i < 30);
    return o + "'s " + h;
  }
  function ofName() {
    if (chance(0.45)) return rank() + " of " + pick(SUITS_PL);
    var g = pick(OF_TITLES);
    return pick(g.left) + " of " + pick(g.right);
  }
  function handName() { return pick(HANDS) + (chance(0.4) ? "" : " " + pick(SUFFIX)); }
  var FRNOUN = { Le: ["Roi", "Joker", "Diamant", "Coeur"], La: ["Reine", "Dame", "Fortune", "Chance"], Les: ["Rois", "As", "Jetons"] };
  var HELPERS = ["CASINO", "POKER CLUB", "TEXAS HOLD'EM", "PRIVATE TABLE", "HIGH STAKES", "BY INVITATION ONLY", "FIVE CARD DRAW",
    "LUCK FAVOURS THE BOLD", "ALL IN", "THE HOUSE ALWAYS SMILES", "FORTUNE FAVOURS THE BRAVE", "OPEN ALL NIGHT", "NO LIMIT"];

  /* Words that should not appear twice in one casino (short and filler words are ignored; 4-letter stems count as equal). */
  var FILLER = ["the", "and", "all", "for"];
  function stems(text) {
    return String(text).toLowerCase().replace(/[^a-zà-ÿ ]/g, " ").split(/\s+/).filter(function (w) { return w.length >= 3 && FILLER.indexOf(w) < 0; })
      .map(function (w) { return w.slice(0, 4); });
  }
  function repeats(texts) {
    var seen = {};
    return texts.some(function (t) {
      var own = {}, clash = false;
      stems(t).forEach(function (w) { if (seen[w] || own[w]) clash = true; own[w] = true; });
      Object.keys(own).forEach(function (w) { seen[w] = true; });
      return clash;
    });
  }
  R.repeats = repeats;
  R.inventName = function () {
    var out = "", tries = 0, n;
    do {
      switch (irnd(0, 9)) {
        case 0: n = pick(ADJ) + " " + pick(NOUN); break;
        case 1: n = pick(NAME) + " " + pick(SUFFIX); break;
        case 2: n = pick(ADJ) + " " + pick(PLACE); break;
        case 3: var a = pick(FR); n = a + " " + pick(FRNOUN[a]) + (chance(0.5) ? " " + pick(["Rouge", "Noir", "Royal", "Doré"]) : ""); break;
        case 4: n = pick(PLACE) + " " + pick(NOUN); break;
        case 5: n = pick(ADJ) + " " + pick(NOUN) + " " + pick(SUFFIX); break;
        case 6: n = ownerName(); break;
        case 7: n = ofName(); break;
        case 8: n = themedName(); break;
        default: n = handName();
      }
      out = n; tries++;
    } while ((out === run.last || repeats([out])) && tries < 40);
    run.last = out;
    return out;
  };
  /* Helper texts for a casino called name. No word repeats between the name and the helpers or between helpers,
   * and "EST. year" appears at most once. */
  R.inventHelpers = function (name) {
    var count = pick([0, 1, 1, 1, 2, 2, 2, 3]), list = [], pool = HELPERS.slice(), est = false;
    while (list.length < count && pool.length) {
      var t = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (!est && chance(0.15)) { t = "EST. " + irnd(1920, 2026); est = true; }
      if (repeats([name || ""].concat(list, [t]))) continue;
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
    var AO = PTD.core.artOrigin();   /* the layout works in cloth coordinates; texts are stored measured from the artwork origin */
    items.forEach(function (i) {
      var l = i.p.layer;
      l.font = i.p.font; l.size = Math.round(i.size); l.ls = Math.round(i.ls * 10) / 10; l.weight = i.p.weight;
      l.x = Math.round(i.x - AO.x); l.y = Math.round(i.y - AO.y);
      if (i.p.upper !== undefined) l.upper = i.p.upper;
    });
    finishRound();
  }
  function shapeOnly() { tableChanges(); finishRound(); }
  /* One round done: nothing stays selected, and the round becomes its own undo step (no tag, so rounds never merge). */
  function finishRound() { C().deselectAll(); C().renderPanels(); C().renderStage(); C().save(); }

  /* ---------- table shapes ---------- */
  /* The size limits as safe numbers: clamped to a sensible range and with min never above max (the fields are left as typed). */
  function limits() {
    var o = R.opts, r = {};
    [["size", 100, 20000, 600, 1200], ["height", 100, 20000, 600, 1200], ["factor", 0.25, 10, 4 / 3, 2]].forEach(function (g) {
      var a = Math.max(g[1], Math.min(g[2], Number(o[g[0] + "Min"]) || g[3])), b = Math.max(g[1], Math.min(g[2], Number(o[g[0] + "Max"]) || g[4]));
      r[g[0] + "Min"] = Math.min(a, b); r[g[0] + "Max"] = Math.max(a, b);
    });
    return r;
  }
  function shapeTables() {
    var st = C().state(), o = limits();
    /* With no table at all, "change table shape" makes one; it is part of the same undo step as the round. */
    if (!st.tables.length) st.tables.push(T.make(C().nextId("t", st.tables), "Table 1", "stadium", 0));
    st.tables.forEach(function (t) {
      if (t.locked || !t.preset) return;
      var type = pick(["stadium", "stadium", "rect", "octagon", "circle"]), p = T.defaultPreset(type);
      if (type === "circle" || type === "octagon") {   /* both sides equal, from the size limits */
        p.w = p.h = irnd(o.sizeMin, o.sizeMax, 50);
        if (type === "octagon") p.chamfer = irnd(150, Math.max(150, Math.min(400, Math.floor(p.h / 2) - 50)), 25);
      } else {
        p.h = irnd(o.heightMin, o.heightMax, 50);
        p.w = Math.max(p.h, Math.round(p.h * rnd(o.factorMin, o.factorMax) / 50) * 50);
        p.r = irnd(0, Math.min(300, Math.floor(p.h / 2)), 25);
      }
      if (type !== "circle" && chance(0.25)) {
        /* the notch must fit on the straight part of the bottom side, so a short side gets a narrower notch or none */
        var straight = type === "stadium" ? p.w - p.h : type === "octagon" ? p.w - 2 * p.chamfer : p.w - 2 * p.r;
        var nw = Math.min(irnd(600, 800, 50), Math.floor(straight * 0.7 / 10) * 10);
        if (nw >= 150) {
          p.notch.on = true; p.notch.style = pick(["scoop", "box"]); p.notch.w = nw; p.notch.d = irnd(120, 200, 10); p.notch.r = irnd(40, 80, 10);
        }
      }
      t.preset = p; T.regen(t);
    });
  }
  R.shapeTables = shapeTables; R.limits = limits;

  /* The player-area line is shown on some rounds and hidden on others. */
  function betToggle() {
    C().state().tables.forEach(function (t) {
      if (t.locked || !t.visible) return;
      if (R.opts.betSet) t.bet.on = !!R.opts.betVal; else if (R.opts.betVary) t.bet.on = chance(0.65);
    });
  }
  /* Players: "show" decides whether the whole group (cards, chips, dealer button) is there; the number of players,
     the cards each and "dealer is a player" are only decided on tables that show their players this round. */
  function playerChanges() {
    var o = R.opts;
    C().state().tables.forEach(function (t) {
      if (t.locked || !t.visible || !t.players) return;
      var p = t.players, varies = false;
      if (o.showSet) p.show = !!o.showVal; else if (o.showVary) { p.show = chance(0.65); varies = true; }
      if (!p.show) return;
      if (o.playersSet) p.count = Math.max(1, Math.min(12, Math.round(Number(o.playersVal) || 1))); else if (o.playersVary) { p.count = irnd(1, 12); varies = true; }
      if (o.cardsSet) p.cards = Math.max(2, Math.min(4, Math.round(Number(o.cardsVal) || 2))); else if (o.cardsVary) { p.cards = pick([2, 3, 4]); varies = true; }
      if (o.dealerSet) p.dealerPlayer = !!o.dealerVal; else if (o.dealerVary) { p.dealerPlayer = chance(0.5); varies = true; }
      if (varies) p.seed = irnd(1, 999999);   /* a new arrangement whenever anything about the players varies */
    });
  }
  /* The hand, the pot, the burn cards and the muck are shown or hidden for the whole cloth. */
  function decoChanges() {
    var c = C().state().cards, o = R.opts;
    [["hand", "show"], ["pot", "potShow"], ["burn", "burnShow"], ["muck", "muckShow"]].forEach(function (r) {
      if (o[r[0] + "Set"]) c[r[1]] = !!o[r[0] + "Val"]; else if (o[r[0] + "Vary"]) c[r[1]] = chance(0.65);
    });
  }
  /* The dealer notch: set on or off, or switched at random. Circles and free outlines have none. */
  function notchChanges() {
    if (!R.opts.notchSet && !R.opts.notchVary) return;
    C().state().tables.forEach(function (t) {
      if (t.locked || !t.visible || !t.preset || t.preset.type === "circle") return;
      var on = R.opts.notchSet ? !!R.opts.notchVal : chance(0.5);
      t.preset.notch.on = on;
      if (on && R.opts.notchVary && !R.opts.notchSet) { t.preset.notch.style = pick(["scoop", "box"]); }
      T.regen(t);
    });
  }
  function tableChanges() {
    if (R.opts.shape) shapeTables();
    notchChanges();
    decoChanges();
    betToggle();
    playerChanges();
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
    pane.innerHTML = R.panelHTML(); C().syncInputs(); paintBar();
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
    if (R.opts.words) {   /* new words every round: the fonts of the new texts are loaded before the round is committed */
      var made = inventCasino();
      waitFonts(made.plan.fonts, 2500, function () {
        if (!run.on) { run.busy = false; return; }
        commit(made.plan); run.plan = null; run.t0 = Date.now(); run.busy = false;
      });
      return;
    }
    var plan = run.plan;
    if (!plan || !plan.items.every(function (p) { return C().state().layers.indexOf(p.layer) >= 0; })) plan = newPlan();
    if (plan) commit(plan); else if (tableOpts()) shapeOnly();
    run.plan = newPlan();       /* fonts for the next round start loading now */
    run.t0 = Date.now(); run.busy = false;
  }
  R.start = function () {
    if (run.on) return;
    if (!textLayers().length && !tableOpts()) { C().say("There is no text to shuffle. Add a text, tick one of the table boxes, or press Create casino."); return; }
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
    refreshPane();
  };
  R.once = function () {
    R.stop();
    var ls = textLayers();
    if (!ls.length && !tableOpts()) { C().say("There is no text to shuffle. Add a text, tick one of the table boxes, or press Create casino."); return; }
    var made = R.opts.words ? inventCasino() : null;
    var plan = made ? made.plan : ls.length ? planFor(ls, existingSpecs(ls)) : null;
    waitFonts(plan ? plan.fonts : [], 2500, function () {
      if (plan) commit(plan); else shapeOnly();
    });
  };

  /* ---------- Create casino ---------- */
  /* Replaces all texts with an invented casino name and helpers and returns the plan for laying them out. */
  function inventCasino() {
    var core = C(), st = core.state(), name = R.inventName(), helpers = R.inventHelpers(name), specs = [], layers = [];
    name.split(" ").forEach(function (w) { layers.push(core.mkLayer(w, "Mea Culpa", 170, 0, 400, 0, 0, true, false)); specs.push({ role: "main" }); });
    helpers.forEach(function (h) { layers.push(core.mkLayer(h, "Josefin Sans", 28, 8, 400, 0, 0, false, true)); specs.push({ role: "helper", upper: true }); });
    st.layers = layers.map(function (l, i) { l.outline = specs[i].role === "helper"; return core.normLayer(l, i); });
    st.band.at = st.layers.length;   /* the lines and cards stay above all texts */
    st.name = name;
    return { plan: planFor(st.layers, specs), name: name, helpers: helpers };
  }
  R.create = function () {
    R.stop();
    var core = C(), made, name, helpers, plan;
    core.groupBegin();
    made = inventCasino(); name = made.name; helpers = made.helpers; plan = made.plan;
    core.renderPanels(); core.renderStage();
    waitFonts(plan.fonts, 2500, function () {
      commit(plan);   /* clears the selection */
      core.groupEnd();
      core.say("Created “" + name + "”" + (helpers.length ? " with " + helpers.length + " helper text" + (helpers.length > 1 ? "s" : "") : " with no helper texts") + ".");
    });
  };

  /* ---------- panel ---------- */
  /* The rows of the panel. Rows with a parent are only meaningful while the parent shows something. */
  var ROWS = [
    { key: "bet", label: "Player-area line", kind: "check", tip: "show (ticked) or hide (unticked) the player-area line" },
    { key: "notch", label: "Dealer notch", kind: "check", tip: "cut the dealer notch (ticked) or leave it out (unticked) on every table with a preset shape" },
    { key: "hand", label: "Poker hand", kind: "check", tip: "show (ticked) or hide (unticked) the poker hand" },
    { key: "pot", label: "Pot", kind: "check", tip: "show (ticked) or hide (unticked) the pot" },
    { key: "burn", label: "Burn cards", kind: "check", tip: "show (ticked) or hide (unticked) the burn cards" },
    { key: "muck", label: "Muck", kind: "check", tip: "show (ticked) or hide (unticked) the muck" },
    { key: "show", label: "Show players", kind: "check", tip: "show (ticked) or hide (unticked) the players of every table: their cards, chips and the dealer button" },
    { key: "players", label: "Number of players", kind: "number", min: 1, max: 12, parent: "show", tip: "the number of players, 1 to 12" },
    { key: "cards", label: "Cards per player", kind: "number", min: 2, max: 4, parent: "show", tip: "the number of cards each player holds, 2 to 4" },
    { key: "dealer", label: "Dealer is a player", kind: "check", parent: "show", tip: "the dealer sits in a seat (ticked) or only deals (unticked)" }
  ];
  /* One row per property: Vary, Set and the value to set. Set wins over Vary. */
  function varyRow(h, row) {
    var key = row.key, label = row.label, set = R.opts[key + "Set"], par = row.parent;
    var off = par && R.opts[par + "Set"] && !R.opts[par + "Val"];   /* the parent is set to hidden: nothing below it can matter */
    var tips = {
      vary: "Vary: change this at random in every round. Ignored while Set is ticked." + (par ? " Only decided on tables that show their players." : ""),
      set: "Set: replace the current value in every round with the value on the right." + (par ? " Ticking it also switches on its parent row." : ""),
      val: "Value used when Set is on: " + row.tip + "."
    };
    var dis = off ? " disabled" : "";
    var val = row.kind === "check" ? '<input type="checkbox" data-scope="rand" data-key="' + key + 'Val" title="' + tips.val + '" aria-label="' + label + ' value"' + (set && !off ? "" : " disabled") + '>'
      : '<input type="number" min="' + row.min + '" max="' + row.max + '" step="1" data-scope="rand" data-key="' + key + 'Val" title="' + tips.val + '" aria-label="' + label + ' value"' + (set && !off ? "" : " disabled") + '>';
    return '<div class="varyrow' + (par ? " child" : "") + '"><span class="vname">' + label + '</span>' +
      '<label class="chk" title="' + tips.vary + '"><input type="checkbox" data-scope="rand" data-key="' + key + 'Vary"' + (set || off ? " disabled" : "") + '><span>Vary</span></label>' +
      '<label class="chk" title="' + tips.set + '"><input type="checkbox" data-scope="rand" data-key="' + key + 'Set"' + dis + '><span>Set</span></label>' + val + '</div>';
  }
  R.panelHTML = function () {
    var h = C().h;
    return '<h3 class="sec">Randomize</h3><p class="small">Shuffles the fonts, sizes and positions of your texts. The words stay as you wrote them unless you tick the words box, which invents a new casino name and helper texts in every round (it replaces all texts, one undo step per round). The texts stay inside the player area. Every round is its own step in the undo history: stop the run, press Undo to go back round by round, Redo to go forward, or start again from there. Nothing is selected after a round. The toolbar switches for the player-area line, the dealer line and the centre mark work while it runs; use the Vary, Set and value boxes below to decide what happens to the lines, the dealer notch, the hand, the pot, the burn cards, the muck and the players. The rows under Show players only matter while the players are shown.</p>' +
      '<div class="row2">' + h.numField("Change every (seconds)", "rand", "interval", "0.5") + '<div class="fld"><span>&nbsp;</span>' + h.chk("Also change the words (a new casino name and helper texts each round)", "rand", "words") + h.chk("Also change table shape", "rand", "shape") + 
        '</div></div>' + ROWS.map(function (r) { return varyRow(h, r); }).join("") +
      '<h3 class="sec">Table size limits (when the table shape changes)</h3>' +
      '<div class="row2">' + h.numField("Circle and octagon size, min (mm)", "rand", "sizeMin", "10") + h.numField("max (mm)", "rand", "sizeMax", "10") + '</div>' +
      '<div class="row2">' + h.numField("Rectangle and stadium height, min (mm)", "rand", "heightMin", "10") + h.numField("max (mm)", "rand", "heightMax", "10") + '</div>' +
      '<div class="row2">' + h.numField("Width = height x factor, min", "rand", "factorMin", "0.05") + h.numField("max", "rand", "factorMax", "0.05") + '</div>' +
      '<p class="small">A circle or an octagon has the same width and height. The factor is picked evenly between min and max (4/3 is 1.333). A min above the max is swapped when a round runs. A dealer notch is made narrower, or left out, when the straight part of the side is short.</p>' +
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
  PTD.onChange.rand = function (obj, key) {
    if (key === "interval") obj.interval = Math.max(0.5, Math.min(600, obj.interval || 5));
    if (key === "playersVal") obj.playersVal = Math.max(1, Math.min(12, Math.round(Number(obj.playersVal) || 1)));
    if (key === "cardsVal") obj.cardsVal = Math.max(2, Math.min(4, Math.round(Number(obj.cardsVal) || 2)));
    if (key === "showVal") C().renderPanels();   /* the rows below Show players depend on it */
    var m = /^(.*)(Vary|Set)$/.exec(key);
    if (!m) return;
    var row = ROWS.filter(function (r) { return r.key === m[1]; })[0];
    /* ticking a row under Show players makes sure the players can be shown */
    if (row && row.parent && obj[key] && !obj[row.parent + "Set"] && !obj[row.parent + "Vary"]) {
      obj[row.parent + "Set"] = true; obj[row.parent + "Val"] = true;
      C().say("Show players was switched on (Set) because the players are needed for this row.");
    }
    C().renderPanels();
  };
  var stage = document.getElementById("stage");
  if (stage) stage.addEventListener("pointerdown", function () { R.stop(); }, true);
  R.paint = function () { paintBar(); };
  R.isRunning = function () { return run.on; };

  PTD.random = R;
})(window.PTD = window.PTD || {});
