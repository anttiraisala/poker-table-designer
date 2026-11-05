/* Cutters: the list of vinyl cutters (shared by all projects, kept in the settings), the calibration of each one
 * (test strips, a measuring guide window and PDF, the correction worked out from the measured sizes) and the numbers
 * the exports use: a scale factor for each axis and the blade offset (kerf).
 *
 * A cutter: { id, name, widthMm (cutting width, across the roll), maxLengthMm (0 = no limit), thinMm (thinnest detail the
 * film cuts and weeds well), calib }. calib: { margin (mm around the bitmaps), kerfOverride (null or mm), date,
 * x: side, y: side } where x is the horizontal strips (across the roll) and y the vertical ones (along the roll) and a side is
 * { lengths: [mm...], mode: "simple" | "detail", use (the strip used in simple mode), rows: [{ outer, span, block, gap }],
 * override (null or a factor typed by the user) }. The maths is in calfit.js. */
(function (PTD) {
  "use strict";
  var K = {}, C = function () { return PTD.core; }, FIT = PTD.calfit;
  var DEFAULT_LENGTHS = [100, 250, 480], FIELDS = ["outer", "span", "block", "gap"];
  var ui = { sel: "", armed: "" };

  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function fmt(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function signed(v, d) { return (v >= 0 ? "+" : "") + fmt(v, d); }

  /* ---------- the data ---------- */
  function lengthLimits(c, dir) {
    var max = dir === "x" ? (c.widthMm > 0 ? c.widthMm : 2000) : (c.maxLengthMm > 0 ? c.maxLengthMm : 2000);
    return { min: 60, max: Math.max(60, max) };
  }
  function normSide(o, c, dir, count) {
    o = o && typeof o === "object" ? o : {};
    var lim = lengthLimits(c, dir), lens = Array.isArray(o.lengths) ? o.lengths.map(function (v) { return num(v, 0); }).filter(function (v) { return v > 0; }) : [];
    if (!lens.length) lens = DEFAULT_LENGTHS.slice();
    count = Math.max(2, Math.min(6, count || lens.length));
    while (lens.length < count) lens.push(lens[lens.length - 1] + 100);
    lens = lens.slice(0, count).map(function (v) { return Math.max(lim.min, Math.min(lim.max, Math.round(v * 10) / 10)); });
    var rows = [];
    for (var i = 0; i < count; i++) {
      var r = (o.rows && o.rows[i]) || {}, row = {};
      FIELDS.forEach(function (f) { var v = Number(r[f]); row[f] = r[f] !== null && r[f] !== undefined && r[f] !== "" && isFinite(v) && v > 0 ? v : null; });
      rows.push(row);
    }
    var ov = Number(o.override);
    return { lengths: lens, mode: o.mode === "simple" ? "simple" : "detail", use: Math.max(0, Math.min(count - 1, Math.round(num(o.use, 0)))), rows: rows,
      override: o.override !== null && o.override !== undefined && o.override !== "" && isFinite(ov) && ov > 0.5 && ov < 2 ? ov : null };
  }
  K.norm = function (o, i) {
    o = o && typeof o === "object" ? o : {};
    var c = { id: String(o.id || ("k" + (i + 1))), name: String(o.name == null || o.name === "" ? "Cutter " + (i + 1) : o.name).slice(0, 80),
      widthMm: Math.max(0, num(o.widthMm, 500)), maxLengthMm: Math.max(0, num(o.maxLengthMm, 0)), thinMm: Math.max(0, num(o.thinMm, 0)) };
    var cal = o.calib && typeof o.calib === "object" ? o.calib : {}, count = Math.max(2, Math.min(6, Math.round(num(cal.x && cal.x.lengths && cal.x.lengths.length, 3))));
    var ko = Number(cal.kerfOverride);
    c.calib = { margin: Math.max(0, Math.min(50, num(cal.margin, 5))), date: String(cal.date || ""),
      kerfOverride: cal.kerfOverride !== null && cal.kerfOverride !== undefined && cal.kerfOverride !== "" && isFinite(ko) && Math.abs(ko) < 2 ? ko : null,
      x: normSide(cal.x, c, "x", count), y: normSide(cal.y, c, "y", count) };
    return c;
  };
  K.make = function (i) { return K.norm({ name: "Cutter " + i }, i - 1); };
  K.normList = function (arr) {
    var out = [], ids = {};
    (Array.isArray(arr) ? arr : []).forEach(function (o, i) {
      var c = K.norm(o, i);
      while (ids[c.id]) c.id += "x";
      ids[c.id] = 1; out.push(c);
    });
    return out.length ? out : [K.make(1)];
  };
  function list() { return C().cfg().cutters; }
  K.list = list;
  K.byId = function (id) { return list().filter(function (c) { return c.id === id; })[0] || null; };
  K.byName = function (n) { return list().filter(function (c) { return c.name === n; })[0] || null; };
  /* The cutter of the open project (chosen by name in the Export tab; the first one when the name is gone). */
  K.current = function () { var n = C().state().export && C().state().export.cutter; return K.byName(n) || list()[0]; };
  function selected() { return K.byId(ui.sel) || (K.byName(C().state().export.cutter) || list()[0]); }
  function newId() { var n = list().length + 1; while (K.byId("k" + n)) n++; return "k" + n; }

  function strips(c, dir) { var s = c.calib[dir]; return s.lengths.map(function (L, i) { return Object.assign({ len: L }, s.rows[i]); }); }
  K.fitSide = function (c, dir) { var s = c.calib[dir]; return FIT.fit(strips(c, dir), s.mode, s.use); };
  function refLen(c, dir) { return Math.max.apply(null, c.calib[dir].lengths); }
  /* What the exports use: a correction factor for each axis (X across the roll, Y along it) and the blade offset. */
  K.effective = function (c) {
    c = c || K.current();
    var fx = K.fitSide(c, "x"), fy = K.fitSide(c, "y"), k = FIT.kerf(fx, fy), cal = c.calib;
    return { fx: cal.x.override !== null ? cal.x.override : fx.f, fy: cal.y.override !== null ? cal.y.override : fy.f,
      kerf: cal.kerfOverride !== null ? cal.kerfOverride : k.d, fitX: fx, fitY: fy, kerfInfo: k,
      manualX: cal.x.override !== null, manualY: cal.y.override !== null, manualKerf: cal.kerfOverride !== null };
  };

  /* ---------- JSON ---------- */
  K.FORMAT = "poker-table-designer-cutters";
  K.toJSON = function () { return { format: K.FORMAT, version: 1, cutters: JSON.parse(JSON.stringify(list())) }; };
  /* A text with a "cutters" list replaces the list; a single cutter is added (or replaces the one with the same name). */
  K.applyJSON = function (o) {
    var core = C(), cfg = core.cfg();
    if (Array.isArray(o.cutters)) {
      if (!o.cutters.length) return { ok: false, msg: "The cutter list is empty: nothing was changed." };
      cfg.cutters = K.normList(o.cutters);
      ui.sel = cfg.cutters[0].id;
      core.saveConfig(); core.renderPanels();
      return { ok: true, msg: "Cutters loaded (" + cfg.cutters.length + ")." };
    }
    var c = K.norm(o, cfg.cutters.length), same = K.byName(c.name);
    if (same) { c.id = same.id; cfg.cutters[cfg.cutters.indexOf(same)] = c; }
    else { c.id = newId(); cfg.cutters.push(c); }
    ui.sel = c.id; core.saveConfig(); core.renderPanels();
    return { ok: true, msg: (same ? "Replaced the cutter “" : "Added the cutter “") + c.name + "”." };
  };
  /* Looks like a cutter list or one cutter. */
  K.isCutterJSON = function (o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return false;
    return o.format === K.FORMAT || (Array.isArray(o.cutters) && o.units === undefined) || (typeof o.name === "string" && o.widthMm !== undefined && o.artwork === undefined);
  };
  /* ---------- the drawing of the measuring guide ---------- */
  /* A list of primitives in a box of 520 x 292 units, drawn as SVG in the window and as vector lines in the PDF. */
  var RED = "#c4161c";
  function arrow(ops, x1, y1, x2, y2) {
    ops.push({ t: "line", x1: x1, y1: y1, x2: x2, y2: y2, w: 0.9, color: RED });
    var vx = x2 - x1, vy = y2 - y1, L = Math.hypot(vx, vy) || 1, ux = vx / L, uy = vy / L, h = Math.min(7, L / 3), w = h * 0.38;
    function head(x, y, s) { ops.push({ t: "poly", pts: [[x, y], [x - s * ux * h + uy * w, y - s * uy * h - ux * w], [x - s * ux * h - uy * w, y - s * uy * h + ux * w]], fill: RED }); }
    head(x1, y1, -1); head(x2, y2, 1);
  }
  function dim(ops, x1, x2, y, label) {
    arrow(ops, x1, y, x2, y);
    ops.push({ t: "line", x1: x1, y1: y - 5, x2: x1, y2: y + 5, w: 0.7, color: RED }, { t: "line", x1: x2, y1: y - 5, x2: x2, y2: y + 5, w: 0.7, color: RED });
    ops.push({ t: "text", x: (x1 + x2) / 2, y: y - 6, s: label, size: 12, bold: true, color: RED, anchor: "m" });
  }
  K.guideScene = function () {
    var ops = [], K2 = PTD.calibration, Lref = 480, s1 = 500 / Lref, x0 = 10;
    function map(poly, sx, sy, ox, oy) { return poly.map(function (p) { return [ox + p[0] * sx, oy + p[1] * sy]; }); }
    ops.push({ t: "text", x: 10, y: 10, s: "Whole strip (schematic: the height is exaggerated)", size: 9, bold: true });
    ops.push({ t: "poly", pts: map(K2.polygon(Lref), s1, 3, x0, 62), fill: "#d9d4c4", stroke: "#222", lw: 0.7 });
    dim(ops, x0, x0 + 460 * s1, 54, "2");
    dim(ops, x0, x0 + 480 * s1, 148, "1");
    ops.push({ t: "text", x: 10, y: 178, s: "Detail of the first blocks (the real strip is much longer)", size: 9, bold: true });
    ops.push({ t: "poly", pts: map(K2.polygon(70), 7, 4, x0, 214), fill: "#d9d4c4", stroke: "#222", lw: 0.7 });
    dim(ops, x0 + 20 * 7, x0 + 30 * 7, 204, "3");
    dim(ops, x0 + 30 * 7, x0 + 40 * 7, 204, "4");
    return { w: 520, h: 292, ops: ops };
  };
  K.sceneSVG = function (sc) {
    var o = sc.ops.map(function (p) {
      if (p.t === "line") return '<line x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '" stroke="' + (p.color || "#000") + '" stroke-width="' + (p.w || 0.5) + '"/>';
      if (p.t === "poly") return '<polygon points="' + p.pts.map(function (q) { return q[0] + "," + q[1]; }).join(" ") + '" fill="' + (p.fill || "none") + '" stroke="' + (p.stroke || "none") + '" stroke-width="' + (p.lw || 0.5) + '" stroke-linejoin="miter"/>';
      return '<text x="' + p.x + '" y="' + p.y + '" font-size="' + (p.size || 10) + '" font-family="Helvetica, Arial, sans-serif"' + (p.bold ? ' font-weight="700"' : "") + (p.anchor === "m" ? ' text-anchor="middle"' : "") + ' fill="' + (p.color || "#000") + '">' + esc(p.s) + '</text>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + sc.w + " " + sc.h + '" width="100%" role="img" aria-label="The calibration strip with the four measurements">' + o.join("") + '</svg>';
  };
  var LEGEND = [
    ["1", "Overall length: from the outer edge of one end of the bar to the outer edge of the other end."],
    ["2", "Block span: from the left edge of the first block to the left edge of the last block. Both edges are on the same side, so the blade offset cancels out."],
    ["3", "Block width: across one block, halfway up its straight sides, away from the corners (the blade rounds corners)."],
    ["4", "Gap width: between two blocks near their tops, not next to a foot. Measure the same gap you used for 3, or several and take the mean."]
  ];
  var RULES = [
    "Measure the piece you keep (the positive shape), with a caliper, to 0.1 mm or better, after the film has been cut and weeded but not pressed.",
    "Simple method: measure only number 1 of one strip. The program then assumes there is no blade offset (the error is under 0.05 % for 480 mm and 0.1 mm).",
    "Vertical strips are the same strip turned 90 degrees clockwise: measure the same four things along the roll.",
    "Strips are in the order of the table below (horizontal ones from the top down, vertical ones from the left). Different lengths tell them apart."
  ];

  /* ---------- the entry tables and the results (shared by the Cutters window and the guide window) ---------- */
  var DIRS = { x: "Horizontal strips (across the roll)", y: "Vertical strips (along the roll)" };
  function tableHTML(c, dir) {
    var s = c.calib[dir], simple = s.mode === "simple", cols = simple ? ["outer"] : FIELDS;
    var head = '<tr><th>Strip</th><th>Length (mm)</th>' + cols.map(function (f, i) { return '<th title="' + esc(LEGEND[FIELDS.indexOf(f)][1]) + '">' + (FIELDS.indexOf(f) + 1) + " " + { outer: "Overall", span: "Span", block: "Block", gap: "Gap" }[f] + '</th>'; }).join("") + (simple ? '<th>Use</th>' : "") + '</tr>';
    var body = s.lengths.map(function (L, i) {
      var nom = { outer: L, span: FIT.spanNominal(L), block: FIT.BLOCK, gap: FIT.BLOCK };
      return '<tr><td>' + (i + 1) + '</td><td><input type="number" step="1" data-cr="' + dir + ':' + i + ':len" aria-label="Length of strip ' + (i + 1) + '"></td>' +
        cols.map(function (f) {
          return '<td><input type="number" step="0.01" data-cr="' + dir + ':' + i + ':' + f + '" aria-label="' + dir.toUpperCase() + ' strip ' + (i + 1) + ' ' + f + '" placeholder="' + (f === "span" ? '<span data-rn="' + dir + ':' + i + '"></span>' : nom[f]) + '">' +
            '<span class="calErr" data-re="' + dir + ':' + i + ':' + f + '"></span></td>';
        }).join("") +
        (simple ? '<td><input type="radio" name="use-' + dir + '" data-cm="' + dir + ':use" value="' + i + '" aria-label="Use strip ' + (i + 1) + '"></td>' : "") + '</tr>';
    }).join("");
    return '<table class="caltable" data-tbl="' + dir + '"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }
  function resultHTML(dir) {
    var l = dir === "x" ? "horizontal" : "vertical";
    return '<div class="calResult" data-dir="' + dir + '">' +
      '<div class="calnote small" data-ro="' + dir + ':note"></div>' +
      '<div class="row3"><label class="fld"><span>Correction factor ' + dir.toUpperCase() + '</span><input type="number" step="0.00001" data-cf="' + dir + ':factor" aria-label="Correction factor ' + l + '"></label>' +
      '<label class="fld"><span>Percent</span><input type="number" step="0.001" data-cf="' + dir + ':percent" aria-label="Correction percent ' + l + '"></label>' +
      '<label class="fld"><span>Millimetres over <b data-ro="' + dir + ':ref"></b> mm</span><input type="number" step="0.01" data-cf="' + dir + ':mm" aria-label="Correction millimetres ' + l + '"></label></div>' +
      '<div class="small" data-ro="' + dir + ':detail"></div></div>';
  }
  K.sideHTML = function (c, dir, withGuideNote) {
    var s = c.calib[dir];
    return '<h4 class="calh">' + DIRS[dir] + '</h4>' +
      '<div class="row2"><label class="fld"><span>Method</span><select data-cm="' + dir + ':mode" aria-label="Method ' + (dir === "x" ? "horizontal" : "vertical") + '"><option value="detail"' + (s.mode === "detail" ? " selected" : "") + '>Detailed (four measurements)</option><option value="simple"' + (s.mode === "simple" ? " selected" : "") + '>Simple (one overall length)</option></select></label><div></div></div>' +
      tableHTML(c, dir) + resultHTML(dir);
  };

  /* The numbers shown under the tables: filled in again after every change. */
  K.refresh = function () {
    var c = selected(); if (!c) return;
    var eff = K.effective(c), ae = document.activeElement;
    ["x", "y"].forEach(function (dir) {
      var s = c.calib[dir], fit = dir === "x" ? eff.fitX : eff.fitY, f = dir === "x" ? eff.fx : eff.fy, man = dir === "x" ? eff.manualX : eff.manualY, ref = refLen(c, dir), forms = FIT.forms(f, ref);
      document.querySelectorAll('[data-cr^="' + dir + ':"]').forEach(function (inp) {
        if (inp === ae) return;
        var p = inp.dataset.cr.split(":"), v = p[2] === "len" ? s.lengths[+p[1]] : s.rows[+p[1]][p[2]];
        inp.value = v === null || v === undefined ? "" : v;
      });
      document.querySelectorAll('[data-rn^="' + dir + ':"]').forEach(function (sp) { sp.textContent = FIT.spanNominal(s.lengths[+sp.dataset.rn.split(":")[1]]); });
      document.querySelectorAll('[data-cm="' + dir + ':use"]').forEach(function (r) { r.checked = +r.value === s.use; });
      document.querySelectorAll('[data-cm="' + dir + ':mode"]').forEach(function (sel) { if (sel !== ae) sel.value = s.mode; });
      document.querySelectorAll('[data-re^="' + dir + ':"]').forEach(function (sp) {
        var p = sp.dataset.re.split(":"), o = fit.obs.filter(function (q) { return q.strip === +p[1] && q.kind === p[2]; })[0];
        sp.textContent = o ? signed(o.err, 2) + " mm (" + signed(o.errPct, 2) + " %)" + (fit.n > 2 ? ", left " + signed(o.resid, 2) : "") : "";
      });
      var set = function (key, val) { document.querySelectorAll('[data-ro="' + dir + ':' + key + '"]').forEach(function (n) { n.textContent = val; }); };
      document.querySelectorAll('[data-cf^="' + dir + ':"]').forEach(function (inp) {
        if (inp === ae) return;
        var k = inp.dataset.cf.split(":")[1]; inp.value = k === "factor" ? r3(forms.factor * 1e5) / 1e5 : k === "percent" ? r3(forms.percent) : r3(forms.mm * 100) / 100;
      });
      set("ref", ref);
      set("note", man ? "The factor was typed by hand. “Use the measurements” brings the measured one back." : fit.n ? "From " + fit.n + " measurement" + (fit.n > 1 ? "s" : "") + " (" + (s.mode === "simple" ? "simple method" : "detailed method") + ")." : "No measurements yet: no correction (factor 1).");
      set("detail", (fit.n ? "Scale of the cutter " + fmt(fit.a, 5) + " (cuts " + signed((fit.a - 1) * 100, 3) + " % of the drawn size). " : "") + (fit.separated ? "Blade offset found: " + signed(fit.d, 3) + " mm per edge. " : "") + (fit.warn ? "Note: " + fit.warn : ""));
    });
    var sum = document.querySelectorAll("[data-ro='sum']");
    sum.forEach(function (n) { n.textContent = "Used by the exports: X factor " + fmt(eff.fx, 5) + ", Y factor " + fmt(eff.fy, 5) + ", blade offset " + signed(eff.kerf, 3) + " mm per edge" + (eff.kerfInfo.diff > 0.05 ? " (horizontal and vertical differ by " + fmt(eff.kerfInfo.diff, 2) + " mm: check the numbers)" : "") + "."; });
    document.querySelectorAll('[data-cf="kerf"]').forEach(function (inp) { if (inp !== ae) inp.value = r3(eff.kerf * 1000) / 1000; });
  };

  /* ---------- the Cutters window ---------- */
  K.panelHTML = function () {
    var core = C(), h = core.h, cs = list(), cur = K.current(), sel = selected();
    ui.sel = sel.id;
    var rows = cs.map(function (c, i) {
      var armed = ui.armed === c.id;
      return '<div class="cutrow' + (c.id === sel.id ? " on" : "") + '"><button type="button" class="selbtn" data-act="cutsel" data-id="' + c.id + '"><span class="ttl">' + esc(c.name) + '</span>' + (c === cur ? '<span class="small"> · used by this project</span>' : "") + '</button>' +
        '<button type="button" class="tbtn" data-act="cutup" data-id="' + c.id + '"' + (i === 0 ? ' disabled title="This is already the first cutter"' : ' title="Move up"') + ' aria-label="Move up">↑</button>' +
        '<button type="button" class="tbtn" data-act="cutdown" data-id="' + c.id + '"' + (i === cs.length - 1 ? ' disabled title="This is already the last cutter"' : ' title="Move down"') + ' aria-label="Move down">↓</button>' +
        '<button type="button" class="tbtn" data-act="cutdup" data-id="' + c.id + '" aria-label="Duplicate" title="Make a copy of this cutter">⧉</button>' +
        '<button type="button" class="tbtn' + (armed ? " warn" : "") + '" data-act="cutdel" data-id="' + c.id + '"' + (cs.length < 2 ? ' disabled title="There must be at least one cutter"' : (armed ? ' title="Click again to delete this cutter"' : ' title="Delete this cutter (click twice)"')) + ' aria-label="Delete">' + (armed ? "Sure?" : "✕") + '</button></div>';
    }).join("");
    var sc = "cutter:" + sel.id, scc = "cutcal:" + sel.id;
    return '<h3 class="sec">Cutters</h3><p class="small">The cutters you have. They are shared by all projects (they live in the settings); each project remembers which one it uses (Export tab). A cutter holds its size limits and its calibration: the correction that makes it cut true sizes.</p>' +
      '<div class="cutlist">' + rows + '</div>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="cutadd">+ Add cutter</button><button class="btn" type="button" data-act="jsonopen" data-part="cutters">Cutters JSON…</button><button class="btn" type="button" data-act="cutsave">Save cutters</button><button class="btn" type="button" data-act="cutopen">Open cutters</button></div>' +
      '<h3 class="sec">' + esc(sel.name) + '</h3>' +
      '<label class="fld"><span>Name</span><input type="text" data-scope="' + sc + '" data-key="name" autocomplete="off"></label>' +
      '<div class="row3">' + h.numField("Cutting width (mm, across the roll)", sc, "widthMm", "1") + h.numField("Longest cut (mm, 0 = no limit)", sc, "maxLengthMm", "1") + h.numField("Thinnest detail (mm)", sc, "thinMm", "0.1") + '</div>' +
      '<p class="small">The thinnest detail (0 = no check) is only used for a warning about thin lines, narrow outline gaps and small text when you scale a design down for cutting. The heat press area (for the “fit to the press” button in the Export tab):</p>' +
      '<div class="row2">' + h.numField("Heat press area (mm, square)", "cfg", "pressMm", "1") + '<div></div></div>' +
      '<h3 class="sec">Calibration</h3><p class="small">Cut the test strips, measure them and type the sizes below. The program works out the scale of the cutter in both directions, and the blade offset (kerf) when there are enough numbers. Without numbers nothing is corrected. The strips are stacked in one file; give the lengths in the order you want them.</p>' +
      '<div class="row3"><label class="fld"><span>Number of strips</span><select data-cm="count" aria-label="Number of strips">' + [2, 3, 4, 5, 6].map(function (n) { return '<option value="' + n + '"' + (sel.calib.x.lengths.length === n ? " selected" : "") + '>' + n + '</option>'; }).join("") + '</select></label>' +
      h.numField("Margin around the bitmaps (mm)", scc, "margin", "1") + '<div></div></div>' +
      '<div class="btnrow"><button class="btn gold" type="button" data-act="calibdl">Download calibration images (zip)</button><button class="btn" type="button" data-act="calguide">Open the measuring guide</button><button class="btn" type="button" data-act="calpdf">Download the measuring guide (PDF)</button></div>' +
      K.sideHTML(sel, "x") + K.sideHTML(sel, "y") +
      '<div class="row2"><label class="fld"><span>Blade offset (mm per edge; positive: pieces come out bigger)</span><input type="number" step="0.001" data-cf="kerf" aria-label="Blade offset"></label><div></div></div>' +
      '<p class="small" data-ro="sum"></p>' +
      '<div class="btnrow"><button class="btn" type="button" data-act="calauto">Use the measurements (drop typed corrections)</button><button class="btn" type="button" data-act="calreset">Clear all measurements</button></div>' +
      '<div class="msg" id="cutMsg" aria-live="polite"></div>';
  };

  /* ---------- the guide window and the PDF ---------- */
  K.guideHTML = function (c) {
    return '<div class="calguide"><h3>Measuring guide: ' + esc(c.name) + '</h3><p class="calwarn">Not to scale. Do not cut from this drawing: the real strips come from “Download calibration images”.</p>' +
      K.sceneSVG(K.guideScene()) +
      '<ol class="callegend">' + LEGEND.map(function (l) { return '<li><b>' + l[0] + '</b> ' + esc(l[1]) + '</li>'; }).join("") + '</ol>' +
      '<ul class="callegend">' + RULES.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join("") + '</ul>' +
      K.sideHTML(c, "x") + K.sideHTML(c, "y") + '<p class="small" data-ro="sum"></p></div>';
  };
  K.openGuide = function () {
    var c = selected(), modal = document.getElementById("modal"), bar = document.getElementById("modalBar"), body = document.getElementById("modalBody");
    bar.innerHTML = '<button class="btn" type="button" data-act="calpdf">Download the measuring guide (PDF)</button><button class="btn" type="button" data-sheet="close">Close</button>';
    body.innerHTML = K.guideHTML(c);
    modal.hidden = false; K.refresh();
  };
  K.pdf = function (c) {
    var A = PTD.pdf.A4, M = 36, ops = [], y = M + 6, sc = K.guideScene(), today = new Date().toISOString().slice(0, 10);
    ops.push({ t: "text", x: M, y: y + 8, s: "Cutter calibration: measuring guide", size: 16, bold: true });
    ops.push({ t: "text", x: M, y: y + 26, s: "Cutter: " + c.name + "    Date: " + today, size: 10 });
    ops.push({ t: "text", x: M, y: y + 42, s: "NOT TO SCALE - do not cut from this drawing. The real strips are in the calibration images zip.", size: 10, bold: true, color: RED });
    var oy = y + 54, ox = M;
    sc.ops.forEach(function (p) {
      if (p.t === "line") ops.push({ t: "line", x1: ox + p.x1, y1: oy + p.y1, x2: ox + p.x2, y2: oy + p.y2, w: p.w, color: p.color });
      else if (p.t === "poly") ops.push({ t: "poly", pts: p.pts.map(function (q) { return [ox + q[0], oy + q[1]]; }), fill: p.fill, stroke: p.stroke, lw: p.lw });
      else ops.push({ t: "text", x: ox + p.x - (p.anchor === "m" ? PTD.pdf.textWidth(p.s, p.size, p.bold) / 2 : 0), y: oy + p.y, s: p.s, size: p.size, bold: p.bold, color: p.color });
    });
    y = oy + sc.h + 10;
    function wrap(text, width, size) {
      var words = text.split(" "), lines = [], cur = "";
      words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (PTD.pdf.textWidth(t, size) > width && cur) { lines.push(cur); cur = w; } else cur = t; });
      if (cur) lines.push(cur);
      return lines;
    }
    LEGEND.forEach(function (l) {
      ops.push({ t: "text", x: M, y: y + 8, s: l[0], size: 10, bold: true, color: RED });
      wrap(l[1], A.w - 2 * M - 16, 9).forEach(function (ln, i) { ops.push({ t: "text", x: M + 14, y: y + 8 + i * 11, s: ln, size: 9 }); y += i ? 11 : 0; });
      y += 13;
    });
    y += 2;
    RULES.forEach(function (r) {
      wrap(r, A.w - 2 * M - 12, 9).forEach(function (ln, i) { ops.push({ t: "text", x: M + (i ? 12 : 0), y: y + 8, s: (i ? "" : "- ") + ln, size: 9 }); y += 11; });
    });
    y += 6;
    ["x", "y"].forEach(function (dir) {
      var s = c.calib[dir], cw = [40, 80, 90, 90, 90, 90], x = M;
      ops.push({ t: "text", x: M, y: y + 9, s: DIRS[dir], size: 10, bold: true }); y += 14;
      var heads = ["Strip", "Length (mm)", "1 Overall", "2 Span", "3 Block", "4 Gap"];
      heads.forEach(function (hd, i) { ops.push({ t: "rect", x: x, y: y, w: cw[i], h: 15, stroke: "#222", lw: 0.5, fill: "#e8e4d6" }); ops.push({ t: "text", x: x + 4, y: y + 11, s: hd, size: 9, bold: true }); x += cw[i]; });
      y += 15;
      s.lengths.forEach(function (L, i) {
        x = M;
        var nominal = [String(i + 1), String(L), "(" + L + ")", "(" + FIT.spanNominal(L) + ")", "(10)", "(10)"];
        nominal.forEach(function (t, j) { ops.push({ t: "rect", x: x, y: y, w: cw[j], h: 17, stroke: "#222", lw: 0.5 }); ops.push({ t: "text", x: x + 4, y: y + 12, s: t, size: j > 1 ? 8 : 9, color: j > 1 ? "#999999" : "#000000" }); x += cw[j]; });
        y += 17;
      });
      y += 10;
    });
    ops.push({ t: "text", x: M, y: y + 6, s: "Type the numbers into the Cutters window of Poker Table Designer. Grey numbers in brackets are the nominal sizes.", size: 8 });
    return PTD.pdf.build([{ w: A.w, h: A.h, ops: ops }], { title: "Cutter calibration measuring guide" });
  };

  /* ---------- events ---------- */
  function cmsg(t) { var m = document.getElementById("cutMsg"); if (m) m.textContent = t || ""; C().say(t); }
  function touch(c) { c.calib.date = new Date().toISOString().slice(0, 10); C().saveConfig(); }
  function onRow(t) {
    var c = selected(), p = t.dataset.cr.split(":"), dir = p[0], i = +p[1], f = p[2], s = c.calib[dir];
    if (!s || i >= s.lengths.length) return;
    if (f === "len") {
      var v = Number(t.value), lim = lengthLimits(c, dir);
      if (!isFinite(v) || t.value === "") return;
      s.lengths[i] = Math.max(1, Math.round(v * 10) / 10);
      if (v < lim.min || v > lim.max) cmsg("A strip length is between " + lim.min + " mm and " + lim.max + " mm (the cutting width across the roll, the longest cut along it).");
    } else {
      var n = Number(t.value); s.rows[i][f] = t.value === "" || !isFinite(n) || n <= 0 ? null : n;
      touch(c);
    }
    C().saveConfig(); K.refresh();
  }
  function onResult(t) {
    var c = selected(), p = t.dataset.cf.split(":"), v = Number(t.value);
    if (t.dataset.cf === "kerf") { c.calib.kerfOverride = t.value === "" || !isFinite(v) ? null : v; C().saveConfig(); K.refresh(); return; }
    if (t.value === "" || !isFinite(v)) return;
    var dir = p[0], s = c.calib[dir], ref = refLen(c, dir), f = p[1] === "factor" ? v : p[1] === "percent" ? FIT.fromPercent(v) : FIT.fromMm(v, ref);
    if (f > 0.5 && f < 2) { s.override = f; touch(c); C().saveConfig(); K.refresh(); }
  }
  function onChoice(t) {
    var c = selected(), d = t.dataset.cm;
    if (d === "count") {
      var n = Math.max(2, Math.min(6, +t.value));
      c.calib.x = normSide(Object.assign({}, c.calib.x, { lengths: c.calib.x.lengths.slice(0, n) }), c, "x", n);
      c.calib.y = normSide(Object.assign({}, c.calib.y, { lengths: c.calib.y.lengths.slice(0, n) }), c, "y", n);
      C().saveConfig(); C().renderPanels(); refreshGuide(); return;
    }
    var p = d.split(":"), s = c.calib[p[0]];
    if (p[1] === "mode") { s.mode = t.value === "simple" ? "simple" : "detail"; C().saveConfig(); C().renderPanels(); refreshGuide(); }
    else if (p[1] === "use") { s.use = +t.value; C().saveConfig(); K.refresh(); }
  }
  function refreshGuide() { var m = document.getElementById("modal"); if (m && !m.hidden && m.querySelector(".calguide")) { document.getElementById("modalBody").innerHTML = K.guideHTML(selected()); K.refresh(); } }
  document.addEventListener("input", function (e) {
    var t = e.target; if (!t.dataset) return;
    if (t.dataset.cr) onRow(t); else if (t.dataset.cf) onResult(t);
  });
  document.addEventListener("change", function (e) { var t = e.target; if (t.dataset && t.dataset.cm) onChoice(t); });

  K.act = function (act, d) {
    var core = C(), cfg = core.cfg(), cs = cfg.cutters, c, i;
    function done() { core.saveConfig(); core.renderPanels(); }
    switch (act) {
      case "cutsel": ui.sel = d.id; ui.armed = ""; core.renderPanels(); return true;
      case "cutadd": c = K.make(cs.length + 1); c.id = newId(); cs.push(c); ui.sel = c.id; done(); cmsg("Added “" + c.name + "”."); return true;
      case "cutdup": c = K.byId(d.id); if (c) { var cp = K.norm(JSON.parse(JSON.stringify(c)), cs.length); cp.id = newId(); cp.name = c.name + " copy"; cs.splice(cs.indexOf(c) + 1, 0, cp); ui.sel = cp.id; done(); } return true;
      case "cutdel":
        if (cs.length < 2) return true;
        if (ui.armed !== d.id) { ui.armed = d.id; core.renderPanels(); return true; }
        i = cs.indexOf(K.byId(d.id)); if (i >= 0) { cs.splice(i, 1); ui.sel = cs[Math.min(i, cs.length - 1)].id; } ui.armed = ""; done(); return true;
      case "cutup": case "cutdown":
        i = cs.indexOf(K.byId(d.id)); var j = act === "cutup" ? i - 1 : i + 1;
        if (i >= 0 && j >= 0 && j < cs.length) { var tmp = cs[i]; cs[i] = cs[j]; cs[j] = tmp; done(); } return true;
      case "cutsave": core.download("cutters.json", JSON.stringify(K.toJSON(), null, 1), "application/json"); cmsg("Saved cutters.json."); return true;
      case "cutopen": core.pickFile(document.getElementById("fileProject"), function (t) { var r = core.loadText(t); cmsg(r.msg); }); return true;
      case "calibdl": PTD.calibration.download(selected()); return true;
      case "calguide": K.openGuide(); return true;
      case "calpdf": core.download("calibration-measuring-guide.pdf", new Blob([K.pdf(selected())], { type: "application/pdf" }), "application/pdf"); cmsg("Saved calibration-measuring-guide.pdf."); return true;
      case "calauto": c = selected(); c.calib.x.override = null; c.calib.y.override = null; c.calib.kerfOverride = null; core.saveConfig(); K.refresh(); cmsg("Using the measured corrections."); return true;
      case "calreset":
        c = selected(); ["x", "y"].forEach(function (dir) { c.calib[dir].rows = c.calib[dir].lengths.map(function () { return { outer: null, span: null, block: null, gap: null }; }); c.calib[dir].override = null; });
        c.calib.kerfOverride = null; c.calib.date = ""; done(); cmsg("Measurements cleared: no correction."); return true;
    }
    return false;
  };
  /* actions pressed inside the guide window (it is outside the controls) */
  var modal = document.getElementById("modal");
  if (modal) modal.addEventListener("click", function (e) { var b = e.target.closest("[data-act]"); if (b && /^cal/.test(b.dataset.act)) K.act(b.dataset.act, b.dataset); });

  PTD.scopes = PTD.scopes || {}; PTD.onChange = PTD.onChange || {};
  PTD.scopes.cutter = function (id) { return K.byId(id); };
  PTD.scopes.cutcal = function (id) { var c = K.byId(id); return c ? c.calib : null; };
  PTD.onChange.cutter = function (o, key) {
    var c = o;
    if (key === "name" && !c.name) c.name = "Cutter";
    if (!(c.widthMm >= 0)) c.widthMm = 0;
    if (!(c.maxLengthMm >= 0)) c.maxLengthMm = 0;
    if (!(c.thinMm >= 0)) { c.thinMm = 0; C().syncInputs(); }   /* never below zero; 0 means no check */
    ["x", "y"].forEach(function (dir) { c.calib[dir] = normSide(c.calib[dir], c, dir, c.calib[dir].lengths.length); });
    C().saveConfig();
    document.querySelectorAll('.cutrow.on .ttl').forEach(function (n) { n.textContent = c.name; });
  };
  PTD.onChange.cutcal = function () { C().saveConfig(); };
  PTD.cutters = K;
})(window.PTD = window.PTD || {});
