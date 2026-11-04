/* Layout sheet: a readable marking guide for the cloth. Everything is measured from the centre mark,
 * never chained from point to point, and the sheet lists check diagonals so mistakes show up early. */
(function (PTD) {
  "use strict";
  var S = {}, G = PTD.geom;
  var C = function () { return PTD.core; };

  function esc(s) { return C().esc(s); }
  function fmt(v) { return C().fmtLen(v); }
  function dirX(v) { return Math.abs(v) < 0.05 ? "on the centre line" : (v > 0 ? "right" : "left"); }
  function dirY(v) { return Math.abs(v) < 0.05 ? "on the centre line" : (v > 0 ? "down" : "up"); }
  function offset(p) {
    var parts = [];
    if (Math.abs(p.x) >= 0.05) parts.push(fmt(Math.abs(p.x)) + " " + dirX(p.x));
    if (Math.abs(p.y) >= 0.05) parts.push(fmt(Math.abs(p.y)) + " " + dirY(p.y));
    return parts.length ? parts.join(", ") : "at the centre";
  }
  var LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

  /* Collects everything the sheet needs from the project. */
  S.data = function () {
    var core = C(), st = core.state(), T = PTD.tables, out = { tables: [], guides: [], checks: [], art: [] };
    T.visible().forEach(function (t, ti) {
      var letter = LETTERS.charAt(ti % LETTERS.length), wn = T.worldNodes(t), n = wn.length, geo = T.geo(t);
      var points = wn.map(function (p, i) { return { label: letter + (i + 1), x: p.x, y: p.y, arc: Math.abs(p.b || 0) > 1e-9 }; });
      var arcs = [];
      wn.forEach(function (p, i) {
        var q = wn[(i + 1) % n], a = G.arc(p, q, p.b || 0);
        if (!a) return;
        var ap = G.apexOf(p, q, p.b);
        arcs.push({ label: letter + (i + 1) + "–" + letter + (((i + 1) % n) + 1), cx: a.cx, cy: a.cy, r: a.r, apex: ap, sweepDeg: Math.abs(a.sweep) * 180 / Math.PI });
      });
      var b = geo.bbox, corners = [{ label: "top-left", x: b.x0, y: b.y0 }, { label: "top-right", x: b.x1, y: b.y0 }, { label: "bottom-right", x: b.x1, y: b.y1 }, { label: "bottom-left", x: b.x0, y: b.y1 }];
      out.tables.push({ t: t, letter: letter, points: points, arcs: arcs, bbox: b, corners: corners, geo: geo });
    });
    st.guides.forEach(function (g) {
      var abs = PTD.guides.abs(g), o = { g: g, abs: abs, text: "" };
      if (g.ref.type === "outline") {
        var t = T.get(g.ref.table);
        o.text = t ? fmt(g.dist) + " from the " + (g.axis === "x" ? (g.ref.side === "min" ? "left" : "right") : (g.ref.side === "min" ? "top" : "bottom")) + " edge of " + t.name : "";
      }
      out.guides.push(o);
    });
    var AO = PTD.core.artOrigin();   /* the artwork is measured from its origin; the sheet lists positions from the cloth centre */
    st.layers.forEach(function (l) { if (!l.hidden) out.art.push({ name: l.text || "(empty)", x: AO.x + l.x, y: AO.y + l.y, size: l.size, kind: "Text" }); });
    if (!st.band.hidden && st.band.show) out.art.push({ name: "Lines (centre between the two lines)", x: AO.x + st.band.x, y: AO.y + st.band.y, size: st.band.len, kind: "Lines", len: st.band.len });
    if (!st.band.hidden && st.cards.show) out.art.push({ name: "Poker hand (centre)", x: AO.x + st.band.x, y: AO.y + st.band.y, size: PTD.core.cardSize().h, kind: "Cards" });
    /* check diagonals */
    out.tables.forEach(function (d) {
      var c = d.corners, w = d.bbox.x1 - d.bbox.x0, h = d.bbox.y1 - d.bbox.y0;
      out.checks.push({
        title: d.t.name + ": rectangle around the outline (" + fmt(w) + " × " + fmt(h) + ")",
        rows: [
          { a: c[0].label, b: c[2].label, d: Math.hypot(w, h) }, { a: c[1].label, b: c[3].label, d: Math.hypot(w, h) }
        ],
        note: "Both diagonals must be equal. Each corner is also the same distance from the centre only when the outline is centred."
      });
    });
    var xs = out.guides.filter(function (g) { return g.g.axis === "x"; }).map(function (g) { return g.abs; }).sort(function (a, b) { return a - b; });
    var ys = out.guides.filter(function (g) { return g.g.axis === "y"; }).map(function (g) { return g.abs; }).sort(function (a, b) { return a - b; });
    if (xs.length >= 2 && ys.length >= 2) {
      var gw = xs[xs.length - 1] - xs[0], gh = ys[ys.length - 1] - ys[0];
      out.checks.push({ title: "Outer guide rectangle (" + fmt(gw) + " × " + fmt(gh) + ")", rows: [{ a: "first vertical × first horizontal", b: "last vertical × last horizontal", d: Math.hypot(gw, gh) }, { a: "last vertical × first horizontal", b: "first vertical × last horizontal", d: Math.hypot(gw, gh) }], note: "Both diagonals must be equal." });
    }
    return out;
  };

  function svgPart(data) {
    var core = C(), st = core.state(), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    function ext(x, y) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    ext(0, 0);
    data.tables.forEach(function (d) { var b = G.bbox(d.geo.wrap.length ? d.geo.wrap : d.geo.poly); ext(b.x0, b.y0); ext(b.x1, b.y1); });
    if (st.cloth.real) { ext(st.cloth.x - st.cloth.w / 2, st.cloth.y - st.cloth.h / 2); ext(st.cloth.x + st.cloth.w / 2, st.cloth.y + st.cloth.h / 2); }
    data.guides.forEach(function (g) { if (g.g.axis === "x") ext(g.abs, 0); else ext(0, g.abs); });
    var W = x1 - x0, H = y1 - y0, m = Math.max(W, H) * 0.06;
    x0 -= m; y0 -= m; x1 += m; y1 += m; W = x1 - x0; H = y1 - y0;
    var fs = W / 58, sw = W / 900, o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + x0 + " " + y0 + " " + W + " " + H + '" width="100%" role="img" aria-label="Layout drawing" style="max-width:1000px;background:#fff;border:1px solid #999">');
    o.push('<style>text{font-family:Arial,Helvetica,sans-serif}</style>');
    if (st.cloth.real) o.push('<rect x="' + (st.cloth.x - st.cloth.w / 2) + '" y="' + (st.cloth.y - st.cloth.h / 2) + '" width="' + st.cloth.w + '" height="' + st.cloth.h + '" fill="#f3f7f4" stroke="#888" stroke-width="' + sw + '" stroke-dasharray="' + (sw * 8) + ' ' + (sw * 5) + '"/>');
    data.guides.forEach(function (g) {
      var v = g.abs, a = g.g.axis === "x" ? 'x1="' + v + '" x2="' + v + '" y1="' + y0 + '" y2="' + y1 + '"' : 'y1="' + v + '" y2="' + v + '" x1="' + x0 + '" x2="' + x1 + '"';
      o.push('<line ' + a + ' stroke="#d9822b" stroke-width="' + sw * 1.4 + '" stroke-dasharray="' + sw * 10 + ' ' + sw * 5 + '"/>');
      var tx = g.g.axis === "x" ? v + fs * 0.3 : x0 + fs * 0.3, ty = g.g.axis === "x" ? y0 + fs * 1.2 : v - fs * 0.3;
      o.push('<text x="' + tx + '" y="' + ty + '" font-size="' + fs * 0.85 + '" fill="#b05d0a">' + esc(g.g.name) + '</text>');
    });
    data.tables.forEach(function (d) {
      if (d.geo.wrap.length) o.push('<path d="' + G.polyPath(d.geo.wrap) + '" fill="none" stroke="#999" stroke-width="' + sw + '" stroke-dasharray="' + sw * 6 + ' ' + sw * 4 + '"/>');
      o.push('<path d="' + G.polyPath(d.geo.poly) + '" fill="#eef5f0" stroke="#0d2b22" stroke-width="' + sw * 2 + '"/>');
      if (d.geo.bet) o.push('<path d="' + G.polyPath(d.geo.bet.pts, d.geo.bet.closed) + '" fill="none" stroke="#b08a2a" stroke-width="' + sw * 1.5 + '"/>');
      d.points.forEach(function (p) {
        o.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="' + fs * 0.28 + '" fill="#0d2b22"/>');
        o.push('<text x="' + (p.x + fs * 0.45) + '" y="' + (p.y - fs * 0.35) + '" font-size="' + fs + '" font-weight="700" fill="#0d2b22">' + p.label + '</text>');
      });
    });
    /* centre cross */
    var cr = fs * 1.6;
    o.push('<line x1="' + -cr + '" x2="' + cr + '" y1="0" y2="0" stroke="#c00" stroke-width="' + sw * 2.5 + '"/><line y1="' + -cr + '" y2="' + cr + '" x1="0" x2="0" stroke="#c00" stroke-width="' + sw * 2.5 + '"/>');
    o.push('<circle cx="0" cy="0" r="' + cr * 0.55 + '" fill="none" stroke="#c00" stroke-width="' + sw * 2 + '"/>');
    o.push('<text x="' + cr * 0.8 + '" y="' + (cr * 1.9) + '" font-size="' + fs + '" font-weight="700" fill="#c00">Centre</text>');
    o.push('</svg>');
    return o.join("");
  }

  S.build = function () {
    var core = C(), st = core.state(), data = S.data(), svg = svgPart(data), cfg = core.cfg();
    var h = [];
    h.push('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(st.name) + ' – layout sheet</title>');
    h.push('<style>body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px auto;max-width:1000px;padding:0 16px;font-size:18px;line-height:1.45}h1{font-size:30px;margin:0 0 4px}h2{font-size:23px;border-bottom:3px solid #0d2b22;padding-bottom:4px;margin-top:34px}h3{font-size:20px;margin:22px 0 6px}table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #888;padding:7px 10px;text-align:left;vertical-align:top}th{background:#e8efe9}td.n{font-weight:700;white-space:nowrap}.rule{background:#fff6d6;border-left:6px solid #d4af5a;padding:8px 12px;margin:12px 0}.small{font-size:15px;color:#444}@media print{h2{break-after:avoid}table{break-inside:avoid}}</style></head><body>');
    h.push('<h1>' + esc(st.name) + ' – layout sheet</h1><div class="small">Distances are in ' + esc(cfg.units) + '. Right and down are as on the drawing below. Made ' + new Date().toISOString().slice(0, 10) + '.</div>');
    h.push('<div class="rule"><b>Rule:</b> measure every point from the centre mark (or from a straight line through it). Do not measure from one marked point to the next: small errors add up that way. Use the check diagonals at the end to catch mistakes.</div>');
    h.push('<h2>Drawing</h2>' + svg);
    h.push('<h2>1. Centre mark</h2><p>Find the middle of the cloth and mark it with a cross. Every other measurement starts here. Draw one line through it left–right and one up–down at a right angle (check the angle with a large square or a 3-4-5 triangle: 600, 800 and 1000 mm).</p>');
    if (st.cloth.real) h.push('<p class="small">Cloth size ' + fmt(st.cloth.w) + ' × ' + fmt(st.cloth.h) + '. Its centre is ' + esc(offset({ x: st.cloth.x, y: st.cloth.y })) + ' from the centre mark of the design.</p>');
    h.push('<h2>2. Guide lines</h2>');
    if (!data.guides.length) h.push('<p>No guide lines are defined.</p>');
    else {
      h.push('<table><tr><th>Line</th><th>Direction</th><th>Measure from the centre</th><th>Also</th></tr>');
      data.guides.forEach(function (g) {
        var v = g.abs, isX = g.g.axis === "x";
        h.push('<tr><td class="n">' + esc(g.g.name) + '</td><td>' + (isX ? "Vertical (up–down line)" : "Horizontal (left–right line)") + '</td><td><b>' + (Math.abs(v) < 0.05 ? "through the centre" : fmt(Math.abs(v)) + " " + (isX ? dirX(v) : dirY(v))) + '</b></td><td>' + esc(g.text) + '</td></tr>');
      });
      h.push('</table>');
    }
    h.push('<h2>3. Table outlines</h2>');
    if (!data.tables.length) h.push('<p>No tables.</p>');
    data.tables.forEach(function (d) {
      var t = d.t;
      h.push('<h3>' + esc(t.name) + ' (points ' + d.letter + '1 to ' + d.letter + d.points.length + ')</h3>');
      h.push('<p class="small">Size ' + fmt(d.bbox.x1 - d.bbox.x0) + ' × ' + fmt(d.bbox.y1 - d.bbox.y0) + '. Leftmost edge ' + esc(offset({ x: d.bbox.x0, y: 0 })) + ', rightmost edge ' + esc(offset({ x: d.bbox.x1, y: 0 })) + ', top edge ' + esc(offset({ x: 0, y: d.bbox.y0 })) + ', bottom edge ' + esc(offset({ x: 0, y: d.bbox.y1 })) + '. Wrap allowance ' + fmt(t.wrap) + '.</p>');
      h.push('<table><tr><th>Point</th><th>Measure from the centre</th><th>Straight distance from the centre</th><th>Next segment</th></tr>');
      d.points.forEach(function (p, i) {
        h.push('<tr><td class="n">' + p.label + '</td><td>' + esc(offset(p)) + '</td><td>' + fmt(Math.hypot(p.x, p.y)) + '</td><td>' + (p.arc ? "arc" : "straight line") + '</td></tr>');
      });
      h.push('</table>');
      if (d.arcs.length) {
        h.push('<p><b>Arcs.</b> Draw each arc with a string and pencil (a trammel) from its centre point at the radius given. The middle of the arc is a check point.</p><table><tr><th>Arc</th><th>Radius</th><th>Centre point (from the centre mark)</th><th>Middle of the arc</th><th>Angle</th></tr>');
        d.arcs.forEach(function (a) {
          h.push('<tr><td class="n">' + a.label + '</td><td>' + fmt(a.r) + '</td><td>' + esc(offset({ x: a.cx, y: a.cy })) + '</td><td>' + esc(offset(a.apex)) + '</td><td>' + (Math.round(a.sweepDeg * 10) / 10) + '°</td></tr>');
        });
        h.push('</table>');
      }
      if (d.geo.bet) h.push('<p class="small">Player-area line: ' + fmt(t.bet.inset) + ' inside the outline, ' + fmt(t.bet.thick) + ' wide' + (t.bet.gapOn ? ', with a ' + fmt(t.bet.gapW) + ' gap at the ' + t.bet.gapSide : '') + '. Measure it from the outline edge.</p>');
    });
    h.push('<h2>4. Artwork positions</h2><table><tr><th>Item</th><th>Measure from the centre</th><th>Size</th></tr>');
    data.art.forEach(function (a) {
      h.push('<tr><td class="n">' + esc(a.kind + ": " + a.name) + '</td><td>' + esc(offset({ x: a.x, y: a.y })) + (a.kind === "Text" ? " (centre of the word, at the baseline)" : "") + '</td><td>' + (a.kind === "Lines" ? "length " + fmt(a.len) : a.kind === "Cards" ? "card height " + fmt(a.size) : "text size " + fmt(a.size)) + '</td></tr>');
    });
    h.push('</table>');
    h.push('<h2>5. Check diagonals</h2>');
    if (!data.checks.length) h.push('<p>Nothing to check.</p>');
    data.checks.forEach(function (c) {
      h.push('<h3>' + esc(c.title) + '</h3><table><tr><th>From</th><th>To</th><th>Distance</th></tr>');
      c.rows.forEach(function (r) { h.push('<tr><td>' + esc(r.a) + '</td><td>' + esc(r.b) + '</td><td><b>' + fmt(r.d) + '</b></td></tr>'); });
      h.push('</table><p class="small">' + esc(c.note) + '</p>');
    });
    h.push('<p class="small">If a check differs by more than 2 mm, find the error before cutting or printing.</p></body></html>');
    return { html: h.join(""), svg: svg };
  };

  S.download = function (kind) {
    var core = C(), b = S.build(), name = core.slug(core.state().name);
    if (kind === "svg") core.download(name + "-layout.svg", '<?xml version="1.0" encoding="UTF-8"?>\n' + b.svg, "image/svg+xml");
    else core.download(name + "-layout-sheet.html", b.html, "text/html");
  };
  S.show = function () {
    var modal = document.getElementById("modal"), bar = document.getElementById("modalBar"), body = document.getElementById("modalBody");
    var b = S.build();
    bar.innerHTML = '<button class="btn" type="button" data-sheet="html">Download HTML</button><button class="btn" type="button" data-sheet="svg">Download drawing (SVG)</button><button class="btn" type="button" data-sheet="close">Close</button>';
    body.innerHTML = "";
    var f = document.createElement("iframe"); f.title = "Layout sheet"; f.setAttribute("sandbox", ""); f.srcdoc = b.html;
    body.appendChild(f);
    modal.hidden = false;
  };
  document.getElementById("modal").addEventListener("click", function (e) {
    var t = e.target.closest("[data-sheet]");
    if (e.target.id === "modal" || (t && t.dataset.sheet === "close")) { document.getElementById("modal").hidden = true; document.getElementById("modalBody").innerHTML = ""; return; }
    if (t) S.download(t.dataset.sheet);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { var m = document.getElementById("modal"); if (m && !m.hidden) { m.hidden = true; document.getElementById("modalBody").innerHTML = ""; } } });
  S.act = function (act) {
    if (act === "sheetview") { S.show(); return true; }
    if (act === "sheethtml") { S.download("html"); return true; }
    if (act === "sheetsvg") { S.download("svg"); return true; }
    return false;
  };

  PTD.sheet = S;
})(window.PTD = window.PTD || {});
