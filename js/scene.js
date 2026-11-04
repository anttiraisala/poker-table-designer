/* Scene: the physical things lying on the table (not part of the printed cloth and never cut):
 * pot chips, burn cards, muck, and for each table the players with their cards and chip stacks, the folded cards,
 * the bets and the dealer button. One generator makes a flat list of objects; the stage and the picture draw it
 * from above, and the Blender export builds real 3D objects from the very same list.
 * All numbers are millimetres on the cloth plane (Y grows downward); z is the height of the bottom of an object above the cloth. */
(function (PTD) {
  "use strict";
  var S = {};
  var G = PTD.geom;
  var C = function () { return PTD.core; };

  S.GAP = 0.1;            /* air between touching objects, so a renderer never sees overlapping surfaces */
  S.CARD_THICK = 0.3;
  S.BUTTON = { r: 35, th: 4 };
  S.CHIP_COLOURS = ["red", "black", "ivory", "gold"];

  /* ---------- helpers ---------- */
  function seeded(seed) {
    var a = (Math.floor(seed) || 1) >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  S.seeded = seeded;
  function ir(rnd, a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function rr(rnd, a, b) { return a + rnd() * (b - a); }
  function pickOne(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }

  /* ---------- settings ---------- */
  S.defaultPlayers = function () { return { show: false, count: 6, dealerPlayer: false, cards: 2, seed: 1, dealerSide: "bottom" }; };
  S.normalizePlayers = function (o) {
    var p = Object.assign(S.defaultPlayers(), o || {});
    p.show = !!p.show; p.dealerPlayer = !!p.dealerPlayer;
    p.count = Math.max(1, Math.min(12, Math.round(Number(p.count) || 6)));
    p.cards = Math.max(2, Math.min(4, Math.round(Number(p.cards) || 2)));
    p.seed = Math.max(1, Math.floor(Number(p.seed) || 1));
    if (["bottom", "top", "left", "right"].indexOf(p.dealerSide) < 0) p.dealerSide = "bottom";
    return p;
  };

  /* ---------- the outline as a path with arc length ---------- */
  function pathOf(poly) {
    var n = poly.length, cum = [0], i;
    for (i = 0; i < n; i++) cum.push(cum[i] + G.dist(poly[i], poly[(i + 1) % n]));
    return { pts: poly, cum: cum, L: cum[n] };
  }
  function at(path, s) {
    var L = path.L, n = path.pts.length, i = 0;
    s = ((s % L) + L) % L;
    while (i < n - 1 && path.cum[i + 1] <= s) i++;
    var a = path.pts[i], b = path.pts[(i + 1) % n], seg = path.cum[i + 1] - path.cum[i] || 1, f = (s - path.cum[i]) / seg;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }
  /* Arc length of the dealer position: where the dealer side meets the middle of the table. */
  function dealerArc(path, side) {
    var n = path.pts.length, best = null, vertical = side === "left" || side === "right";
    for (var i = 0; i < n; i++) {
      var p = path.pts[i], q = path.pts[(i + 1) % n], pc = vertical ? p[1] : p[0], qc = vertical ? q[1] : q[0];
      if (pc === qc || pc * qc > 0) continue;
      var f = (0 - pc) / (qc - pc), other = vertical ? p[0] + f * (q[0] - p[0]) : p[1] + f * (q[1] - p[1]);
      var score = side === "bottom" || side === "right" ? other : -other;
      if (!best || score > best.score) best = { score: score, s: path.cum[i] + f * (path.cum[i + 1] - path.cum[i]) };
    }
    return best ? best.s : 0;
  }
  function dealerSideOf(t) {
    var nt = t.preset && t.preset.notch;
    return nt && nt.on ? nt.side : (t.players && t.players.dealerSide) || "bottom";
  }

  /* ---------- objects ---------- */
  function chipObj(x, y, z, r, th, c, rot, stack, idx, n) { return { k: "chip", x: x, y: y, z: z, r: r, th: th, c: c, rot: rot, stack: stack, i: idx, n: n }; }
  function role(o, name) { o.role = name; return o; }
  function cardObj(x, y, z, w, h, rot) { return { k: "card", x: x, y: y, z: z, w: w, h: h, rot: rot, th: S.CARD_THICK }; }

  /* A free pile of chips: later chips rest on the earlier ones they overlap. */
  function pile(out, rnd, cx, cy, dia, th, count, baseAt) {
    var r = dia / 2, placed = [];
    for (var i = 0; i < count; i++) {
      var ang = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * dia * 1.05;
      var x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist * 0.85, z = baseAt ? baseAt(x, y, r) : S.GAP;
      placed.forEach(function (q) { if (Math.hypot(q.x - x, q.y - y) < dia * 0.85) z = Math.max(z, q.z + th + S.GAP); });
      var o = chipObj(x, y, z, r, th, pickOne(rnd, S.CHIP_COLOURS), rnd() * 360, "", 0, 1);
      placed.push(o); out.push(o);
    }
  }
  /* A tall stack: chips directly on each other with a small random sideways drift and turn. */
  function stackOf(out, rnd, x, y, dia, th, n, colour, sid, roleName) {
    var amp = rr(rnd, 0.3, 2), ox = 0, oy = 0;
    for (var j = 0; j < n; j++) {
      ox = Math.max(-3, Math.min(3, ox + (rnd() - 0.5) * amp)); oy = Math.max(-3, Math.min(3, oy + (rnd() - 0.5) * amp));
      out.push(role(chipObj(x + ox, y + oy, S.GAP + j * (th + S.GAP), dia / 2, th, colour, rnd() * 360, sid, j, n), roleName || ""));
    }
  }

  function playersOf(t, st, cs, out, info) {
    var P = t.players, N = P.count, rnd = seeded(P.seed * 7919 + (t.id.length ? t.id.charCodeAt(t.id.length - 1) : 0));
    var local = G.flatten(t.nodes, 0.5);
    if (local.length < 3) return;
    if (G.area(local) < 0) local = local.slice().reverse();
    var path = pathOf(local), slots = P.dealerPlayer ? N : N + 1, sd = dealerArc(path, dealerSideOf(t));
    var I = t.bet.inset > 0 ? t.bet.inset : 250, th = t.bet.thick, dia = cs.chipDia, ct = cs.chipThick, cw = cs.w, chh = cs.h;
    var zoneDepth = I - th / 2 - 16, nCards = P.cards;
    var warn = "";
    if (zoneDepth < chh + 4) warn = "There is not enough room between the cloth edge and the player-area line for the cards (" + Math.round(zoneDepth) + " mm free, " + Math.round(chh) + " mm needed).";
    var tmp = [];
    function frame(s) {
      var p = at(path, s), p1 = at(path, s + 45), p0 = at(path, s - 45), tx = p1[0] - p0[0], ty = p1[1] - p0[1], L = Math.hypot(tx, ty) || 1;
      tx /= L; ty /= L;
      return { p: p, tx: tx, ty: ty, nx: -ty, ny: tx, ang: Math.atan2(ty, tx) * 180 / Math.PI };
    }
    function pt(f, a, d) { return [f.p[0] + f.tx * a + f.nx * d, f.p[1] + f.ty * a + f.ny * d]; }

    /* the hand in progress: who is still in, who has acted, who has bet */
    var button = ir(rnd, 0, N - 1), order = [];
    for (var j = 0; j < N; j++) order.push((button + 1 + j) % N);
    var active = ir(rnd, 1, N), foldedCount = N - active, folded = {}, left = order.slice();
    function weight(seat) { return seat === (button + 1) % N || seat === (button + 2) % N ? 0.4 : seat === button ? 0.7 : 1; }
    for (var fc = 0; fc < foldedCount; fc++) {
      var tot = 0; left.forEach(function (s) { tot += weight(s); });
      var roll = rnd() * tot, idx = 0;
      for (var q = 0; q < left.length; q++) { roll -= weight(left[q]); if (roll <= 0) { idx = q; break; } idx = q; }
      folded[left[idx]] = true; left.splice(idx, 1);
    }
    var acted = ir(rnd, 0, N), checkRound = rnd() < 0.3, level = ir(rnd, 2, 5), raiser = -1;
    var actedActive = order.filter(function (s, i) { return i < acted && !folded[s]; });
    if (!checkRound && actedActive.length > 1 && rnd() < 0.4) raiser = pickOne(rnd, actedActive);
    var bets = {};
    actedActive.forEach(function (s) { if (!checkRound) bets[s] = s === raiser ? level + ir(rnd, 2, 5) : level; });

    for (var seat = 0; seat < N; seat++) {
      var from = tmp.length, slot = P.dealerPlayer ? seat : seat + 1, f = frame(sd + slot * path.L / slots);
      var zRoom = Math.max(0, zoneDepth - chh), jit = Math.min(14, zRoom / 2);
      var dc = Math.max(chh / 2 + 8, Math.min(zoneDepth - chh / 2 + 8, chh / 2 + 10 + rnd() * jit * 2));
      var nStacks = ir(rnd, 1, 3), step = cw * (nCards <= 2 ? 1.06 : nCards === 3 ? 0.78 : 0.62);
      var cardsW = (nCards - 1) * step + cw, chipsW = nStacks * dia * 1.08, total = cardsW + 24 + chipsW, a0 = -total / 2;
      if (!folded[seat]) {
        for (var c = 0; c < nCards; c++) {
          var cp = pt(f, a0 + cw / 2 + c * step, dc + rr(rnd, -2, 2));
          tmp.push(role(cardObj(cp[0], cp[1], S.GAP + c * (S.CARD_THICK + S.GAP), cw, chh, f.ang + rr(rnd, -3, 3)), "hand"));
        }
      }
      for (var k = 0; k < nStacks; k++) {
        var dd = Math.max(dia / 2 + 8, Math.min(zoneDepth - dia / 2 + 8, dia / 2 + 10 + rnd() * Math.max(0, zoneDepth - dia - 10)));
        var sp = pt(f, a0 + cardsW + 24 + dia * 0.54 + k * dia * 1.08, dd);
        stackOf(tmp, rnd, sp[0], sp[1], dia, ct, ir(rnd, 3, 14), pickOne(rnd, S.CHIP_COLOURS), "s" + seat + "." + k, "stack");
      }
      /* inside the line: folded cards, bets and the button */
      var inner = I + th / 2;
      if (folded[seat]) {
        for (var m = 0; m < nCards; m++) {
          var fp = pt(f, rr(rnd, -45, 15) + m * 6, inner + chh / 2 + 10 + rr(rnd, 0, 30));
          tmp.push(role(cardObj(fp[0], fp[1], S.GAP + m * (S.CARD_THICK + S.GAP), cw, chh, rr(rnd, 0, 360)), "tossed"));
        }
      } else if (bets[seat]) {
        var amount = bets[seat], colour = pickOne(rnd, S.CHIP_COLOURS), parts = amount > 6 ? [Math.ceil(amount / 2), Math.floor(amount / 2)] : [amount];
        parts.forEach(function (n, pi) {
          var bp = pt(f, -45 + pi * dia * 1.05 + rr(rnd, -8, 8), inner + dia / 2 + 10 + rr(rnd, 0, 35));
          stackOf(tmp, rnd, bp[0], bp[1], dia, ct, n, colour, "b" + seat + "." + pi, "bet");
        });
      }
      if (seat === button) {
        var bpos = pt(f, 75 + rr(rnd, -10, 10), inner + S.BUTTON.r + rr(rnd, 0, 15));
        tmp.push({ k: "button", role: "button", x: bpos[0], y: bpos[1], z: S.GAP, r: S.BUTTON.r, th: S.BUTTON.th, rot: f.ang + rr(rnd, -25, 25) });
      }
      for (var ti = from; ti < tmp.length; ti++) tmp[ti].seat = seat;
    }
    /* local to world */
    var rot = t.rot;
    tmp.forEach(function (o) {
      var w = G.transformPoints([[o.x, o.y]], t.x, t.y, t.rot)[0];
      o.x = w[0]; o.y = w[1];
      if (o.rot !== undefined && o.k !== "chip") o.rot += rot;
      out.push(o);
    });
    var foldedSeats = Object.keys(folded).map(Number).sort(function (a, b) { return a - b; });
    info.tables.push({ id: t.id, name: t.name, seats: N, active: active, button: button + 1, buttonSeat: button, folded: foldedSeats, bets: bets, order: order, warn: warn });
    if (warn) info.warn.push(t.name + ": " + warn);
  }

  /* ---------- the whole scene ---------- */
  var memo = { key: "", val: null };
  S.build = function (st) {
    st = st || C().state();
    var cs = C().cardSize(), c = st.cards, b = st.band, AO = C().artOrigin();
    var tabs = st.tables.filter(function (t) { return t.visible && t.players && t.players.show; });
    var key = JSON.stringify([c, AO.x, AO.y, b.x, b.y, b.gap, b.thick, cs, tabs.map(function (t) { return [t.id, t.nodes, t.x, t.y, t.rot, t.bet.inset, t.bet.thick, t.players, t.preset && t.preset.notch]; })]);
    if (memo.key === key) return memo.val;
    var out = [], info = { tables: [], warn: [] }, ox = AO.x + b.x, oy = AO.y + b.y;
    cs.chipDia = Math.max(5, c.chipDia); cs.chipThick = Math.max(0.2, c.chipThick);
    /* Burn cards come first so they are drawn below the pot; chips that overlap them rest on top. */
    var burns = [], burnTop = S.GAP + 2 * (S.CARD_THICK + S.GAP) + S.CARD_THICK + S.GAP;
    if (c.burnShow) {
      for (var k = 0; k < 3; k++) {
        var bo = cardObj(ox + c.burnX + (k - 1) * cs.w * 0.15, oy + c.burnY + (k - 1) * cs.h * 0.2, S.GAP + k * (S.CARD_THICK + S.GAP), cs.w, cs.h, 0);
        burns.push(bo); out.push(bo);
      }
    }
    if (c.potShow) {
      var rp = seeded(c.potSeed);
      pile(out, rp, ox + c.potX, oy + c.potY, cs.chipDia, cs.chipThick, 9, function (x, y, r) {
        return burns.some(function (q) { return Math.abs(x - q.x) < q.w / 2 + r && Math.abs(y - q.y) < q.h / 2 + r; }) ? burnTop : S.GAP;
      });
    }
    if (c.muckShow) {
      var rm = seeded(c.muckSeed);
      for (var m = 0; m < 8; m++) out.push(cardObj(ox + c.muckX + (rm() - 0.5) * cs.w * 0.9, oy + c.muckY + (rm() - 0.5) * cs.h * 0.6, S.GAP + m * (S.CARD_THICK + S.GAP), cs.w, cs.h, (rm() - 0.5) * 80));
    }
    tabs.forEach(function (t) { playersOf(t, st, cs, out, info); });
    memo.key = key; memo.val = { objs: out, info: info, chip: { dia: cs.chipDia, thick: cs.chipThick }, card: { w: cs.w, h: cs.h } };
    return memo.val;
  };
  S.any = function (st) {
    st = st || C().state();
    return !!(st.cards.potShow || st.cards.burnShow || st.cards.muckShow || st.tables.some(function (t) { return t.visible && t.players && t.players.show; }));
  };

  /* ---------- drawing from above ---------- */
  S.draw = function (parent, scene, H) {
    var el = H.el, hex = H.colorHex, g = el("g", { "data-scene": "1", "pointer-events": "none" }, parent);
    scene.objs.forEach(function (o) {
      if (o.k === "chip") {
        if (o.n > 1 && o.i < o.n - 3) return;   /* the lower chips of a tall stack are hidden under the top ones */
        var low = o.z <= S.GAP + 0.001 || (o.n > 1 && o.i === o.n - 3);
        var fill = hex(o.c), mark = hex(o.c === "ivory" ? "black" : "ivory"), sw = Math.max(0.4, o.r * 0.06), rim = o.r * 0.8, circ = 2 * Math.PI * rim;
        if (low) el("circle", { cx: o.x + o.r * 0.1, cy: o.y + o.r * 0.14, r: o.r * 1.02, fill: "#000", "fill-opacity": 0.28 }, g);
        el("circle", { cx: o.x, cy: o.y, r: o.r, fill: fill, stroke: hex("black"), "stroke-width": sw }, g);
        el("circle", { cx: o.x, cy: o.y, r: rim, fill: "none", stroke: mark, "stroke-width": o.r * 0.26, "stroke-dasharray": (circ / 16) + " " + (circ / 16), "stroke-dashoffset": (o.rot / 360) * circ }, g);
        el("circle", { cx: o.x, cy: o.y, r: o.r * 0.5, fill: "none", stroke: mark, "stroke-width": sw * 1.5 }, g);
      } else if (o.k === "card") {
        var x = o.x - o.w / 2, y = o.y - o.h / 2, cg = el("g", { transform: "rotate(" + o.rot + " " + o.x + " " + o.y + ")" }, g), w = o.w, h = o.h, s2 = Math.max(0.5, h * 0.012);
        el("rect", { x: x + 0.8, y: y + 1.1, width: w, height: h, rx: w * 0.09, fill: "#000", "fill-opacity": 0.22 }, cg);
        el("rect", { x: x, y: y, width: w, height: h, rx: w * 0.09, fill: hex("red"), stroke: hex("black"), "stroke-width": s2 }, cg);
        el("rect", { x: x + w * 0.1, y: y + h * 0.07, width: w * 0.8, height: h * 0.86, rx: w * 0.05, fill: "none", stroke: hex("ivory"), "stroke-width": s2 * 1.4 }, cg);
        var r = w * 0.2;
        el("path", { d: "M" + o.x + " " + (o.y - r * 1.4) + " L" + (o.x + r) + " " + o.y + " L" + o.x + " " + (o.y + r * 1.4) + " L" + (o.x - r) + " " + o.y + " Z", fill: "none", stroke: hex("ivory"), "stroke-width": s2 * 1.4 }, cg);
      } else if (o.k === "button") {
        var bg = el("g", { transform: "rotate(" + o.rot + " " + o.x + " " + o.y + ")" }, g);
        el("circle", { cx: o.x + o.r * 0.06, cy: o.y + o.r * 0.1, r: o.r * 1.02, fill: "#000", "fill-opacity": 0.28 }, bg);
        el("circle", { cx: o.x, cy: o.y, r: o.r, fill: "#f6f3ea", stroke: hex("black"), "stroke-width": o.r * 0.03 }, bg);
        el("circle", { cx: o.x, cy: o.y, r: o.r * 0.86, fill: "none", stroke: hex("black"), "stroke-width": o.r * 0.025 }, bg);
        var tx = el("text", { x: o.x, y: o.y, "text-anchor": "middle", "dominant-baseline": "central", "font-size": o.r * 0.34, fill: hex("black"), "font-weight": 700 }, bg);
        tx.style.fontFamily = "'Josefin Sans', 'Segoe UI', Arial, sans-serif"; tx.style.letterSpacing = (o.r * 0.03) + "px"; tx.textContent = "DEALER";
      }
    });
    return g;
  };

  PTD.scene = S;
})(window.PTD = window.PTD || {});
