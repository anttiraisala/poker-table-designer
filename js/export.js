/* Exports: cut file for a vinyl cutter (SVG, one group per palette colour), a PNG picture of the
 * artwork, and a Blender scene script built from the project.
 *
 * Cutting: every object becomes closed polygons. Upper objects knock out what lies below them (their
 * outline halo, or their own shape). The boolean work uses Paper.js, loaded from a CDN on first use;
 * without it the shapes are exported as they are, overlapping. Text must be outlines: frozen text is
 * used as is, text with an imported font file is turned into outlines for the export. */
(function (PTD) {
  "use strict";
  var X = {}, G = PTD.geom;
  var C = function () { return PTD.core; };
  var PAPER_URL = "https://cdnjs.cloudflare.com/ajax/libs/paper.js/0.12.17/paper-core.min.js";
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
  /* Sutherland-Hodgman against the vertical band x0 <= x <= x1 (only used without Paper.js). */
  function clipBand(ring, x0, x1) {
    function side(r, inside, cut) {
      var out = [], n = r.length;
      for (var i = 0; i < n; i++) {
        var a = r[i], b = r[(i + 1) % n], ia = inside(a), ib = inside(b);
        if (ia) out.push(a);
        if (ia !== ib) out.push(cut(a, b));
      }
      return out;
    }
    var r = side(ring, function (p) { return p[0] >= x0; }, function (a, b) { var t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + (b[1] - a[1]) * t]; });
    if (r.length) r = side(r, function (p) { return p[0] <= x1; }, function (a, b) { var t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + (b[1] - a[1]) * t]; });
    return r;
  }

  /* ---------- gathering the objects to cut ---------- */
  function ensureOutline(l) {
    if (l.frozen) return Promise.resolve(l.frozen);
    if (!PTD.fonts.data[l.font]) return Promise.resolve(null);
    var copy = Object.assign({}, l);
    return PTD.fonts.freeze(copy).then(function () { return copy.frozen; }, function () { return null; });
  }
  function textRings(l, fz) {
    var rings = X.parsePath(fz.d, 0.05), a = l.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    return mapRings(rings, function (p) { return [l.x + p[0] * ca - p[1] * sa, l.y + p[0] * sa + p[1] * ca]; });
  }
  /* Returns a promise of {items, warnings}. Items run from the lowest to the highest. */
  X.gather = function (o) {
    var core = C(), st = core.state(), T = PTD.tables, items = [], warnings = [], jobs = [];
    var stack = [], at = st.band.at;
    st.layers.forEach(function (l, i) { if (i === at) stack.push("band"); stack.push(l.id); });
    if (at >= st.layers.length) stack.push("band");
    stack.forEach(function (id, k) {
      if (id === "band") {
        var b = st.band;
        if (b.hidden) return;
        if (b.show) {
          var ow = b.outline ? Math.max(0, b.outlineW) : 0, ys = [b.y - b.gap / 2 - b.thick, b.y + b.gap / 2];
          ys.forEach(function (yy) { items.push({ name: "Line", colour: b.color, rings: [rectRing(b.x - b.len / 2, yy, b.x + b.len / 2, yy + b.thick)], halo: ow, haloRings: ow ? [rectRing(b.x - b.len / 2 - ow, yy - ow, b.x + b.len / 2 + ow, yy + b.thick + ow)] : null, order: k + 1 }); });
        }
        if (st.cards.potShow || st.cards.burnShow || st.cards.muckShow) warnings.push("The pot, burn cards and muck are not part of the cut file. They only show in the picture and in Blender.");
        if (st.cards.show && core.parseHand(st.cards.hand).cards.length) warnings.push("The poker hand is not part of the cut file: card faces and symbols are live text. Cut them from a separate design or freeze them yourself.");
        return;
      }
      var l = core.getLayer(id);
      if (!l || l.hidden || !l.text) return;
      var slot = { name: l.text, colour: l.color, rings: null, halo: l.outline && l.outlineW > 0 ? l.outlineW : 0, order: k + 1, layer: l };
      items.push(slot);
      jobs.push(ensureOutline(l).then(function (fz) {
        if (!fz) { slot.skip = true; warnings.push("The text “" + l.text + "” is not cut: it has no outlines. Import its font file on the Fonts tab, then freeze it."); return; }
        slot.rings = textRings(l, fz);
        if (!l.frozen) warnings.push("The text “" + l.text + "” was turned into outlines for this export only.");
      }));
    });
    /* the player-area line lies above everything else, with its outline cutting a hole in what is below */
    if (o.bet) T.visible().forEach(function (t) {
      var rings = T.betPolygons(t); if (!rings.length) return;
      var ow = t.bet.outline && t.bet.outlineW > 0 ? t.bet.outlineW : 0;
      items.push({ name: t.name + " player-area line", colour: t.bet.color, rings: rings, halo: ow, haloRings: ow ? T.betPolygons(t, ow) : null, order: stack.length + 2 });
    });
    return Promise.all(jobs).then(function () {
      return { items: items.filter(function (it) { return !it.skip && it.rings && it.rings.length; }), warnings: warnings };
    });
  };

  /* ---------- transforms ---------- */
  function makeTransform(items, o) {
    var rot = ((Math.round(o.rotate / 90) % 4) + 4) % 4 * 90, flip = !!o.mirror;
    function base(p) {
      var x = flip ? -p[0] : p[0], y = p[1];
      if (rot === 90) return [-y, x];
      if (rot === 180) return [-x, -y];
      if (rot === 270) return [y, -x];
      return [x, y];
    }
    var x0 = Infinity, y0 = Infinity;
    items.forEach(function (it) {
      var rings = it.haloRings || it.rings, pad = it.haloRings ? 0 : it.halo;
      rings.forEach(function (r) { r.forEach(function (p) { var q = base(p); x0 = Math.min(x0, q[0] - pad); y0 = Math.min(y0, q[1] - pad); }); });
    });
    if (!isFinite(x0)) { x0 = 0; y0 = 0; }
    var fx = o.fx > 0 ? o.fx : 1, fy = o.fy > 0 ? o.fy : 1;
    return function (p) { var q = base(p); return [(q[0] - x0) * fx, (q[1] - y0) * fy]; };
  }

  /* ---------- Paper.js ---------- */
  X.loadPaper = function () {
    return new Promise(function (resolve, reject) {
      if (window.paper && window.paper.Path) { resolve(window.paper); return; }
      var s = document.createElement("script");
      s.src = PAPER_URL;
      s.onload = function () {
        try { window.paper.setup(document.createElement("canvas")); resolve(window.paper); } catch (e) { reject(e); }
      };
      s.onerror = function () { reject(new Error("Could not load Paper.js.")); };
      document.head.appendChild(s);
    });
  };
  function paperShape(P, rings) {
    var kids = rings.filter(function (r) { return r.length > 2; }).map(function (r) {
      return new P.Path({ segments: r.map(function (p) { return new P.Point(p[0], p[1]); }), closed: true, insert: false });
    });
    return new P.CompoundPath({ children: kids, fillRule: "nonzero", insert: false });
  }
  function paperRings(item, minArea) {
    var out = [];
    if (!item) return out;
    var paths = item.children ? item.children : [item];
    paths.forEach(function (p) {
      if (!p.segments || p.segments.length < 3) return;
      var ring = p.segments.map(function (s) { return [s.point.x, s.point.y]; });
      if (Math.abs(ringArea(ring)) >= minArea) out.push(ring);
    });
    return out;
  }
  function paperHalo(P, shape, r) {
    var acc = shape.clone({ insert: false }), steps = 3, dirs = 16;
    for (var s = 1; s <= steps; s++) for (var k = 0; k < dirs; k++) {
      var ang = 2 * Math.PI * k / dirs, rr = r * s / steps, c = shape.clone({ insert: false });
      c.translate(new P.Point(Math.cos(ang) * rr, Math.sin(ang) * rr));
      acc = acc.unite(c, { insert: false });
    }
    return acc;
  }

  /* ---------- the cut pipeline ---------- */
  /* Returns {strips: [{w, h, colours: {paletteId: rings}}], warnings, booleans}. */
  X.buildCut = function (o) {
    var core = C(), T = PTD.tables, region = null;
    return X.gather(o).then(function (g) {
      var items = g.items, warnings = g.warnings.slice();
      if (!items.length) throw new Error("There is nothing to cut. Freeze the text first, or switch on the lines or the player-area line.");
      if (o.area !== "all") {
        var t = T.get(o.area);
        if (t) { var geo = T.geo(t); region = (geo.wrap.length ? geo.wrap : geo.poly).map(function (p) { return [p[0], p[1]]; }); }
      }
      var tf = makeTransform(items, o);
      items = items.map(function (it) {
        return { name: it.name, colour: it.colour, rings: mapRings(it.rings, tf), halo: it.halo, haloRings: it.haloRings ? mapRings(it.haloRings, tf) : null };
      });
      var clip = region ? [region.map(tf)] : null;
      var all = items.reduce(function (a, it) { return a.concat(it.haloRings || it.rings); }, []);
      var bb = bboxRings(all, 0);
      if (clip) bb = bboxRings(clip, 0);
      var W = bb.x1 - bb.x0, H = bb.y1 - bb.y0, strips = [];
      var stripW = o.stripW > 0 ? o.stripW : 0, ov = Math.max(0, Math.min(o.stripOverlap || 0, stripW / 2));
      var bands = [];
      if (stripW > 0 && W > stripW) {
        var pitch = stripW - ov, n = Math.ceil((W - ov) / pitch);
        for (var k = 0; k < n; k++) bands.push({ x0: bb.x0 + k * pitch, x1: Math.min(bb.x1, bb.x0 + k * pitch + stripW) });
      } else bands.push({ x0: bb.x0, x1: bb.x1 });
      return X.loadPaper().then(function (P) { return { P: P }; }, function () { return { P: null }; }).then(function (r) {
        var P = r.P, colours = {}, minArea = o.tol * o.tol;
        if (P) {
          var cover = null, vis = [];
          for (var i = items.length - 1; i >= 0; i--) {
            var it = items[i], shape = paperShape(P, it.rings), ko = null;
            if (it.halo > 0) ko = it.haloRings ? paperShape(P, it.haloRings) : paperHalo(P, shape, it.halo);
            else if (o.overlap) ko = shape;
            vis.push({ it: it, shape: cover ? shape.subtract(cover, { insert: false }) : shape });
            if (ko) cover = cover ? cover.unite(ko, { insert: false }) : ko;
          }
          vis.forEach(function (v) { colours[v.it.colour] = colours[v.it.colour] ? colours[v.it.colour].unite(v.shape, { insert: false }) : v.shape; });
          if (clip) Object.keys(colours).forEach(function (c) { colours[c] = colours[c].intersect(paperShape(P, clip), { insert: false }); });
          bands.forEach(function (bd, bi) {
            var out = {}, rect = paperShape(P, [rectRing(bd.x0, bb.y0, bd.x1, bb.y1)]);
            Object.keys(colours).forEach(function (c) {
              var piece = bands.length > 1 ? colours[c].intersect(rect, { insert: false }) : colours[c];
              var rings = paperRings(piece, minArea).map(function (ring) { return ring.map(function (p) { return [p[0] - bd.x0, p[1] - bb.y0]; }); });
              if (rings.length) out[c] = rings;
            });
            strips.push({ w: bd.x1 - bd.x0, h: H, colours: out });
          });
        } else {
          warnings.push("Paper.js could not be loaded (it needs an internet connection the first time). The shapes are exported as they are: overlapping objects are NOT knocked out and clipping to a table is skipped.");
          bands.forEach(function (bd) {
            var out = {};
            items.forEach(function (it, ii) {
              var rings = bands.length > 1 ? it.rings.map(function (rg) { return clipBand(rg, bd.x0, bd.x1); }).filter(function (rg) { return rg.length > 2; }) : it.rings;
              if (!rings.length) return;
              (out[it.colour] = out[it.colour] || []).push.apply(out[it.colour], rings.map(function (rg) { var m = rg.map(function (p) { return [p[0] - bd.x0, p[1] - bb.y0]; }); m.g = ii; return m; }));
            });
            strips.push({ w: bd.x1 - bd.x0, h: H, colours: out });
          });
        }
        return { strips: strips, warnings: warnings, booleans: !!P };
      });
    });
  };

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
  X.cutExport = function (only) {
    if (busy) return;
    busy = true; msg("Preparing the cut file…");
    var o = Object.assign({}, xp());
    X.buildCut(o).then(function (res) {
      var svg = X.cutSVG(res, only), core = C();
      core.download(core.slug(core.state().name) + (only ? "-" + core.slug((core.state().palette.filter(function (c) { return c.id === only; })[0] || {}).name) : "-cut") + ".svg", svg, "image/svg+xml");
      var colours = {}; res.strips.forEach(function (s) { Object.keys(s.colours).forEach(function (c) { colours[c] = 1; }); });
      msg("Cut file saved: " + res.strips.length + (res.strips.length === 1 ? " piece, " : " strips, ") + Object.keys(colours).length + " colour layer(s)." + (res.booleans ? "" : " Overlaps were not resolved.") + (res.warnings.length ? " " + res.warnings.join(" ") : ""));
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
  X.artSVG = function (region, pxmm) {
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
    X.artSVG(region, px).then(function (a) {
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
      rail_color: linHex(t.railColor || "#6b4a2b"), felt_color: linHex(core.colorHex(core.state().cloth.color))
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
    return '<h3 class="sec">Layout sheet</h3><p class="small">A large-print marking guide: centre cross, outline points, guide lines and check diagonals, all measured from the centre.</p>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="sheetview">Open the sheet</button><button class="btn" type="button" data-act="sheethtml">Download HTML</button><button class="btn" type="button" data-act="sheetsvg">Download drawing (SVG)</button></div>' +
      '<h3 class="sec">Cut file (vinyl cutter)</h3>' +
      '<p class="small">One SVG with a layer per palette colour, made of closed polygons in millimetres. Upper objects hide what is below them. Text must have outlines: freeze it on the Artwork tab, or import its font file and it is outlined here automatically.</p>' +
      '<label class="fld"><span>What to export</span><select data-scope="xp" data-key="area">' + areaOpts + '</select></label>' +
      '<div class="checks">' + h.chk("Mirror (for the back of heat-transfer vinyl)", "xp", "mirror") + h.chk("Hide overlapped parts", "xp", "overlap") + h.chk("Include the player-area line", "xp", "bet") + '</div>' +
      '<div class="row3"><label class="fld"><span>Rotate</span><select data-scope="xp" data-key="rotate" data-num="1"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>' +
      h.numField("Correction X", "xp", "fx", "0.0001") + h.numField("Correction Y", "xp", "fy", "0.0001") + '</div>' +
      '<div class="row3">' + h.numField("Tolerance (mm)", "xp", "tol", "0.005") + h.len("Strip width (0 = none)", "xp", "stripW") + h.len("Strip overlap", "xp", "stripOverlap") + '</div>' +
      '<p class="small">Correction factors scale the output along the cutter’s X and Y axes, for example 1.002 when a test cut came out 0.2 % small. Strips split the design into pieces no wider than the strip width, stacked in one file along the roll.</p>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="cutsvg" data-col="">Download cut file (all colours)</button></div>' +
      (layerBtns ? '<p class="small">One colour only:</p><div class="btnrow">' + layerBtns + '</div>' : '') +
      '<h3 class="sec">Picture (PNG)</h3><div class="row2">' + h.numField("Pixels per mm", "xp", "pxmm", "0.05") + '<label class="fld"><span>Area</span><select data-scope="xp" data-key="area">' + areaOpts + '</select></label></div>' +
      '<div class="btnrow"><button class="btn" type="button" data-act="pngexport">Download PNG</button></div>' +
      '<h3 class="sec">Blender scene</h3><p class="small">A Python script that builds the table of this project in a casino room: the outline with its arcs and dealer notch, the rail, and the cloth with all texts, lines, cards and the player-area line printed on it as a texture. Use Preview to see the shape and texture before opening Blender. Preview uses EEVEE and takes seconds; final uses Cycles with haze and takes minutes.</p>' +
      '<div class="row3"><label class="fld"><span>Table</span><select data-scope="xp" data-key="bTable"><option value="">First visible</option>' + tableOpts + '</select></label>' + h.len("Table height", "xp", "bTableH") + h.len("Rail height", "xp", "bRailH") + '</div>' +
      '<div class="row2">' + h.numField("Texture size (px, long side)", "xp", "bTex", "256") + '<div></div></div>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="blenderpreview">Preview the Blender table</button><button class="btn" type="button" data-act="blender" data-kind="preview">Download Blender script (preview)</button><button class="btn" type="button" data-act="blender" data-kind="final">Download Blender script (final)</button></div>' +
      '<div class="msg" id="exportMsg" aria-live="polite"></div>';
  };
  X.act = function (act, d) {
    if (act === "cutsvg") { X.cutExport(d.col || ""); return true; }
    if (act === "pngexport") { X.pngExport(); return true; }
    if (act === "blender") { X.blenderExport(d.kind); return true; }
    if (act === "blenderpreview") { X.blenderPreview(); return true; }
    return false;
  };

  PTD.exporter = X;
})(window.PTD = window.PTD || {});
