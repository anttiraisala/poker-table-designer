/* Exports: cut file for a vinyl cutter (SVG, one group per palette colour), a PNG picture of the
 * artwork, and a Blender scene script built from the project.
 *
 * Cutting: every object becomes closed polygons. Upper objects knock out what lies below them (their
 * outline halo, or their own shape). The boolean work and the offsets (round halos, blade offset) use
 * Clipper (js/clipper.js, Boost licence, integer arithmetic, so it is robust and needs no network). Text must be outlines: frozen text is
 * used as is, text with an imported font file is turned into outlines for the export. */
(function (PTD) {
  "use strict";
  var X = {}, G = PTD.geom;
  var C = function () { return PTD.core; };
  var busy = false;

  function xp() { return C().state().export; }
  function msg(t) { var m = document.getElementById("exportMsg"); if (m) m.textContent = t || ""; C().say(t); }
  function num3(v) { return String(Math.round(v * 1000) / 1000); }

  /* ---------- reading outline path data into polygons ---------- */
  /* Supports M L H V C Q Z in absolute and relative form, which covers what opentype.js writes. */
  X.parsePath = function (d, tol) {
    tol = tol || 0.05;
    var re = /([MLHVCQZmlhvcqz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/gi, toks = [], m;
    while ((m = re.exec(d))) toks.push(m[1] ? m[1] : parseFloat(m[2]));
    var rings = [], cur = null, x = 0, y = 0, sx = 0, sy = 0, i = 0, cmd = "";
    function need(n) { return i + n <= toks.length && toks.slice(i, i + n).every(function (t) { return typeof t === "number"; }); }
    function bez(pts) {
      var len = 0, k;
      for (k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      var n = Math.max(4, Math.min(64, Math.ceil(Math.sqrt(len / tol) / 1.4)));
      for (k = 1; k <= n; k++) {
        var t = k / n, u = 1 - t, px, py;
        if (pts.length === 3) { px = u * u * pts[0][0] + 2 * u * t * pts[1][0] + t * t * pts[2][0]; py = u * u * pts[0][1] + 2 * u * t * pts[1][1] + t * t * pts[2][1]; }
        else { px = u * u * u * pts[0][0] + 3 * u * u * t * pts[1][0] + 3 * u * t * t * pts[2][0] + t * t * t * pts[3][0]; py = u * u * u * pts[0][1] + 3 * u * u * t * pts[1][1] + 3 * u * t * t * pts[2][1] + t * t * t * pts[3][1]; }
        cur.push([px, py]);
      }
    }
    function close() { if (cur && cur.length > 2) rings.push(cur); cur = null; }
    while (i < toks.length) {
      if (typeof toks[i] === "string") cmd = toks[i++];
      else if (!cmd) { i++; continue; }
      var rel = cmd === cmd.toLowerCase(), c = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      if (c === "Z") { x = sx; y = sy; close(); cmd = ""; continue; }
      if (c === "M" && need(2)) { close(); x = toks[i++] + ox; y = toks[i++] + oy; sx = x; sy = y; cur = [[x, y]]; cmd = rel ? "l" : "L"; }
      else if (c === "L" && need(2)) { if (!cur) cur = [[x, y]]; x = toks[i++] + ox; y = toks[i++] + oy; cur.push([x, y]); }
      else if (c === "H" && need(1)) { if (!cur) cur = [[x, y]]; x = toks[i++] + ox; cur.push([x, y]); }
      else if (c === "V" && need(1)) { if (!cur) cur = [[x, y]]; y = toks[i++] + oy; cur.push([x, y]); }
      else if (c === "Q" && need(4)) { if (!cur) cur = [[x, y]]; var q1 = [toks[i++] + ox, toks[i++] + oy], q2 = [toks[i++] + ox, toks[i++] + oy]; bez([[x, y], q1, q2]); x = q2[0]; y = q2[1]; }
      else if (c === "C" && need(6)) { if (!cur) cur = [[x, y]]; var c1 = [toks[i++] + ox, toks[i++] + oy], c2 = [toks[i++] + ox, toks[i++] + oy], c3 = [toks[i++] + ox, toks[i++] + oy]; bez([[x, y], c1, c2, c3]); x = c3[0]; y = c3[1]; }
      else { i++; }
    }
    close();
    return rings;
  };

  /* ---------- ring helpers ---------- */
  function ringArea(r) { var a = 0, n = r.length; for (var i = 0; i < n; i++) { var p = r[i], q = r[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function mapRings(rings, f) { return rings.map(function (r) { return r.map(f); }); }
  function rectRing(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  function bboxRings(rings, pad) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    rings.forEach(function (r) { r.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); });
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }

  /* ---------- gathering the objects to cut ---------- */
  /* Frozen outlines are used as they are. Otherwise the font file is needed: an imported one, or one fetched from the
   * internet for this export (memory only, see PTD.fonts.fetchFont). Resolves to {fz} or {fz: null, why}. */
  function ensureOutline(l) {
    var F = PTD.fonts;
    if (l.frozen) return Promise.resolve({ fz: l.frozen });
    var copy = Object.assign({}, l);
    function freeze() { return F.freeze(copy).then(function () { return { fz: copy.frozen }; }, function (e) { return { fz: null, why: "the font could not be turned into outlines (" + (e && e.message || "error") + ")" }; }); }
    if (F.data[l.font]) return freeze();
    if (F.isImported(l.font)) return Promise.resolve({ fz: null, why: "its imported font file is not loaded (use Load font file on the Fonts tab)" });
    return F.fetchFont(l).then(function (got) {
      if (got && got.buf) return freeze();
      return { fz: null, why: got && got.noLib ? "opentype.js could not be loaded, so no outlines can be made" : "the font file of “" + l.font + "” could not be fetched from the internet (" + ((got && got.tried) || 0) + " places tried) and no font file is imported" };
    });
  }
  function textRings(l, fz, O) {
    var rings = X.parsePath(fz.d, 0.05), a = l.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    return mapRings(rings, function (p) { return [O.x + l.x + p[0] * ca - p[1] * sa, O.y + l.y + p[0] * sa + p[1] * ca]; });
  }
  /* Returns a promise of {items, warnings}. Items run from the lowest to the highest. */
  X.gather = function (o) {
    var core = C(), st = core.state(), T = PTD.tables, items = [], warnings = [], jobs = [];
    var stack = [], at = st.band.at, O = core.artOrigin();   /* texts and lines are measured from the artwork origin */
    var selSet = null;
    if (o.sel) { selSet = {}; (o.selIds || selectedIds()).forEach(function (k) { selSet[k] = 1; }); }
    function picked(id) { return !selSet || !!selSet[id]; }
    st.layers.forEach(function (l, i) { if (i === at) stack.push("band"); stack.push(l.id); });
    if (at >= st.layers.length) stack.push("band");
    stack.forEach(function (id, k) {
      if (id === "band") {
        var b = st.band;
        if (b.hidden) return;
        if (b.show) {
          var ow = b.outline ? Math.max(0, b.outlineW) : 0, ys = [O.y + b.y - b.gap / 2 - b.thick / 2, O.y + b.y + b.gap / 2 - b.thick / 2], bx = O.x + b.x;
          ys.forEach(function (yy, li) {
            var show = (li ? o.lower : o.upper) !== false && picked("band");
            items.push({ name: li ? "Lower card line" : "Upper card line", colour: b.color, rings: [rectRing(bx - b.len / 2, yy, bx + b.len / 2, yy + b.thick)], halo: ow, haloRings: ow ? [rectRing(bx - b.len / 2 - ow, yy - ow, bx + b.len / 2 + ow, yy + b.thick + ow)] : null, order: k + 1, ghost: !show, thinMm: b.thick });
          });
        }
        if (PTD.scene && PTD.scene.any(st)) warnings.push("The things lying on the table (pot, burn cards, muck, players, dealer button) are not part of the cut file. They only show in the picture and in Blender.");
        if (st.cards.show && core.parseHand(st.cards.hand).cards.length) warnings.push("The poker hand is not part of the cut file: card faces and symbols are live text. Cut them from a separate design or freeze them yourself.");
        return;
      }
      var l = core.getLayer(id);
      if (!l || l.hidden || !l.text) return;
      var slot = { name: l.text, colour: l.color, rings: null, halo: l.outline && l.outlineW > 0 ? l.outlineW : 0, order: k + 1, layer: l, ghost: !(o.texts !== false && picked(l.id)), textSize: l.size };
      items.push(slot);
      jobs.push(ensureOutline(l).then(function (r) {
        var fz = r.fz;
        if (!fz) { slot.skip = true; if (!slot.ghost) warnings.push("The text “" + l.text + "” is not cut: " + r.why + ". Import the font file on the Fonts tab, or try again when online."); return; }
        slot.rings = textRings(l, fz, O);
        if (!l.frozen && !slot.ghost) warnings.push("The text “" + l.text + "” was turned into outlines for this export only" + (PTD.fonts.data[l.font] ? "." : " from a font file fetched from the internet (kept in memory only)."));
      }));
    });
    /* the player-area line lies above everything else, with its outline cutting a hole in what is below */
    if (o.bet) T.visible().forEach(function (t) {
      var rings = T.betPolygons(t); if (!rings.length) return;
      var ow = t.bet.outline && t.bet.outlineW > 0 ? t.bet.outlineW : 0;
      items.push({ name: t.name + " player-area line", colour: t.bet.color, rings: rings, halo: ow, haloRings: ow ? T.betPolygons(t, ow) : null, order: stack.length + 2, thinMm: t.bet.thick });
    });
    return Promise.all(jobs).then(function () {
      return { items: items.filter(function (it) { return !it.skip && it.rings && it.rings.length; }), warnings: warnings };
    });
  };

  /* ---------- transforms ---------- */
  function makeTransform(items, o, P) {
    P = P || { sx: 1, sy: 1, cfx: o.fx > 0 ? o.fx : 1, cfy: o.fy > 0 ? o.fy : 1 };
    var rot = ((Math.round(o.rotate / 90) % 4) + 4) % 4 * 90, flip = !!o.mirror;
    function base(p) {
      var x = (flip ? -p[0] : p[0]) * P.sx, y = p[1] * P.sy;
      if (rot === 90) return [-y, x];
      if (rot === 180) return [-x, -y];
      if (rot === 270) return [y, -x];
      return [x, y];
    }
    var x0 = Infinity, y0 = Infinity;
    items.forEach(function (it) {
      var rings = it.haloRings || it.rings, pad = it.haloRings ? 0 : it.halo;
      pad *= P.hs || 1;
      rings.forEach(function (r) { r.forEach(function (p) { var q = base(p); x0 = Math.min(x0, q[0] - pad); y0 = Math.min(y0, q[1] - pad); }); });
    });
    if (!isFinite(x0)) { x0 = 0; y0 = 0; }
    return function (p) { var q = base(p); return [(q[0] - x0) * P.cfx, (q[1] - y0) * P.cfy]; };
  }

  /* ---------- Clipper ---------- */
  /* Millimetres become integers of 0.001 mm. Every shape is first cleaned with a non-zero union (overlapping contours of a
   * script font merge, holes get the opposite direction), which the offset needs. */
  var SC = 1000;
  function CL() { return window.ClipperLib; }
  function toPaths(rings) {
    return rings.filter(function (r) { return r.length > 2; }).map(function (r) { return r.map(function (p) { return { X: Math.round(p[0] * SC), Y: Math.round(p[1] * SC) }; }); });
  }
  function fromPaths(paths) { return paths.map(function (pa) { return pa.map(function (pt) { return [pt.X / SC, pt.Y / SC]; }); }); }
  function cleanPaths(paths) { var L = CL(); return L.Clipper.SimplifyPolygons(paths, L.PolyFillType.pftNonZero); }
  function boolOp(type, a, b) {
    var L = CL(), c = new L.Clipper(), sol = new L.Paths();
    c.AddPaths(a, L.PolyType.ptSubject, true); c.AddPaths(b, L.PolyType.ptClip, true);
    c.Execute(type, sol, L.PolyFillType.pftNonZero, L.PolyFillType.pftNonZero);
    return sol;
  }
  function unite(a, b) { return boolOp(CL().ClipType.ctUnion, a, b); }
  function subtract(a, b) { return boolOp(CL().ClipType.ctDifference, a, b); }
  function intersect(a, b) { return boolOp(CL().ClipType.ctIntersection, a, b); }
  /* delta in mm: positive grows the shape (outer rings out, holes in). Round joins make a true round offset. */
  function offsetPaths(paths, delta, round) {
    var L = CL(), co = new L.ClipperOffset(3, 0.002 * SC), sol = new L.Paths();
    co.AddPaths(paths, round ? L.JoinType.jtRound : L.JoinType.jtMiter, L.EndType.etClosedPolygon);
    co.Execute(sol, delta * SC);
    return sol;
  }

  X.ops = { toPaths: toPaths, fromPaths: fromPaths, clean: cleanPaths, unite: unite, subtract: subtract, intersect: intersect, offset: offsetPaths };   /* for the tests */

  /* ---------- scale, calibration and kerf ---------- */
  function selectedIds() {
    var core = C(), ids = [];
    core.state().layers.forEach(function (l) { if (core.isSel(l.id)) ids.push(l.id); });
    if (core.isSel("band")) ids.push("band");
    return ids;
  }
  /* The numbers one export uses: the user's scale (design axes), the correction of the cutter (cutter axes, after rotating
   * and mirroring) times the manual factors, the blade offset, and the cutter. */
  X.params = function (o) {
    var K = PTD.cutters, cut = K.byName(o.cutter) || K.list()[0], eff = K.effective(cut);
    var sx = o.scaleX > 0 ? o.scaleX : 1, sy = o.scaleY > 0 ? o.scaleY : 1;
    var cx = o.useCalib !== false ? eff.fx : 1, cy = o.useCalib !== false ? eff.fy : 1;
    return { sx: sx, sy: sy, hs: (sx + sy) / 2, cfx: cx * (o.fx > 0 ? o.fx : 1), cfy: cy * (o.fy > 0 ? o.fy : 1), calX: cx, calY: cy,
      kerf: o.useKerf !== false ? eff.kerf : 0, cutter: cut };
  };
  /* The size of the whole export set (all colours) at scale 1, in design axes: a promise of {w, h}. */
  X.refBox = function (o) {
    o = Object.assign({}, o || xp());
    return X.gather(o).then(function (g) {
      var T = PTD.tables, region = null, pick = g.items.filter(function (it) { return o.keepPos || !it.ghost; });
      if (o.area !== "all") { var t = T.get(o.area); if (t) { var geo = T.geo(t); region = (geo.wrap.length ? geo.wrap : geo.poly); } }
      if (!pick.length && !region) return { w: 0, h: 0 };
      var rings = region ? [region] : pick.reduce(function (a, it) { return a.concat(it.haloRings || it.rings); }, []), pad = 0;
      if (!region) { var m = 0; pick.forEach(function (it) { if (!it.haloRings) m = Math.max(m, it.halo); }); pad = m; }
      var bb = bboxRings(rings, pad);
      return { w: bb.x1 - bb.x0, h: bb.y1 - bb.y0 };
    });
  };

  /* Offsets closed rings by d mm to compensate the blade: outer rings inward, holes outward (a positive d shrinks the kept
   * pieces; the blade removes that much material). Mitre joins with a limit (3 times the offset); rings that vanish are
   * dropped. The result is sorted by area, the biggest first. */
  X.offsetRings = function (rings, d) {
    if (!d) return rings;
    var out = fromPaths(offsetPaths(cleanPaths(toPaths(rings)), -d, false));
    return out.sort(function (a, b) { return Math.abs(ringArea(b)) - Math.abs(ringArea(a)); });
  };

  /* ---------- the cut pipeline ---------- */
  /* Returns {strips: [{w, h, colours: {paletteId: rings}}], warnings, booleans, P (the numbers used), total: {w, h}}. */
  X.buildCut = function (o) {
    var core = C(), T = PTD.tables, region = null, PR = X.params(o);
    return X.gather(o).then(function (g) {
      var all0 = g.items, warnings = g.warnings.slice();
      if (!all0.some(function (it) { return !it.ghost; })) throw new Error("There is nothing to cut. Freeze the text first, or switch on the lines or the player-area line (and check the filters).");
      if (o.area !== "all") {
        var t = T.get(o.area);
        if (t) { var geo = T.geo(t); region = (geo.wrap.length ? geo.wrap : geo.poly).map(function (p) { return [p[0], p[1]]; }); }
      }
      /* the frame: the design that is output, or with "keep position" the whole design including what is not output */
      var tf = makeTransform(all0.filter(function (it) { return o.keepPos || !it.ghost; }), o, PR);
      var items = all0.map(function (it) {
        return { name: it.name, colour: it.colour, rings: mapRings(it.rings, tf), halo: it.halo * PR.hs, haloRings: it.haloRings ? mapRings(it.haloRings, tf) : null, ghost: it.ghost };
      });
      /* details that are too thin for the cutter after scaling (lines and outline gaps are exact; text is a rough guess) */
      var thin = PR.cutter ? PR.cutter.thinMm : 0, shown = {};
      if (thin > 0) all0.forEach(function (it) {
        if (it.ghost) return;
        if (it.thinMm && it.thinMm * PR.hs < thin - 1e-9) shown["line:" + it.name] = "“" + it.name + "” would be " + (Math.round(it.thinMm * PR.hs * 100) / 100) + " mm thick after scaling, thinner than the thinnest detail of the cutter (" + thin + " mm).";
        if (it.halo && it.halo * PR.hs < thin - 1e-9) shown["halo:" + it.name] = "The outline gap of “" + it.name + "” would be " + (Math.round(it.halo * PR.hs * 100) / 100) + " mm wide after scaling, narrower than the thinnest detail of the cutter (" + thin + " mm).";
        if (it.textSize && it.textSize * PR.hs < 8 * thin) shown["text:" + it.name] = "The text “" + it.name + "” is small after scaling (size " + (Math.round(it.textSize * PR.hs * 10) / 10) + " mm): its fine strokes may be thinner than the cutter can cut (rough guess).";
      });
      Object.keys(shown).forEach(function (k) { warnings.push(shown[k]); });
      var clip = region ? [region.map(tf)] : null;
      var out0 = items.filter(function (it) { return !it.ghost; });
      var all = (o.keepPos ? items : out0).reduce(function (a, it) { return a.concat(it.haloRings || it.rings); }, []);
      var bb = bboxRings(all, 0);
      if (clip) bb = bboxRings(clip, 0);
      var W = bb.x1 - bb.x0, H = bb.y1 - bb.y0, strips = [];
      var stripW = o.stripW > 0 ? o.stripW : 0, ov = Math.max(0, Math.min(o.stripOverlap || 0, stripW / 2));
      var bands = [];
      if (stripW > 0 && W > stripW) {
        var pitch = stripW - ov, n = Math.ceil((W - ov) / pitch);
        for (var k = 0; k < n; k++) bands.push({ x0: bb.x0 + k * pitch, x1: Math.min(bb.x1, bb.x0 + k * pitch + stripW) });
      } else bands.push({ x0: bb.x0, x1: bb.x1 });
      var colours = {}, minArea = o.tol * o.tol, cover = null, vis = [];
      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i], shape = cleanPaths(toPaths(it.rings)), ko = null;
        if (it.halo > 0) ko = it.haloRings ? cleanPaths(toPaths(it.haloRings)) : offsetPaths(shape, it.halo, true);
        else if (o.overlap) ko = shape;
        if (!it.ghost) vis.push({ it: it, shape: cover ? subtract(shape, cover) : shape });   /* what is not output still knocks holes */
        if (ko) cover = cover ? unite(cover, ko) : ko;
      }
      vis.forEach(function (v) { colours[v.it.colour] = colours[v.it.colour] ? unite(colours[v.it.colour], v.shape) : v.shape; });
      if (clip) Object.keys(colours).forEach(function (c) { colours[c] = intersect(colours[c], cleanPaths(toPaths(clip))); });
      if (PR.kerf) Object.keys(colours).forEach(function (c) { colours[c] = offsetPaths(colours[c], -PR.kerf, false); });
      bands.forEach(function (bd) {
        var out = {}, rect = toPaths([rectRing(bd.x0, bb.y0, bd.x1, bb.y1)]);
        Object.keys(colours).forEach(function (c) {
          var piece = bands.length > 1 ? intersect(colours[c], rect) : colours[c];
          var rings = fromPaths(piece).filter(function (r) { return Math.abs(ringArea(r)) >= minArea; }).map(function (ring) { return ring.map(function (p) { return [p[0] - bd.x0, p[1] - bb.y0]; }); });
          if (rings.length) out[c] = rings;
        });
        strips.push({ w: bd.x1 - bd.x0, h: H, colours: out });
      });
      var tw = 0, th = 0; strips.forEach(function (s) { tw = Math.max(tw, s.w); th += s.h; }); th += 30 * (strips.length - 1);
      var cut = PR.cutter;
      if (cut && cut.widthMm > 0 && tw > cut.widthMm + 0.01) warnings.push("The output is " + Math.round(tw * 10) / 10 + " mm wide, wider than the cutting width of " + esc2(cut.name) + " (" + cut.widthMm + " mm). Use strips, scale it down (Fit to roll width) or turn it.");
      if (cut && cut.maxLengthMm > 0 && th > cut.maxLengthMm + 0.01) warnings.push("The output is " + Math.round(th) + " mm long, longer than the longest cut of " + esc2(cut.name) + " (" + cut.maxLengthMm + " mm).");
      if (PR.kerf) warnings.push("Blade offset " + (Math.round(PR.kerf * 1000) / 1000) + " mm per edge was applied to the outlines (approximate near sharp corners).");
      return { strips: strips, warnings: warnings, booleans: true, P: PR, total: { w: tw, h: th } };
    });
  };
  function esc2(s) { return "“" + s + "”"; }

  function ringsToPaths(rings, hex) {
    var groups = {}, order = [];
    rings.forEach(function (r) { var k = r.g === undefined ? "p" : r.g; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(r); });
    return order.map(function (k) { return '<path d="' + ringsToD(groups[k]) + '" fill="' + hex + '" fill-rule="nonzero"/>'; }).join("");
  }
  function ringsToD(rings) {
    return rings.map(function (r) { return "M" + r.map(function (p) { return num3(p[0]) + " " + num3(p[1]); }).join("L") + "Z"; }).join("");
  }
  function safeId(s) { return String(s).replace(/[^A-Za-z0-9_-]+/g, "_"); }
  /* Strips are stacked top to bottom, as they would run along the roll. */
  X.cutSVG = function (res, only) {
    var core = C(), pal = core.state().palette, gap = 30, W = 0, H = 0, body = [];
    res.strips.forEach(function (s) { W = Math.max(W, s.w); });
    var y = 0;
    res.strips.forEach(function (s, i) {
      var groups = [];
      pal.forEach(function (c) {
        if (only && only !== c.id) return;
        var rings = s.colours[c.id];
        if (!rings) return;
        groups.push('<g id="' + safeId(c.name) + (res.strips.length > 1 ? "_strip" + (i + 1) : "") + '" data-colour="' + c.hex + '">' + ringsToPaths(rings, c.hex) + '</g>');
      });
      if (res.strips.length > 1) body.push('<!-- strip ' + (i + 1) + ' of ' + res.strips.length + ' -->');
      body.push('<g transform="translate(0 ' + num3(y) + ')">' + groups.join("") + '</g>');
      y += s.h + gap;
    });
    H = y - gap;
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + num3(W) + 'mm" height="' + num3(H) + 'mm" viewBox="0 0 ' + num3(W) + " " + num3(H) + '">\n' + body.join("\n") + '\n</svg>\n';
  };
  /* One EPS text per colour. All of them use the same frame (the whole output), so the colours register when laid on each other. */
  X.cutEPS = function (res, only) {
    var core = C(), pal = core.state().palette, gap = 30, out = [], warnings = [];
    pal.forEach(function (c) {
      if (only && only !== c.id) return;
      var paths = [], y = 0;
      res.strips.forEach(function (s) {
        (s.colours[c.id] || []).forEach(function (r) { paths.push({ pts: r.map(function (p) { return [p[0], p[1] + y]; }), closed: true }); });
        y += s.h + gap;
      });
      if (!paths.length) return;
      var e = PTD.eps.build(paths, { origin: { x: 0, y: res.total.h } });
      e.warnings.forEach(function (w) { if (warnings.indexOf(w) < 0) warnings.push(w); });
      out.push({ colour: c, text: e.text });
    });
    return { files: out, warnings: warnings };
  };
  function scaleSuffix(o) {
    var sx = o.scaleX > 0 ? o.scaleX : 1, sy = o.scaleY > 0 ? o.scaleY : 1, p = function (v) { return String(Math.round(v * 1000) / 10); };
    if (sx === 1 && sy === 1) return "";
    return sx === sy ? "-" + p(sx) + "pct" : "-x" + p(sx) + "pct-y" + p(sy) + "pct";
  }
  /* only: one colour id or ""; over: settings that replace the project's export settings (a named job). */
  X.cutExport = function (only, over) {
    if (busy) return;
    busy = true; msg("Preparing the cut file…");
    var o = Object.assign({}, xp(), over || {}), core = C();
    X.buildCut(o).then(function (res) {
      var base = core.slug(core.state().name), sfx = scaleSuffix(o), pal = core.state().palette, note = "";
      var colours = {}; res.strips.forEach(function (s) { Object.keys(s.colours).forEach(function (c) { colours[c] = 1; }); });
      var tail = (res.booleans ? "" : " Overlaps were not resolved.");
      if (o.format === "eps") {
        var e = X.cutEPS(res, only), files = e.files.map(function (f) { return { name: base + "-" + core.slug(f.colour.name) + sfx + ".eps", data: new TextEncoder().encode(f.text) }; });
        if (!files.length) throw new Error("There is nothing to cut in that colour.");
        if (files.length === 1) core.download(files[0].name, new Blob([e.files[0].text], { type: "application/postscript" }), "application/postscript");
        else core.download(base + "-cut-eps" + sfx + ".zip", PTD.calibration.zip(files), "application/zip");
        note = " EPS: " + files.length + " file(s), one per colour, all with the same frame." + (e.warnings.length ? " " + e.warnings.join(" ") : "");
      } else {
        var svg = X.cutSVG(res, only);
        core.download(base + (only ? "-" + core.slug((pal.filter(function (c) { return c.id === only; })[0] || {}).name) : "-cut") + sfx + ".svg", svg, "image/svg+xml");
      }
      var notCut = res.warnings.filter(function (w) { return /is not cut:/.test(w); }); res.warnings = notCut.concat(res.warnings.filter(function (w) { return notCut.indexOf(w) < 0; }));
      var bad = notCut.length ? "⚠ NOT EVERYTHING WAS CUT. " : "";
      msg(bad + "Cut file saved: " + res.strips.length + (res.strips.length === 1 ? " piece, " : " strips, ") + Object.keys(colours).length + " colour layer(s), " + Math.round(res.total.w * 10) / 10 + " × " + Math.round(res.total.h * 10) / 10 + " mm." + tail + note + (res.warnings.length ? " " + res.warnings.join(" ") : ""));
      var em = document.getElementById("exportMsg"); if (em) em.classList.toggle("bad", !!notCut.length);
    }).catch(function (e) { msg(e.message || String(e)); }).then(function () { busy = false; });
  };

  /* ---------- fonts for the picture export ---------- */
  function b64(buf) {
    var bytes = new Uint8Array(buf), s = "", ch = 0x8000;
    for (var i = 0; i < bytes.length; i += ch) s += String.fromCharCode.apply(null, bytes.subarray(i, i + ch));
    return btoa(s);
  }
  function fontCSS(families) {
    var F = PTD.fonts, css = [], fails = [];
    return Promise.all(families.map(function (fam) {
      var d = F.data[fam];
      if (d) {
        var fmt = /\.otf$/i.test(d.fileName || "") ? "opentype" : "truetype";
        css.push('@font-face{font-family:"' + fam + '";src:url(data:font/' + (fmt === "opentype" ? "otf" : "ttf") + ";base64," + b64(d.buf) + ') format("' + fmt + '");}');
        return null;
      }
      var url = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(fam).replace(/%20/g, "+") + "&display=swap";
      return fetch(url).then(function (r) { if (!r.ok) throw new Error("css"); return r.text(); }).then(function (text) {
        var urls = text.match(/url\((https:[^)]+)\)/g) || [];
        return Promise.all(urls.map(function (u) {
          var real = u.slice(4, -1);
          return fetch(real).then(function (r) { return r.arrayBuffer(); }).then(function (buf) { text = text.split(u).join("url(data:font/woff2;base64," + b64(buf) + ")"); });
        })).then(function () { css.push(text); });
      }).catch(function () { fails.push(fam); });
    })).then(function () { return { css: css.join("\n"), fails: fails }; });
  };

  /* A standalone SVG picture of the artwork over the cloth colour, for the region given in mm. */
  X.artSVG = function (region, pxmm, withObjects) {
    var core = C(), st = core.state(), flat = core.cfg().preview === "flat";
    var NS = "http://www.w3.org/2000/svg", w = region.x1 - region.x0, h = region.y1 - region.y0;
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("xmlns", NS); svg.setAttribute("viewBox", region.x0 + " " + region.y0 + " " + w + " " + h);
    svg.setAttribute("width", Math.max(1, Math.round(w * pxmm))); svg.setAttribute("height", Math.max(1, Math.round(h * pxmm)));
    var defs = core.el("defs", {}, svg);
    core.makeGradients(defs, flat);
    core.el("rect", { x: region.x0, y: region.y0, width: w, height: h, fill: core.colorHex(st.cloth.color) }, svg);
    var g = core.el("g", {}, svg);
    core.drawArtwork(g, flat);
    PTD.tables.renderArt(g, { z: 1 });
    core.drawObjects(g, !withObjects);   /* the hand always, the other table objects only with withObjects */
    var fams = {};
    st.layers.forEach(function (l) { if (!l.hidden && !l.frozen) fams[l.font] = true; });
    return fontCSS(Object.keys(fams)).then(function (f) {
      if (f.css) { var style = core.el("style", {}, svg); style.textContent = f.css; svg.insertBefore(style, svg.firstChild); }
      return { text: new XMLSerializer().serializeToString(svg), w: Math.round(w * pxmm), h: Math.round(h * pxmm), fails: f.fails };
    });
  };
  X.rasterize = function (svgText, w, h) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
      img.onload = function () {
        var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url); resolve(cv);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("The browser could not draw the picture.")); };
      img.src = url;
    });
  };
  function canvasBlob(cv) { return new Promise(function (res) { cv.toBlob(res, "image/png"); }); }
  function exportRegion(o) {
    var T = PTD.tables, st = C().state();
    if (o.area !== "all" && T.get(o.area)) { var b = T.geo(T.get(o.area)); var bb = G.bbox(b.wrap.length ? b.wrap : b.poly); return { x0: bb.x0, y0: bb.y0, x1: bb.x1, y1: bb.y1 }; }
    var bb2 = T.bboxAll();
    if (st.cloth.real) return { x0: st.cloth.x - st.cloth.w / 2, y0: st.cloth.y - st.cloth.h / 2, x1: st.cloth.x + st.cloth.w / 2, y1: st.cloth.y + st.cloth.h / 2 };
    return bb2 || { x0: -1500, y0: -1000, x1: 1500, y1: 1000 };
  }
  X.pngExport = function () {
    if (busy) return;
    busy = true; msg("Drawing the picture…");
    var o = xp(), region = exportRegion(o), px = Math.max(0.02, Math.min(8, o.pxmm || 0.5));
    var maxSide = 16000;
    if ((region.x1 - region.x0) * px > maxSide || (region.y1 - region.y0) * px > maxSide) px = maxSide / Math.max(region.x1 - region.x0, region.y1 - region.y0);
    X.artSVG(region, px, o.picObjects !== false).then(function (a) {
      return X.rasterize(a.text, a.w, a.h).then(canvasBlob).then(function (blob) {
        var core = C();
        core.download(core.slug(core.state().name) + ".png", blob, "image/png");
        msg("Picture saved (" + a.w + " × " + a.h + " px)." + (a.fails.length ? " The font " + a.fails.join(", ") + " could not be embedded, so a fallback font was used." : ""));
      });
    }).catch(function (e) { msg(e.message || String(e)); }).then(function () { busy = false; });
  };

  /* ---------- Blender ---------- */
  function lin(c) { c = c / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function linHex(hex) { var h = hex.replace("#", ""); return [0, 2, 4].map(function (i) { return Math.round(lin(parseInt(h.substr(i, 2), 16)) * 10000) / 10000; }); }
  var PROFILES = {
    preview: { name: "preview", engine: "EEVEE", resolution: [1280, 720], samples: 64, bounces: 4, volume_fog: 0, spot_beam: 1, output_name: "_preview.png" },
    final: { name: "final", engine: "CYCLES", resolution: [1920, 1080], samples: 1024, bounces: 12, volume_fog: 1, spot_beam: 1, output_name: "_final.png" }
  };
  function pyValue(v) {
    if (Array.isArray(v)) return "(" + v.map(pyValue).join(", ") + (v.length === 1 ? "," : "") + ")";
    if (typeof v === "string") return JSON.stringify(v);
    return String(v);
  }
  function pyDict(o) { return "{" + Object.keys(o).map(function (k) { return JSON.stringify(k) + ": " + pyValue(o[k]); }).join(", ") + "}"; }

  /* The things lying on the table (chips, cards, dealer button) as data for Blender: metres, Blender axes, table centred.
   * Tops are small PNG pictures drawn here, so the 3D objects look like the ones on the stage. */
  function thingsData(t, cx, cy, railPoly) {
    var core = C(), sc = PTD.scene;
    if (!sc || !sc.any(core.state())) return null;
    var scene = sc.build(core.state()), hex = core.colorHex, out = { chips: [], cards: [], buttons: [] };
    var inside = scene.objs.filter(function (o) { return G.pointInPolygon([o.x, o.y], railPoly); });
    var used = {};
    inside.forEach(function (o) {
      var X = Math.round((o.x - cx) * 10) / 10000, Y = Math.round(-(o.y - cy) * 10) / 10000, Z = Math.round(o.z * 100) / 100000;
      if (o.k === "chip") { used[o.c] = true; out.chips.push([X, Y, Z, o.c, -Math.round(o.rot)]); }
      else if (o.k === "card") out.cards.push([X, Y, Z, -Math.round(o.rot * 10) / 10]);
      else out.buttons.push([X, Y, Z, -Math.round(o.rot * 10) / 10]);
    });
    if (!inside.length) return null;
    var ids = sc.CHIP_COLOURS.filter(function (c) { return used[c]; });
    out.chips = out.chips.map(function (c) { c[3] = ids.indexOf(c[3]); return c; });
    function canvas(w, h) { var cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv; }
    function b64(cv) { return cv.toDataURL("image/png").split(",")[1]; }
    out.colours = ids.map(function (id) {
      var cv = canvas(128, 128), g = cv.getContext("2d"), mark = hex(id === "ivory" ? "black" : "ivory"), r = 64, rim = r * 0.8, circ = 2 * Math.PI * rim;
      g.fillStyle = hex(id); g.fillRect(0, 0, 128, 128);
      g.strokeStyle = mark; g.lineWidth = r * 0.26; g.setLineDash([circ / 16, circ / 16]); g.beginPath(); g.arc(64, 64, rim, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]); g.lineWidth = 3; g.beginPath(); g.arc(64, 64, r * 0.5, 0, Math.PI * 2); g.stroke();
      return { id: id, rgb: linHex(hex(id)), tex: b64(cv) };
    });
    var cw = scene.card.w, ch = scene.card.h, W = Math.round(cw * 5), H = Math.round(ch * 5), cv2 = canvas(W, H), g2 = cv2.getContext("2d");
    g2.fillStyle = hex("red"); g2.fillRect(0, 0, W, H);
    g2.strokeStyle = hex("ivory"); g2.lineWidth = Math.max(2, H * 0.014);
    g2.strokeRect(W * 0.1, H * 0.07, W * 0.8, H * 0.86);
    var dr = W * 0.2; g2.beginPath(); g2.moveTo(W / 2, H / 2 - dr * 1.4); g2.lineTo(W / 2 + dr, H / 2); g2.lineTo(W / 2, H / 2 + dr * 1.4); g2.lineTo(W / 2 - dr, H / 2); g2.closePath(); g2.stroke();
    out.card_tex = b64(cv2);
    var cv3 = canvas(256, 256), g3 = cv3.getContext("2d");
    g3.fillStyle = "#f6f3ea"; g3.fillRect(0, 0, 256, 256);
    g3.strokeStyle = hex("black"); g3.lineWidth = 4; g3.beginPath(); g3.arc(128, 128, 110, 0, Math.PI * 2); g3.stroke();
    g3.fillStyle = hex("black"); g3.font = "700 44px 'Josefin Sans', 'Segoe UI', Arial, sans-serif"; g3.textAlign = "center"; g3.textBaseline = "middle"; g3.fillText("DEALER", 128, 130);
    out.btn_tex = b64(cv3);
    out.chip_r = scene.chip.dia / 2000; out.chip_th = scene.chip.thick / 1000;
    out.card_w = cw / 1000; out.card_h = ch / 1000; out.card_th = sc.CARD_THICK / 1000;
    out.btn_r = sc.BUTTON.r / 1000; out.btn_th = sc.BUTTON.th / 1000;
    return out;
  }

  /* Builds the project data of the Blender script (metres, Blender axes, table centred). */
  X.blenderProject = function (t, texture) {
    var core = C(), T = PTD.tables, geo = T.geo(t), o = xp();
    var bb = G.bbox(geo.poly), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    var rail = geo.rail;
    if (!rail.length) rail = G.transformPoints(G.offsetPolygon(geo.local, 1, 0.25), t.x, t.y, t.rot);
    function conv(pts) { return pts.map(function (p) { return [Math.round((p[0] - cx)) / 1000, Math.round(-(p[1] - cy)) / 1000]; }); }
    function conv5(pts) { return pts.map(function (p) { return [Math.round((p[0] - cx) * 10) / 10000, Math.round(-(p[1] - cy) * 10) / 10000]; }); }
    var outline = conv5(geo.poly), outer = conv5(rail);
    return {
      name: t.name, outline: outline, rail_outer: outer, rail_tris: G.zipper(rail, geo.poly),
      texture: texture || "", tex_bounds: [(bb.x0 - cx) / 1000, -(bb.y1 - cy) / 1000, (bb.x1 - cx) / 1000, -(bb.y0 - cy) / 1000],
      rail_color: linHex(t.railColor || "#6b4a2b"), felt_color: linHex(core.colorHex(core.state().cloth.color)),
      things: thingsData(t, cx, cy, rail)
    };
  };
  X.blenderScript = function (kind, t, texture) {
    var core = C(), o = xp(), profile = Object.assign({}, PROFILES[kind]);
    profile.output_name = core.slug(core.state().name) + profile.output_name;
    var data = JSON.stringify(X.blenderProject(t, texture)).replace(/'''/g, "");
    var py = PTD.blenderTemplate;
    py = py.replace("\nPROFILE = {}\n", function () { return "\nPROFILE = " + pyDict(profile) + "\n"; });
    py = py.replace("\nPROJECT = {}\n", function () { return "\nPROJECT = json.loads(r'''" + data + "''')\n"; });
    py = py.replace(/^TABLE_HEIGHT = [0-9.]+/m, "TABLE_HEIGHT = " + (Math.max(300, o.bTableH || 740) / 1000));
    py = py.replace(/^RAIL_HEIGHT = [0-9.]+/m, "RAIL_HEIGHT = " + (Math.max(5, o.bRailH || 50) / 1000));
    return py;
  };
  /* Renders the cloth texture and collects the table for the Blender export and its preview. */
  X.blenderParts = function () {
    var T = PTD.tables, o = xp(), t = T.get(o.bTable) || T.visible()[0];
    if (!t) return Promise.reject(new Error("There is no visible table to export."));
    var geo = T.geo(t), bb = G.bbox(geo.poly), side = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
    var tex = Math.max(512, Math.min(8192, o.bTex || 4096)), px = tex / side;
    return X.artSVG({ x0: bb.x0, y0: bb.y0, x1: bb.x1, y1: bb.y1 }, px).then(function (a) {
      return X.rasterize(a.text, a.w, a.h).then(function (cv) {
        return { t: t, a: a, cv: cv, tex: cv.toDataURL("image/png").split(",")[1] };
      });
    });
  };
  function fontNote(a) { return a.fails.length ? " The font " + a.fails.join(", ") + " could not be embedded in the texture, so a fallback font was used." : ""; }
  X.blenderExport = function (kind) {
    if (busy) return;
    var core = C();
    busy = true; msg("Building the Blender script…");
    X.blenderParts().then(function (r) {
      var py = X.blenderScript(kind, r.t, r.tex);
      core.download(core.slug(core.state().name) + "-blender-" + kind + ".py", py, "text/x-python");
      msg("Blender script saved (" + kind + "). Open it in Blender's Scripting workspace and press Run Script. The Blender console prints a line starting with PTD: that names the table it built." + fontNote(r.a));
    }).catch(function (e) { msg(e.message || String(e)); }).then(function () { busy = false; });
  };
  function blobOfBase64(b64, type) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type });
  }
  /* A top-down picture of what the Blender script will build: rail, cloth outline and the texture on it. */
  X.blenderPreview = function () {
    if (busy) return;
    var core = C(), o = xp();
    busy = true; msg("Drawing the Blender table preview…");
    X.blenderParts().then(function (r) {
      var data = X.blenderProject(r.t, ""), outer = data.rail_outer, inner = data.outline, tb = data.tex_bounds;
      var ox0 = Infinity, oy0 = Infinity, ox1 = -Infinity, oy1 = -Infinity;
      outer.forEach(function (p) { ox0 = Math.min(ox0, p[0]); oy0 = Math.min(oy0, p[1]); ox1 = Math.max(ox1, p[0]); oy1 = Math.max(oy1, p[1]); });
      var pad = 0.05, W = 1000, sc = (W - 2 * 20) / (ox1 - ox0 + 2 * pad), H = Math.round((oy1 - oy0 + 2 * pad) * sc + 40);
      var cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.style.cssText = "width:100%;height:auto;background:#1a1410;border:1px solid #888";
      var c = cv.getContext("2d");
      function X0(x) { return 20 + (x - ox0 + pad) * sc; }
      function Y0(y) { return 20 + (oy1 - y + pad) * sc; }
      function trace(poly) { c.beginPath(); poly.forEach(function (p, i) { if (i) c.lineTo(X0(p[0]), Y0(p[1])); else c.moveTo(X0(p[0]), Y0(p[1])); }); c.closePath(); }
      trace(outer); c.fillStyle = r.t.railColor || "#6b4a2b"; c.fill();
      trace(inner); c.save(); c.clip();
      c.drawImage(r.cv, X0(tb[0]), Y0(tb[3]), (tb[2] - tb[0]) * sc, (tb[3] - tb[1]) * sc);
      c.restore();
      trace(inner); c.strokeStyle = "rgba(0,0,0,0.6)"; c.lineWidth = 2; c.stroke();
      var iw = Math.max.apply(null, inner.map(function (p) { return p[0]; })) - Math.min.apply(null, inner.map(function (p) { return p[0]; }));
      var ih = Math.max.apply(null, inner.map(function (p) { return p[1]; })) - Math.min.apply(null, inner.map(function (p) { return p[1]; }));
      var note = document.createElement("p");
      note.style.cssText = "margin:8px 0 0;font-size:0.85rem;color:#222";
      note.textContent = r.t.name + ": cloth " + iw.toFixed(2) + " × " + ih.toFixed(2) + " m, " + inner.length + " outline points, rail " + (core.fmtLen ? core.fmtLen(r.t.railW) : r.t.railW + " mm") + " wide, table height " + ((o.bTableH || 740) / 1000).toFixed(2) + " m, texture " + r.a.w + " × " + r.a.h + " px." + fontNote(r.a) + " Blender draws the same shape and texture in 3D, lit in a casino room.";
      var box = document.createElement("div"); box.appendChild(cv); box.appendChild(note);
      var modal = document.getElementById("modal"), bar = document.getElementById("modalBar"), body = document.getElementById("modalBody");
      bar.innerHTML = '<button class="btn" type="button" data-px="script">Download Blender script (preview)</button><button class="btn" type="button" data-px="tex">Download texture (PNG)</button><button class="btn" type="button" data-sheet="close">Close</button>';
      body.innerHTML = ""; body.appendChild(box);
      bar.querySelector('[data-px="script"]').onclick = function () {
        core.download(core.slug(core.state().name) + "-blender-preview.py", X.blenderScript("preview", r.t, r.tex), "text/x-python");
      };
      bar.querySelector('[data-px="tex"]').onclick = function () {
        core.download(core.slug(core.state().name) + "-cloth-texture.png", blobOfBase64(r.tex, "image/png"), "image/png");
      };
      modal.hidden = false;
      msg("");
    }).catch(function (e) { msg(e.message || String(e)); }).then(function () { busy = false; });
  };

  /* ---------- panel ---------- */
  function jobText(j) {
    var p = [];
    if (j.texts !== false) p.push("texts"); if (j.upper !== false) p.push("upper line"); if (j.lower !== false) p.push("lower line"); if (j.bet) p.push("player-area line");
    return " " + (p.join(", ") || "nothing") + (j.sel ? ", selection" : "") + (j.keepPos ? ", keeps position" : "");
  }
  function scaleRow(ax, label) {
    var m = ax === "x" ? "Width (mm)" : "Height (mm)";
    return '<label class="fld"><span>Factor ' + label + '</span><input type="number" step="0.001" data-xs="' + ax + ':factor" aria-label="Scale factor ' + ax.toUpperCase() + '"></label>' +
      '<label class="fld"><span>Percent</span><input type="number" step="0.1" data-xs="' + ax + ':percent" aria-label="Scale percent ' + ax.toUpperCase() + '"></label>' +
      '<label class="fld"><span>' + m + '</span><input type="number" step="0.1" data-xs="' + ax + ':mm" aria-label="' + m + ' of the output"></label>';
  }
  X.panelHTML = function () {
    var core = C(), st = core.state(), h = core.h, esc = core.esc, o = st.export;
    var areaOpts = '<option value="all">Everything (whole design)</option>' + st.tables.map(function (t) { return '<option value="' + t.id + '">Only inside ' + esc(t.name) + ' (with wrap allowance)</option>'; }).join("");
    var tableOpts = st.tables.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + '</option>'; }).join("");
    var used = {};
    st.layers.forEach(function (l) { if (!l.hidden) used[l.color] = 1; });
    if (st.band.show && !st.band.hidden) used[st.band.color] = 1;
    st.tables.forEach(function (t) { if (t.visible && t.bet.on) used[t.bet.color] = 1; });
    var layerBtns = st.palette.filter(function (c) { return used[c.id]; }).map(function (c) {
      return '<button class="btn" type="button" data-act="cutsvg" data-col="' + c.id + '"><span class="swatch" style="background:' + c.hex + ';margin-right:6px"></span>' + esc(c.name) + '</button>';
    }).join("");
    var cutOpts = '<option value="">First cutter (' + esc((PTD.cutters.list()[0] || {}).name) + ')</option>' + PTD.cutters.list().map(function (c) { return '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>'; }).join("");
    var wantCut = (xp() || {}).cutter;
    if (wantCut && !PTD.cutters.byName(wantCut)) cutOpts += '<option value="' + esc(wantCut) + '">' + esc(wantCut) + ' (not in the list: the first cutter is used)</option>';
    var jobs = (o.jobs || []).map(function (j) {
      return '<div class="cutrow' + (j.done ? " done" : "") + '"><span class="ttl">' + (j.done ? "✓ " : "") + esc(j.name) + '</span><span class="small">' + esc(jobText(j)) + '</span>' +
        '<button type="button" class="tbtn" data-act="jobuse" data-id="' + j.id + '" title="Load these filters into the export settings" aria-label="Use job ' + esc(j.name) + '">Use</button>' +
        '<button type="button" class="tbtn" data-act="jobexp" data-id="' + j.id + '" title="Export this job now" aria-label="Export job ' + esc(j.name) + '">Export</button>' +
        '<button type="button" class="tbtn" data-act="jobdone" data-id="' + j.id + '" title="Mark this job as cut (or not)" aria-label="Done ' + esc(j.name) + '">' + (j.done ? "Undo done" : "Done") + '</button>' +
        '<button type="button" class="tbtn" data-act="jobdel" data-id="' + j.id + '" title="Delete this job" aria-label="Delete job ' + esc(j.name) + '">✕</button></div>';
    }).join("");
    return '<h3 class="sec">Layout sheet</h3><p class="small">A large-print marking guide: centre cross, outline points, guide lines and check diagonals, all measured from the centre.</p>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="sheetview">Open the sheet</button><button class="btn" type="button" data-act="sheethtml">Download HTML</button><button class="btn" type="button" data-act="sheetsvg">Download drawing (SVG)</button></div>' +
      '<h3 class="sec">Cut file (vinyl cutter)</h3>' +
      '<p class="small">Closed polygons in millimetres, one layer (SVG) or one file (EPS, in a zip) per palette colour. Upper objects hide what is below them. Text must have outlines: freeze it on the Artwork tab, or import its font file and it is outlined here automatically. Things you leave out below still knock holes in the others.</p>' +
      '<div class="row2"><label class="fld"><span>Cutter</span><select data-scope="xp" data-key="cutter">' + cutOpts + '</select></label>' +
      '<label class="fld"><span>File format</span><select data-scope="xp" data-key="format"><option value="svg">SVG (one file, layers)</option><option value="eps">EPS for Roland CutStudio (one file per colour)</option></select></label></div>' +
      '<label class="fld"><span>What to export</span><select data-scope="xp" data-key="area">' + areaOpts + '</select></label>' +
      '<div class="checks">' + h.chk("Mirror (for the back of heat-transfer vinyl)", "xp", "mirror") + h.chk("Hide overlapped parts", "xp", "overlap") + h.chk("Include the player-area line", "xp", "bet") + '</div>' +
      '<p class="small">Filters (what is output):</p><div class="checks">' + h.chk("Texts", "xp", "texts") + h.chk("Upper card line", "xp", "upper") + h.chk("Lower card line", "xp", "lower") + h.chk("Only the selected elements (texts and the card lines)", "xp", "sel") + h.chk("Keep the position (the whole design shares one origin)", "xp", "keepPos") + '</div>' +
      '<div class="checks">' + h.chk("Use the calibration correction of the cutter", "xp", "useCalib") + h.chk("Apply the blade offset (kerf) of the cutter", "xp", "useKerf") + '</div>' +
      '<div class="row3"><label class="fld"><span>Rotate</span><select data-scope="xp" data-key="rotate" data-num="1"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>' +
      h.numField("Extra correction X", "xp", "fx", "0.0001") + h.numField("Extra correction Y", "xp", "fy", "0.0001") + '</div>' +
      '<div class="row3">' + h.numField("Tolerance (mm)", "xp", "tol", "0.005") + h.len("Strip width (0 = none)", "xp", "stripW") + h.len("Strip overlap", "xp", "stripOverlap") + '</div>' +
      '<p class="small">The calibration correction comes from the Cutters window (X across the roll, Y along it, after rotating and mirroring). The extra factors multiply it, for example 1.002 for a one-off. Strips split the design into pieces no wider than the strip width, stacked in one file along the roll.</p>' +
      '<h3 class="sec">Size of the cut</h3><p class="small">Scales the whole cut (all colours alike). It is kept in the project. The picture, layout sheet, Blender and the measurements are not scaled.</p>' +
      '<div class="checks">' + h.chk("Lock the aspect ratio (Y follows X)", "xp", "scaleLock") + '</div>' +
      '<div class="row3">' + scaleRow("x", "X (width)") + '</div><div class="row3">' + scaleRow("y", "Y (height)") + '</div>' +
      '<div class="btnrow"><button class="btn" type="button" data-act="xfitroll">Fit to roll width</button><button class="btn" type="button" data-act="xfitpress">Fit to the heat press</button><button class="btn" type="button" data-act="xscale1">Back to 100 %</button></div>' +
      '<p class="small" data-xi="info">Measuring the design…</p>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="cutsvg" data-col="">Download cut file (all colours)</button></div>' +
      (layerBtns ? '<p class="small">One colour only:</p><div class="btnrow">' + layerBtns + '</div>' : '') +
      '<h3 class="sec">Jobs</h3><p class="small">A job is a named set of filters (and the selection) for cutting a part of the design, for example the texts alone. Export runs it with the current size and cutter settings; Done marks it as cut.</p>' +
      '<div class="row2"><label class="fld"><span>Job name</span><input type="text" data-scope="xp" data-key="jobName" autocomplete="off"></label><div class="btnrow"><button class="btn" type="button" data-act="jobsave">Save the filters as a job</button></div></div>' +
      jobs +
      '<h3 class="sec">Picture (PNG)</h3><div class="row2">' + h.numField("Pixels per mm", "xp", "pxmm", "0.05") + '<label class="fld"><span>Area</span><select data-scope="xp" data-key="area">' + areaOpts + '</select></label></div>' +
      '<div class="checks">' + h.chk("Include the things on the table (cards, chips, players, dealer button)", "xp", "picObjects") + '</div>' +
      '<div class="btnrow"><button class="btn" type="button" data-act="pngexport">Download PNG</button></div>' +
      '<h3 class="sec">Blender scene</h3><p class="small">A Python script that builds the table of this project in a casino room: the outline with its arcs and dealer notch, the rail, and the cloth with all texts, lines, the poker hand and the player-area line printed on it as a texture. The things lying on the table (pot, burn cards, muck, players with their cards and chip stacks, the dealer button) become real 3D objects. Use Preview to see the shape and texture before opening Blender. Preview uses EEVEE and takes seconds; final uses Cycles with haze and takes minutes.</p>' +
      '<div class="row3"><label class="fld"><span>Table</span><select data-scope="xp" data-key="bTable"><option value="">First visible</option>' + tableOpts + '</select></label>' + h.len("Table height", "xp", "bTableH") + h.len("Rail height", "xp", "bRailH") + '</div>' +
      '<div class="row2">' + h.numField("Texture size (px, long side)", "xp", "bTex", "256") + '<div></div></div>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="blenderpreview">Preview the Blender table</button><button class="btn" type="button" data-act="blender" data-kind="preview">Download Blender script (preview)</button><button class="btn" type="button" data-act="blender" data-kind="final">Download Blender script (final)</button></div>' +
      '<div class="msg" id="exportMsg" aria-live="polite"></div>';
  };
  /* ---------- scale fields, jobs and the size line ---------- */
  var ref = null;   /* {w, h} of the whole export set at scale 1, or null while unknown */
  X.norm = function (e) {
    var pos = function (v, d) { v = Number(v); return isFinite(v) && v > 0.001 && v < 1000 ? v : d; };
    e.scaleX = pos(e.scaleX, 1); e.scaleY = pos(e.scaleY, 1);
    ["scaleLock", "useCalib", "useKerf", "texts", "upper", "lower"].forEach(function (k) { e[k] = e[k] !== false; });
    e.sel = !!e.sel; e.keepPos = !!e.keepPos; e.format = e.format === "eps" ? "eps" : "svg"; e.cutter = String(e.cutter || ""); e.jobName = String(e.jobName || "");
    e.jobs = (Array.isArray(e.jobs) ? e.jobs : []).filter(function (j) { return j && typeof j === "object"; }).map(function (j, i) {
      return { id: String(j.id || "j" + (i + 1)), name: String(j.name || "Job " + (i + 1)), texts: j.texts !== false, upper: j.upper !== false, lower: j.lower !== false, bet: !!j.bet, sel: !!j.sel, keepPos: !!j.keepPos,
        selIds: Array.isArray(j.selIds) ? j.selIds.map(String) : [], done: !!j.done };
    });
    return e;
  };
  function q(sel) { return document.querySelectorAll(sel); }
  /* Writes the numbers into the size fields and the line under them. */
  X.paintInfo = function () {
    var o = xp(), PR = X.params(o), ae = document.activeElement;
    [["x", o.scaleX, ref && ref.w], ["y", o.scaleY, ref && ref.h]].forEach(function (a) {
      var f = a[1], mm = a[2] ? a[2] * f : null;
      q('[data-xs="' + a[0] + ':factor"]').forEach(function (i) { if (i !== ae) i.value = Math.round(f * 1e5) / 1e5; });
      q('[data-xs="' + a[0] + ':percent"]').forEach(function (i) { if (i !== ae) i.value = Math.round(f * 1e5) / 1e3; });
      q('[data-xs="' + a[0] + ':mm"]').forEach(function (i) { i.disabled = !ref; if (i !== ae) i.value = mm === null ? "" : Math.round(mm * 100) / 100; });
    });
    var el = q('[data-xi="info"]')[0]; if (!el) return;
    if (!ref) { el.textContent = "Measuring the design…"; return; }
    if (!ref.w && !ref.h) { el.textContent = "Nothing to cut with the current filters."; return; }
    var swap = ((Math.round(o.rotate / 90) % 4) + 4) % 2 === 1, w = (swap ? ref.h * o.scaleY : ref.w * o.scaleX) * PR.cfx, h = (swap ? ref.w * o.scaleX : ref.h * o.scaleY) * PR.cfy;
    var cut = PR.cutter, fits = cut && cut.widthMm > 0 ? (w <= cut.widthMm + 0.01 ? "fits" : "is wider than") : "";
    el.textContent = "Output about " + Math.round(w * 10) / 10 + " × " + Math.round(h * 10) / 10 + " mm (across the roll × along it, before strips)" + (fits ? "; it " + fits + " the cutting width of " + cut.name + " (" + cut.widthMm + " mm)" : "") +
      ". Calibration " + (o.useCalib !== false ? "X " + Math.round(PR.calX * 1e5) / 1e5 + ", Y " + Math.round(PR.calY * 1e5) / 1e5 : "off") + ", blade offset " + (PR.kerf ? Math.round(PR.kerf * 1000) / 1000 + " mm" : "off") + ".";
  };
  X.updateRef = function () {
    ref = null; X.paintInfo();
    var o = xp();
    X.refBox(o).then(function (r) { ref = r; X.paintInfo(); }, function () { ref = { w: 0, h: 0 }; X.paintInfo(); });
  };
  X.afterRender = function () { X.updateRef(); };
  function setScale(ax, f, lock) {
    var o = xp(); if (!(f > 0.001 && f < 1000)) return;
    if (ax === "x") o.scaleX = f; else o.scaleY = f;
    if (lock) { o.scaleX = f; o.scaleY = f; }
    C().save(); X.paintInfo();
  }
  document.addEventListener("input", function (e) {
    var t = e.target, d = t.dataset && t.dataset.xs; if (!d) return;
    var p = d.split(":"), v = Number(t.value); if (t.value === "" || !isFinite(v) || v <= 0) return;
    if (p[1] === "mm" && (!ref || !(p[0] === "x" ? ref.w : ref.h))) return;
    var f = p[1] === "factor" ? v : p[1] === "percent" ? v / 100 : (p[0] === "x" ? v / ref.w : v / ref.h);
    setScale(p[0], f, xp().scaleLock);
  });
  function fitFactor(kind) {
    var o = xp(), PR = X.params(o), cut = PR.cutter, swap = ((Math.round(o.rotate / 90) % 4) + 4) % 2 === 1;
    if (!ref || !ref.w || !ref.h) return { err: "Nothing to fit yet: the design has no size with the current filters." };
    if (kind === "roll") {
      if (!(cut && cut.widthMm > 0)) return { err: "The cutter has no cutting width. Set it in the Cutters window." };
      return { f: cut.widthMm / ((swap ? ref.h : ref.w) * (swap ? PR.cfy : PR.cfx)) };
    }
    var press = C().cfg().pressMm;
    if (!(press > 0)) return { err: "The heat press size is 0. Set it in the Cutters window." };
    return { f: Math.min(press / ref.w, press / ref.h) };
  }
  function newJobId() { var n = 1, js = xp().jobs; while (js.some(function (j) { return j.id === "j" + n; })) n++; return "j" + n; }
  X.act = function (act, d) {
    var o = xp(), core = C();
    if (act === "cutsvg") { X.cutExport(d.col || ""); return true; }
    if (act === "pngexport") { X.pngExport(); return true; }
    if (act === "blender") { X.blenderExport(d.kind); return true; }
    if (act === "blenderpreview") { X.blenderPreview(); return true; }
    if (act === "xscale1") { o.scaleX = 1; o.scaleY = 1; core.save(); X.paintInfo(); return true; }
    if (act === "xfitroll" || act === "xfitpress") {
      var r = fitFactor(act === "xfitroll" ? "roll" : "press");
      if (r.err) { msg(r.err); return true; }
      o.scaleX = r.f; o.scaleY = r.f; core.save(); X.paintInfo();
      msg((act === "xfitroll" ? "Fitted to the roll width" : "Fitted to the heat press") + ": scale " + Math.round(r.f * 10000) / 100 + " % in both directions.");
      return true;
    }
    if (act === "jobsave") {
      var nm = (o.jobName || "").trim() || "Job " + (o.jobs.length + 1);
      o.jobs.push({ id: newJobId(), name: nm, texts: o.texts, upper: o.upper, lower: o.lower, bet: o.bet, sel: o.sel, keepPos: o.keepPos, selIds: o.sel ? selectedIds() : [], done: false });
      o.jobName = ""; core.save(); core.renderPanels(); msg("Saved the job “" + nm + "”.");
      return true;
    }
    var j = o.jobs.filter(function (x) { return x.id === d.id; })[0];
    if (act === "jobuse" && j) { ["texts", "upper", "lower", "bet", "sel", "keepPos"].forEach(function (k) { o[k] = j[k]; }); core.save(); core.renderPanels(); msg("Loaded the filters of “" + j.name + "”."); return true; }
    if (act === "jobexp" && j) { X.cutExport("", { texts: j.texts, upper: j.upper, lower: j.lower, bet: j.bet, sel: j.sel, keepPos: j.keepPos, selIds: j.sel ? j.selIds : null }); return true; }
    if (act === "jobdone" && j) { j.done = !j.done; core.save(); core.renderPanels(); return true; }
    if (act === "jobdel" && j) { o.jobs.splice(o.jobs.indexOf(j), 1); core.save(); core.renderPanels(); return true; }
    return false;
  };
  /* filters and area change what the design size is */
  PTD.onChange = PTD.onChange || {};
  PTD.onChange.xp = function (obj, key) { if (["area", "keepPos", "texts", "upper", "lower", "sel", "bet", "cutter", "rotate", "fx", "fy", "useCalib", "useKerf"].indexOf(key) >= 0) { if (key === "sel" || key === "keepPos" || key === "texts" || key === "upper" || key === "lower" || key === "bet" || key === "area") X.updateRef(); else X.paintInfo(); } };

  /* ---------- Export again ----------
   * The last export button the user pressed (any button that makes a file) is remembered in memory. "Export again" presses
   * that same button once more, with whatever the settings are now, so the user does not have to find it in the panels.
   * It shows as a small button next to any export button the pointer is over, and as a toolbar button. */
  var EXPORT_ACTS = { cutsvg: 1, jobexp: 1, pngexport: 1, blender: 1, sheetsvg: 1, sheethtml: 1, calibdl: 1, calpdf: 1 };
  var lastExport = null;
  function exportLabel(b) {
    var d = b.dataset, t = (b.getAttribute("aria-label") || b.textContent || "").replace(/\s+/g, " ").trim();
    if (d.act === "cutsvg" && d.col) return "Cut file, one colour: " + t;
    return t || d.act;
  }
  X.lastExport = function () { return lastExport; };
  X.again = function () {
    if (!lastExport) return false;
    var host = document.querySelector(lastExport.root === "modal" ? "#modal" : "#controls");
    if (!host) return false;
    var b = document.createElement("button"); b.type = "button"; b.hidden = true; b.dataset.replay = "1";
    Object.keys(lastExport.data).forEach(function (k) { b.dataset[k] = lastExport.data[k]; });
    host.appendChild(b); try { b.click(); } finally { host.removeChild(b); }
    return true;
  };
  function initAgain() {
    var pop = document.getElementById("exportAgainPop"), bar = document.getElementById("exportAgainBtn");
    if (!pop || !bar) return;
    var hideTimer = null, over = null;
    function tipText() { return "Export again: presses the export button you used last (“" + (lastExport ? lastExport.label : "") + "”) once more, with the settings as they are now. You do not have to find that button again."; }
    function refresh() {
      bar.hidden = !lastExport; if (lastExport) { bar.title = tipText(); pop.title = tipText(); }
    }
    function hide() { clearTimeout(hideTimer); pop.hidden = true; over = null; }
    function later() { clearTimeout(hideTimer); hideTimer = setTimeout(hide, 350); }
    function showFor(b) {
      if (!lastExport) return;
      clearTimeout(hideTimer); over = b; pop.hidden = false;
      var r = b.getBoundingClientRect(), w = pop.offsetWidth || 110;
      pop.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, r.right + 6)) + "px";
      pop.style.top = Math.min(window.innerHeight - 40, r.bottom - 4) + "px";
    }
    function exportBtn(t) { var b = t && t.closest && t.closest("[data-act]"); return b && EXPORT_ACTS[b.dataset.act] && !b.dataset.replay ? b : null; }
    document.addEventListener("click", function (e) {
      var b = exportBtn(e.target); if (!b || b.disabled) return;
      var data = {}; Object.keys(b.dataset).forEach(function (k) { data[k] = b.dataset[k]; });
      lastExport = { data: data, label: exportLabel(b), root: b.closest("#modal") ? "modal" : "controls" };
      refresh(); hide();
    }, true);
    /* the Export tab button in the tab row also offers it, so it is reachable from every tab */
    function exportTab(t) { return t && t.closest ? t.closest('#tabs button[data-tab="export"]') : null; }
    document.addEventListener("mouseover", function (e) {
      if (e.target === pop || pop.contains(e.target)) { clearTimeout(hideTimer); return; }
      var tb = exportTab(e.target); if (tb) { showFor(tb); return; }
      if (exportBtn(e.target)) hide();
    });
    document.addEventListener("mouseout", function (e) {
      if (pop.hidden) return;
      var to = e.relatedTarget;
      if (to && (to === pop || pop.contains(to) || (over && over.contains(to)))) return;
      if (e.target === pop || pop.contains(e.target) || (over && over.contains(e.target))) later();
    });
    document.addEventListener("focusin", function (e) { var tb = exportTab(e.target); if (tb) showFor(tb); });
    document.addEventListener("click", function (e) { if (exportTab(e.target)) hide(); }, true);
    document.addEventListener("scroll", hide, true);
    pop.addEventListener("click", function () { hide(); X.again(); });
    bar.addEventListener("click", function () { X.again(); });
    refresh();
  }
  initAgain();

  PTD.exporter = X;
})(window.PTD = window.PTD || {});
