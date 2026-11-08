/* The Fringe generator (REQ-058): things that stand on a path at even or jittered places: spikes, curls, lightning with forks, waves, flames and
 * feathers. Every item is a centre line with a width profile, built in a local frame (x along the start direction, y turned a quarter clockwise on
 * the screen), turned into polygons that are all wound the same way (so overlapping items never cancel each other in a union, see V122), and put on the
 * path. Items can be merged or layered (each item is cut by a gap round the items above it). No browser parts: tested with Node. */
(function (PTD) {
  "use strict";
  var P = typeof window !== "undefined" ? PTD.paths : require("./paths.js");
  var F = {}, H = P._h, RAD = Math.PI / 180, warn = "";
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pick(v, list, d) { return list.indexOf(v) >= 0 ? v : d; }

  F.FORMS = ["straight", "curl", "lightning", "wave", "flame", "feather"];
  F.defaults = function () {
    return {
      type: "fringe", on: true, form: "straight", side: "outside", both: "off", second: "mirror", sameDir: false, dist: 0, length: 80, width: 14, wfollow: true, power: 2, tmix: 0, tip: 0, lean: 0, fan: 0,
      mode: "count", n: 24, len: 60, fit: true, phase: 0, scope: "whole", place: "even", jitter: 40, seed: 1, lvar: "none", lamt: 40, lperiod: 8,
      overlap: "merge", gap: 2, order: "shingled", dir: "forward",
      bend: 360, bpow: 2, turn: "clockwise", waves: 1.5, amp: 12,
      detail: 5, jag: 18, rough: 0.55, forks: 4, flevels: 2, fangle: 30, fspread: 15, flen: 45, fwid: 55, sameBolt: false, smooth: false,
      curl: 50, belly: 0.3, licks: false, lickN: 2, lickSize: 35, inner: false, innerSize: 50,
      vshape: "pointed", asym: 0, fbend: 30, shaft: false, shaftW: 1.5, barbs: false, barbN: 10, barbW: 1, barbAng: 40, notch: false, notchD: 25
    };
  };
  F.norm = function (o) {
    var d = F.defaults(), g = Object.assign(d, o || {});
    g.type = "fringe"; g.on = g.on !== false;
    g.form = pick(g.form, F.FORMS, "straight"); g.side = pick(g.side, ["outside", "inside", "left", "right"], "outside"); g.both = pick(g.both, ["off", "mirror", "independent"], "off");
    if (!(o && o.second) && o && o.sameDir) g.second = "rotated"; g.second = g.second === "rotated" ? "rotated" : "mirror"; g.sameDir = g.second === "rotated"; g.dist = Math.max(0, num(g.dist, 0)); g.length = Math.max(1, num(g.length, 80)); g.width = Math.max(0.2, num(g.width, 14)); g.wfollow = g.wfollow !== false;
    g.power = clamp(num(g.power, 2), 0.1, 100); g.tmix = clamp(num(g.tmix, 0), 0, 1); g.tip = Math.max(0, num(g.tip, 0)); g.lean = clamp(num(g.lean, 0), -85, 85); g.fan = clamp(num(g.fan, 0), -360, 360);
    g.mode = g.mode === "length" ? "length" : "count"; g.n = Math.max(1, Math.round(num(g.n, 24))); g.len = Math.max(1, num(g.len, 60)); g.fit = g.fit !== false; g.phase = num(g.phase, 0);
    g.scope = g.scope === "sides" ? "sides" : "whole"; g.place = pick(g.place, ["even", "jitter"], "even"); g.jitter = clamp(num(g.jitter, 40), 0, 100); g.seed = Math.round(num(g.seed, 1));
    g.lvar = pick(g.lvar, ["none", "alternate", "wave", "random"], "none"); g.lamt = clamp(num(g.lamt, 40), 0, 95); g.lperiod = Math.max(2, num(g.lperiod, 8));
    g.overlap = pick(g.overlap, ["merge", "layered"], "merge"); g.gap = Math.max(0, num(g.gap, 2)); g.order = pick(g.order, ["random", "shingled", "alternate"], "shingled"); g.dir = pick(g.dir, ["forward", "backward"], "forward");
    g.bend = clamp(num(g.bend, 360), 0, 1440); g.bpow = clamp(num(g.bpow, 2), 0.2, 8); g.turn = pick(g.turn, ["clockwise", "anticlockwise", "alternate", "random"], "clockwise");
    g.waves = clamp(num(g.waves, 1.5), 0.25, 12); g.amp = Math.max(0, num(g.amp, 12));
    g.detail = clamp(Math.round(num(g.detail, 5)), 1, 8); g.jag = clamp(num(g.jag, 18), 0, 80); g.rough = clamp(num(g.rough, 0.55), 0.2, 0.95);
    g.forks = clamp(Math.round(num(g.forks, 4)), 0, 12); g.flevels = clamp(Math.round(num(g.flevels, 2)), 0, 5); g.fangle = clamp(num(g.fangle, 30), 0, 85); g.fspread = clamp(num(g.fspread, 15), 0, 60);
    g.flen = clamp(num(g.flen, 45), 5, 95); g.fwid = clamp(num(g.fwid, 55), 5, 100); g.sameBolt = !!g.sameBolt; g.smooth = !!g.smooth;
    g.curl = clamp(num(g.curl, 50), 0, 100); g.belly = clamp(num(g.belly, 0.3), 0.1, 0.7); g.licks = !!g.licks; g.lickN = clamp(Math.round(num(g.lickN, 2)), 1, 8); g.lickSize = clamp(num(g.lickSize, 35), 10, 80);
    g.inner = !!g.inner; g.innerSize = clamp(num(g.innerSize, 50), 15, 85);
    g.vshape = pick(g.vshape, ["pointed", "round"], "pointed"); g.asym = clamp(num(g.asym, 0), -90, 90); g.fbend = clamp(num(g.fbend, 30), 0, 180);
    g.shaft = !!g.shaft; g.shaftW = Math.max(0.1, num(g.shaftW, 1.5)); g.barbs = !!g.barbs; g.barbN = clamp(Math.round(num(g.barbN, 10)), 1, 60); g.barbW = Math.max(0.1, num(g.barbW, 1)); g.barbAng = clamp(num(g.barbAng, 40), 10, 80);
    g.notch = !!g.notch; g.notchD = clamp(num(g.notchD, 25), 5, 70);
    return g;
  };
  F.takeWarn = function () { var w = warn; warn = ""; return w; };

  /* width profile: half the width at t (0 root, 1 tip) as a fraction of the base width, for the left and the right side */
  function taperAt(g, t) {   /* a power curve (1 - t)^p mixed with the straight cone: p above 1 is concave (a thorn), below 1 convex */
    return g.tmix * (1 - t) + (1 - g.tmix) * Math.pow(1 - t, g.power);
  }
  function profile(g, form, t, W) {
    var hl, hr;
    if (form === "flame") {
      var gam = Math.log(0.5) / Math.log(g.belly), f = 0.75 * Math.sin(Math.PI * Math.pow(t, gam)) + 0.25 * (1 - t);
      hl = hr = W / 2 * Math.max(0, f);
    } else if (form === "feather") {
      var gm = Math.log(0.5) / Math.log(0.4), s = Math.sin(Math.PI * Math.pow(t, gm)), f2 = g.vshape === "round" ? Math.pow(Math.max(0, s), 0.55) : s, a = g.asym / 100;
      hl = W / 2 * (1 + a) * f2; hr = W / 2 * (1 - a) * f2;
    } else {
      var w = g.tip + (W - g.tip) * taperAt(g, t); hl = hr = Math.max(0, w) / 2;
    }
    return [hl, hr];
  }

  /* ---------- centre lines in the local frame: arrays of [x, y, t] ---------- */
  function along(h0, ox, oy, a, b) { return [ox + Math.cos(h0) * a - Math.sin(h0) * b, oy + Math.sin(h0) * a + Math.cos(h0) * b]; }
  function integrate(ox, oy, h0, L, N, turnFn) {
    var pts = [[ox, oy, 0]], x = ox, y = oy, ds = L / N;
    for (var i = 1; i <= N; i++) { var tm = (i - 0.5) / N, th = h0 + turnFn(tm); x += Math.cos(th) * ds; y += Math.sin(th) * ds; pts.push([x, y, i / N]); }
    return pts;
  }
  function lightningLine(g, ox, oy, h0, L, rnd, depth) {
    var pts = [[0, 0], [L, 0]], lvl, i;
    for (lvl = 0; lvl < Math.max(2, g.detail - (depth || 0)); lvl++) {
      var np = [pts[0]], amp = g.jag / 100 * L * Math.pow(g.rough, lvl);
      for (i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i]; np.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (rnd() - 0.5) * 2 * amp]); np.push(b); }
      pts = np;
    }
    if (g.smooth) for (var it = 0; it < 2; it++) { var sm = [pts[0]]; for (i = 0; i < pts.length - 1; i++) { var p0 = pts[i], p1 = pts[i + 1]; sm.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]); sm.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]); } sm.push(pts[pts.length - 1]); pts = sm; }
    return pts.map(function (q, k) { var w = along(h0, ox, oy, q[0], q[1]); return [w[0], w[1], k / (pts.length - 1)]; });
  }
  function centreLine(g, form, ox, oy, h0, L, cs, rnd, depth) {
    var N, i, pts;
    if (form === "straight") { N = 16; pts = []; for (i = 0; i <= N; i++) pts.push([ox + Math.cos(h0) * L * i / N, oy + Math.sin(h0) * L * i / N, i / N]); return pts; }
    if (form === "curl") return integrate(ox, oy, h0, L, 56, function (t) { return cs * g.bend * RAD * Math.pow(t, g.bpow) * 1; });
    if (form === "feather") return integrate(ox, oy, h0, L, 32, function (t) { return cs * g.fbend * RAD * t; });
    if (form === "lightning") return lightningLine(g, ox, oy, h0, L, rnd, depth);
    N = 56; pts = [];
    for (i = 0; i <= N; i++) {
      var t = i / N, yv;
      if (form === "wave") yv = cs * g.amp * Math.sin(2 * Math.PI * g.waves * t);
      else { var c = g.curl / 50, flick = Math.max(0, (t - 0.7) / 0.3); yv = cs * L * (0.16 * c * Math.pow(t, 1.4) * Math.sin(2 * Math.PI * (0.5 + 0.6 * c) * t) + 0.2 * c * flick * flick); }
      var w = along(h0, ox, oy, L * t, yv); pts.push([w[0], w[1], t]);
    }
    return pts;
  }

  /* ---------- from a centre line to polygons (local coordinates) ---------- */
  function disc(x, y, r, out) { var q = [], k; for (k = 0; k < 10; k++) q.push([x + r * Math.cos(2 * Math.PI * k / 10), y + r * Math.sin(2 * Math.PI * k / 10)]); out.push(q); }
  function ribbon(pts, hf, form, out) {
    var n = pts.length, i, dirs = [], hw = pts.map(function (q) { return hf(q[2]); });
    for (i = 0; i < n - 1; i++) { var dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy) || 1; dirs.push([-dy / l, dx / l]); }
    if (form === "straight") {
      var L1 = [], R1 = [];
      for (i = 0; i < n; i++) { var nm = dirs[Math.min(i, n - 2)]; L1.push([pts[i][0] + nm[0] * hw[i][0], pts[i][1] + nm[1] * hw[i][0]]); R1.push([pts[i][0] - nm[0] * hw[i][1], pts[i][1] - nm[1] * hw[i][1]]); }
      out.push(L1.concat(R1.reverse())); return;
    }
    for (i = 0; i < n - 1; i++) {
      var a = pts[i], b = pts[i + 1], nn = dirs[i];
      out.push([[a[0] + nn[0] * hw[i][0], a[1] + nn[1] * hw[i][0]], [b[0] + nn[0] * hw[i + 1][0], b[1] + nn[1] * hw[i + 1][0]], [b[0] - nn[0] * hw[i + 1][1], b[1] - nn[1] * hw[i + 1][1]], [a[0] - nn[0] * hw[i][1], a[1] - nn[1] * hw[i][1]]]);
      if (i > 0) {   /* a joint: a triangle on each side closes the wedge between the two quads (no gaps, however small the turn) */
        var p = dirs[i - 1];
        out.push([[a[0], a[1]], [a[0] + p[0] * hw[i][0], a[1] + p[1] * hw[i][0]], [a[0] + nn[0] * hw[i][0], a[1] + nn[1] * hw[i][0]]]);
        out.push([[a[0], a[1]], [a[0] - p[0] * hw[i][1], a[1] - p[1] * hw[i][1]], [a[0] - nn[0] * hw[i][1], a[1] - nn[1] * hw[i][1]]]);
      }
    }
  }

  /* one stalk of a bolt or flame with its forks or licks; polygons go to out. ctx: { g, rnd, cs, budget } */
  function bolt(ctx, form, ox, oy, h0, L, W, level, out) {
    var g = ctx.g, pts = centreLine(g, form, ox, oy, h0, L, ctx.cs, ctx.rnd, level), Wc = W;
    if (ctx.budget <= 0) return;
    ctx.budget -= pts.length;
    ribbon(pts, function (t) { return profile(g, form, t, Wc); }, form, out);
    function heading(i) { var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; return Math.atan2(b[1] - a[1], b[0] - a[0]); }
    if (form === "lightning" && level < g.flevels) {
      for (var k = 0; k < g.forks && ctx.budget > 0; k++) {
        var t = 0.12 + 0.7 * ctx.rnd(), idx = Math.max(1, Math.min(pts.length - 2, Math.round(t * (pts.length - 1)))), side = ctx.rnd() < 0.5 ? 1 : -1;
        var ang = side * (g.fangle + (ctx.rnd() - 0.5) * 2 * g.fspread) * RAD;
        bolt(ctx, "lightning", pts[idx][0], pts[idx][1], heading(idx) + ang, L * g.flen / 100 * (1 - 0.5 * t), W * g.fwid / 100, level + 1, out);
      }
    }
    if (form === "flame" && g.licks && level === 0) {
      for (var j = 0; j < g.lickN && ctx.budget > 0; j++) {
        var tl = 0.2 + 0.5 * ctx.rnd(), il = Math.max(1, Math.min(pts.length - 2, Math.round(tl * (pts.length - 1)))), sd = j % 2 ? 1 : -1;
        bolt(ctx, "flame", pts[il][0], pts[il][1], heading(il) + sd * 35 * RAD, L * g.lickSize / 100, W * g.lickSize / 100, 1, out);
      }
    }
  }

  /* the polygons of one item, in world coordinates as Clipper paths, all wound the same way */
  function toWorld(polys, R, e1, e2) {
    var C = H.clip(), out = [];
    polys.forEach(function (pl) {
      var ip = H.toInt(pl.map(function (q) { return [R[0] + e1[0] * q[0] + e2[0] * q[1], R[1] + e1[1] * q[0] + e2[1] * q[1]]; }));
      if (ip.length < 3 || Math.abs(C.Clipper.Area(ip)) < 200) return;
      if (!C.Clipper.Orientation(ip)) ip.reverse();
      out.push(ip);
    });
    return out;
  }
  function localCut(poly, R, e1, e2) { return toWorld([poly], R, e1, e2); }

  function buildItem(g, L, W, cs, rnd, R, e1, e2) {
    var ctx = { g: g, rnd: rnd, cs: cs, budget: 1500 }, polys = [], form = g.form;
    bolt(ctx, form, 0, 0, 0, L, W, 0, polys);
    var paths = toWorld(polys, R, e1, e2);
    if (form !== "straight" && paths.length > 1) paths = H.unionPaths(paths, false);
    var cuts = [];
    if (form === "flame" && g.inner) {
      var ip = [], c2 = { g: g, rnd: rnd, cs: cs, budget: 3000 }, k = g.innerSize / 100;
      bolt(c2, "flame", L * 0.04, 0, 0, L * k, W * k, 1, ip);
      cuts = cuts.concat(toWorld(ip, R, e1, e2));
    }
    if (form === "feather") {
      var line = centreLine(g, "feather", 0, 0, 0, L, cs, rnd), n = line.length;
      function at(t) { var i = Math.min(n - 2, Math.floor(t * (n - 1))), f = t * (n - 1) - i, a = line[i], b = line[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return { x: a[0] + dx * f, y: a[1] + dy * f, tx: dx / l, ty: dy / l }; }
      if (g.notch) { var ap = at(1 - g.notchD / 100), tp = at(1), w2 = W * 0.8; cuts = cuts.concat(localCut([[ap.x, ap.y], [tp.x - tp.ty * w2 + tp.tx * 0.1 * L, tp.y + tp.tx * w2 + tp.ty * 0.1 * L], [tp.x + tp.ty * w2 + tp.tx * 0.1 * L, tp.y - tp.tx * w2 + tp.ty * 0.1 * L]], R, e1, e2)); }
      if (g.shaft) { var sl = []; for (var s = 0; s <= 12; s++) { var q = at(0.04 + 0.92 * s / 12); sl.push([q.x, q.y]); } cuts = cuts.concat(localLine(sl, g.shaftW, R, e1, e2)); }
      if (g.barbs) {
        for (var b = 1; b <= g.barbN; b++) {
          var tb = 0.1 + 0.8 * b / (g.barbN + 1), q2 = at(tb), ang = g.barbAng * RAD, ln = W * 0.9 / Math.sin(ang);
          [1, -1].forEach(function (sg) { var ex = q2.x + q2.tx * Math.cos(ang) * ln - q2.ty * sg * Math.sin(ang) * ln, ey = q2.y + q2.ty * Math.cos(ang) * ln + q2.tx * sg * Math.sin(ang) * ln; cuts = cuts.concat(localLine([[q2.x, q2.y], [ex, ey]], g.barbW, R, e1, e2)); });
        }
      }
    }
    if (cuts.length) paths = H.diffPaths(paths, H.unionPaths(cuts, false));
    return tidy(paths);
  }
  function tidy(paths) { var CL = H.clip(); return paths.filter(function (q) { var a = CL.Clipper.Area(q); return Math.abs(a) > 20000 && (a < 0 || a > 300000); }); }
  function localLine(pts, w, R, e1, e2) {
    var wp = pts.map(function (q) { return [R[0] + e1[0] * q[0] + e2[0] * q[1], R[1] + e1[1] * q[0] + e2[1] * q[1]]; });
    return H.strokePaths(wp, w, false, false);
  }

  /* an estimate of the points in one item, to warn and to stop before the page freezes */
  function estimate(g) {
    var f = g.form;
    if (f === "straight") return 40;
    if (f === "lightning") { var br = 1, tot = 0, l; for (l = 0; l <= g.flevels; l++) { tot += br; br *= Math.max(1, g.forks); } return Math.min(1500, tot * (1 << g.detail) * 5); }
    if (f === "flame") return 300 * (g.licks ? 1 + g.lickN : 1);
    return 320;
  }
  function bbOf(paths) { var x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18; paths.forEach(function (p) { p.forEach(function (q) { if (q.X < x0) x0 = q.X; if (q.X > x1) x1 = q.X; if (q.Y < y0) y0 = q.Y; if (q.Y > y1) y1 = q.Y; }); }); return { x0: x0, y0: y0, x1: x1, y1: y1 }; }

  function layerItems(items, gapU) {
    var out = [], sorted = items.slice().sort(function (a, b) { return a.bb.x0 - b.bb.x0; }), maxW = 0, i, j;
    sorted.forEach(function (it) { maxW = Math.max(maxW, it.bb.x1 - it.bb.x0); });
    var xs = sorted.map(function (it) { return it.bb.x0; });
    function lower(v) { var lo = 0, hi = xs.length; while (lo < hi) { var m = (lo + hi) >> 1; if (xs[m] < v) lo = m + 1; else hi = m; } return lo; }
    for (i = 0; i < sorted.length; i++) {
      var it = sorted[i], above = [];
      for (j = lower(it.bb.x0 - maxW - gapU); j < sorted.length && sorted[j].bb.x0 <= it.bb.x1 + gapU; j++) {
        var o = sorted[j];
        if (o === it || o.rank <= it.rank) continue;
        if (o.bb.x1 < it.bb.x0 - gapU || o.bb.y1 < it.bb.y0 - gapU || o.bb.y0 > it.bb.y1 + gapU) continue;
        above = above.concat(o.paths);
      }
      if (!above.length) { out = out.concat(it.paths); continue; }
      var cut = H.unionPaths(above, false);
      if (gapU > 0) cut = H.offsetPaths(cut, gapU / 1000);
      out = out.concat(H.diffPaths(it.paths, cut));
    }
    return out;
  }

  /* the Clipper paths of this generator on one run of a path */
  F.onRun = function (sm, g, plan, flip, closedRun) {
    var L = sm.L, lam = plan.lam, n = Math.max(1, Math.floor(plan.n + 1e-6)), sg = H.sideSign(sm, g, flip) || 1;
    var sides = g.both === "off" ? [sg] : [1, -1], est = estimate(g), total = n * sides.length * est;
    if (total > 1e5) { n = Math.max(1, Math.floor(1e5 / (sides.length * est))); warn = "Stopped at " + n + " per side: more would be too slow (over 100 thousand points)."; }
    else if (total > 2e4) warn = "This is a lot of points (about " + Math.round(total / 1000) + " thousand): it may be slow.";
    var items = [], i, j, amt = g.lamt / 100;
    for (i = 0; i < n; i++) {
      for (j = 0; j < sides.length; j++) {
        var s = sides[j], js = g.both === "independent" ? j : 0, seedI = g.seed * 1000003 + i * 7919 + js * 104729 + 17;
        var r = H.rng(seedI), r2 = H.rng(g.seed * 7727 + i * 131 + js * 977 + 3);
        var du = g.place === "jitter" ? (r2() - 0.5) * g.jitter / 100 * lam : 0;
        var u = (closedRun ? i * lam : (i + 0.5) * lam) + g.phase * lam + du;
        if (closedRun) u = ((u % L) + L) % L; else if (u < 0 || u > L) continue;
        var f = H.frameAt(sm, Math.min(u, L - 1e-9)), nx = f.ty * s, ny = -f.tx * s, R = [f.x + nx * g.dist, f.y + ny * g.dist];
        var a = (g.lean + g.fan * (u / L - 0.5)) * RAD, mirror2 = g.both !== "off" && s !== sg ? 1 : 0;
        if (g.both !== "off" && s === -1 && g.sameDir) a = -a;
        var e1 = [nx * Math.cos(a) + f.tx * Math.sin(a), ny * Math.cos(a) + f.ty * Math.sin(a)], e2 = [-e1[1], e1[0]];
        var lf = 1, ph = g.both === "independent" ? j : 0;
        if (g.lvar === "alternate") lf = (i + ph) % 2 ? 1 - amt : 1;
        else if (g.lvar === "wave") lf = 1 - amt * (0.5 - 0.5 * Math.cos(2 * Math.PI * (i + ph * g.lperiod / 2) / g.lperiod));
        else if (g.lvar === "random") lf = 1 - amt * r();
        var cs = g.turn === "anticlockwise" ? -1 : g.turn === "alternate" ? (i % 2 ? -1 : 1) : g.turn === "random" ? (r() < 0.5 ? -1 : 1) : 1;
        if (g.both !== "off" && s === -1 && !g.sameDir) cs = -cs;
        var rb = H.rng(g.form === "lightning" && g.sameBolt ? g.seed : seedI + 5);
        var paths = buildItem(g, g.length * lf, g.wfollow ? g.width * lf : g.width, cs, rb, R, e1, e2);
        if (!paths.length) continue;
        var rank = g.order === "random" ? r2() * 1e6 : g.order === "alternate" ? (i % 2) * 1e7 + i : (g.dir === "forward" ? i : -i);
        rank += j * 0.25;
        items.push({ paths: paths, rank: rank, bb: g.overlap === "layered" ? bbOf(paths) : null });
      }
    }
    if (g.overlap === "layered" && g.gap >= 0) return tidy(layerItems(items, g.gap * 1000));
    var all = []; items.forEach(function (it) { all = all.concat(it.paths); });
    return tidy(all.length > 1 ? H.unionPaths(all, false) : all);
  };

  /* the paths of this generator on one loop (the same runs as the other generators) */
  F.onLoop = function (sm, g, flip) {
    var runs, out = [];
    if (g.scope === "sides") {
      runs = H.runsOf(sm, 25).map(function (r) { if (r.whole) return { sm: sm, closed: sm.closed }; return { sm: P.sample({ pts: r.pts, closed: false }, 0), closed: false }; });
    } else runs = [{ sm: sm, closed: sm.closed }];
    runs.forEach(function (run) {
      if (run.sm.L < 1e-6) return;
      var plan = H.planRun(run.sm, g);
      out = out.concat(F.onRun(run.sm, g, plan, flip, run.closed && plan.whole));
    });
    return out;
  };
  P.fringe = F;
  if (typeof module !== "undefined" && module.exports) module.exports = F;
})(typeof window !== "undefined" ? (window.PTD = window.PTD || {}) : {});
