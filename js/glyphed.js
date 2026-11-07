/* The glyph editor window (REQ-036): drop a picture (JPEG, PNG, WebP, GIF, BMP: whatever the browser reads) or an SVG file, see the
 * vector result at once, adjust the effects if the result is wrong, and use it as a glyph. The engine is tracer.js; the shapes are glyph.js.
 * Only the vector goes into the project, never the picture. The effect settings are kept in memory for the next picture. */
(function (PTD) {
  "use strict";
  var E = {}, dlg = null, el = {}, src = null, res = null, timer = 0, view = null, name = "Glyph";
  var WORK = 1200;   /* the picture is worked at this size at most (pixels on the longest side) */
  function C() { return PTD.core; }
  function defaults() { return { autoLevels: true, brightness: 0, contrast: 0, blur: 1, autoThr: true, threshold: 128, invert: "auto", speck: 12, grow: 0, tol: 0.8, corner: 55, mode: "picture", height: 150, hl: true, vcol: "bw" }; }
  var S = defaults();

  /* [key, kind, label, tooltip, min, max, step] */
  var FIELDS = [
    ["h", "1 · Levels"],
    ["autoLevels", "check", "Automatic levels", "Stretch the darkest and lightest parts of the picture to full black and white. Helps pale or grey pictures."],
    ["brightness", "range", "Brightness", "Make the picture lighter or darker before the black-and-white step.", -100, 100, 1],
    ["contrast", "range", "Contrast", "Push the greys towards black and white. More contrast gives a harder edge.", -100, 100, 1],
    ["h", "2 · Smudge"],
    ["blur", "range", "Blur (pixels)", "Blur the picture a little. It removes noise and the steps of the pixels, so the outline comes out round and smooth. Too much rounds off the details.", 0, 6, 0.1],
    ["h", "3 · Black and white"],
    ["autoThr", "check", "Automatic threshold", "Find the grey level that separates the shape from the paper by itself."],
    ["threshold", "range", "Threshold", "Everything darker than this grey level becomes the shape. Used when the automatic threshold is off.", 1, 254, 1],
    ["invert", "select", "Shape is", "Which part is the shape. Automatic takes the picture as a dark shape on a light ground, or the other way round when the edge of the picture is dark.", [["auto", "Automatic"], ["no", "The dark part"], ["yes", "The light part"]]],
    ["h", "4 · Clean-up"],
    ["speck", "range", "Detail: drop specks smaller than (px²)", "Small islands and small holes below this area are left out. A bigger number gives a simpler shape with fewer small details.", 0, 300, 1],
    ["grow", "range", "Thicken (+) or thin (−) (pixels)", "Make the shape thicker or thinner all round. Thin parts may not cut or weed well from vinyl.", -6, 6, 1],
    ["h", "Tracing"],
    ["tol", "range", "Smoothness (curve error, pixels)", "How far the curve may stray from the edge it follows. A bigger number gives fewer, smoother curves.", 0.2, 4, 0.1],
    ["corner", "range", "Corner angle (degrees)", "A place where the outline turns sharper than this stays a sharp corner; the rest is rounded. 180 means no sharp corners at all.", 20, 180, 5]
  ];

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function build() {
    dlg = document.createElement("div");
    dlg.className = "modal gedlg"; dlg.id = "glyphDlg"; dlg.hidden = true;
    dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-label", "Glyph editor");
    var ctl = FIELDS.map(function (f) {
      if (f[0] === "h") return '<h4 class="gedh">' + f[1] + '</h4>';
      var k = f[0], id = "ged_" + k;
      if (f[1] === "check") return '<label class="gedrow" title="' + esc(f[3]) + '"><input type="checkbox" id="' + id + '" data-k="' + k + '" title="' + esc(f[3]) + '"> <span>' + f[2] + '</span></label>';
      if (f[1] === "select") return '<label class="gedrow" title="' + esc(f[3]) + '"><span>' + f[2] + '</span><select id="' + id + '" data-k="' + k + '" title="' + esc(f[3]) + '">' + f[4].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join("") + '</select></label>';
      return '<label class="gedrow" title="' + esc(f[3]) + '"><span>' + f[2] + ' <output id="' + id + '_o"></output></span><input type="range" id="' + id + '" data-k="' + k + '" min="' + f[4] + '" max="' + f[5] + '" step="' + f[6] + '" title="' + esc(f[3]) + '"></label>';
    }).join("");
    dlg.innerHTML = '<div class="card gedcard">' +
      '<div class="bar">' +
      '<button class="btn" type="button" data-g="open" title="Choose a picture or SVG file. You can also drop a file on this window or paste a picture or SVG with Ctrl+V.">Open picture or SVG…</button>' +
      '<button class="btn" type="button" data-g="paste" title="Take a picture or SVG text from the clipboard. If the browser does not allow this, press Ctrl+V in this window.">Paste</button>' +
      '<button class="btn gold" type="button" data-g="use" title="Make a glyph from this result and put it on the cloth, at the height below.">Use as glyph</button>' +
      '<label class="gedh2" title="The height of the glyph on the cloth, in millimetres.">Height (mm) <input type="number" id="ged_height" data-k="height" min="5" max="3000" step="5" style="width:5.5em" title="The height of the glyph on the cloth, in millimetres. It also decides how coarse the picture is: the note below shows the size of one picture pixel."></label>' +
      '<button class="btn" type="button" data-g="savesvg" title="Save this result as an SVG file.">Save SVG</button>' +
      '<button class="btn" type="button" data-g="copysvg" title="Copy this result to the clipboard as SVG text.">Copy SVG</button>' +
      '<button class="btn" type="button" data-g="reset" title="Put all the effects back to their ready-made values.">Reset effects</button>' +
      '<button class="btn" type="button" data-g="close" title="Close the glyph editor.">Close</button></div>' +
      '<div class="gedbody"><div class="gedview"><div class="gedmodes" role="group" aria-label="What the preview shows">' +
      '<label title="Show the picture as it was opened, with the vector outline over it."><input type="radio" name="gedmode" value="picture"> Picture</label>' +
      '<label title="Show the picture after the effects (what the tracer sees), with the vector outline over it."><input type="radio" name="gedmode" value="effects"> After effects</label>' +
      '<label title="Show only the filled vector shape."><input type="radio" name="gedmode" value="vector"> Vector only</label>' +
      '<label title="The colours of the Vector only view. Black and white shows the shape black on white paper. On the table shows it as it will look on the cloth: the glyph colour on the cloth colour."><select id="ged_vcol" data-k="vcol" title="The colours of the Vector only view. Black and white shows the shape black on white paper. On the table shows it as it will look on the cloth."><option value="bw">Black and white</option><option value="table">On the table</option></select></label>' +
      '<label title="Draw slowly moving diagonal stripes over the inside of the shape that invert the colours under them, so it is clear which part is the shape (inside) and which is the background (outside)."><input type="checkbox" id="ged_hl" data-k="hl"> Highlight shape (inside)</label>' +
      '<button class="btn" type="button" data-g="swap" title="Swap inside and outside: the part that is now the shape becomes the background, and the other way round. Use it when the result is the wrong way round.">Swap inside and outside</button>' +
      '<button class="btn" type="button" data-g="fit" title="Fit the whole picture in the view.">Fit</button>' +
      '<button class="btn" type="button" data-g="zin" title="Zoom in. The mouse wheel zooms too, and dragging moves the picture.">+</button>' +
      '<button class="btn" type="button" data-g="zout" title="Zoom out.">−</button></div>' +
      '<svg id="gedSvg" class="gedsvg" xmlns="http://www.w3.org/2000/svg" aria-label="Preview"><defs><pattern id="gedHatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)"><g id="gedHatchG"><line id="gedHl1" x1="0" y1="-5" x2="0" y2="15" stroke="#ffffff" stroke-width="2"/><line id="gedHl2" x1="10" y1="-5" x2="10" y2="15" stroke="#ffffff" stroke-width="2"/><animateTransform id="gedAnim" attributeName="transform" type="translate" from="0 0" to="10 0" dur="2.5s" repeatCount="indefinite"/></g></pattern></defs><rect id="gedPaper" fill="#ffffff"/><image id="gedImg" preserveAspectRatio="none"/><path id="gedPath" fill-rule="evenodd"/><path id="gedHat" fill-rule="evenodd" fill="url(#gedHatch)" stroke="none" pointer-events="none" style="mix-blend-mode:difference"/></svg>' +
      '<div class="gedhelp" id="gedHelp">The <b>inside</b> is the shape: that part will be cut or printed. The <b>outside</b> is the background and stays empty. Holes inside the shape are outside too. If the result is the wrong way round, press <b>Swap inside and outside</b>.</div><div class="gedinfo" id="gedInfo" aria-live="polite">Drop a picture here, or press Open picture or SVG. Best are pictures with high contrast: a dark shape on a light ground.</div></div>' +
      '<div class="gedctl" id="gedCtl">' + ctl + '</div></div>' +
      '<input type="file" id="gedFile" accept="image/*,.svg" hidden aria-label="Choose a picture or SVG file">' +
      '</div>';
    document.body.appendChild(dlg);
    ["Svg", "Img", "Path", "Paper", "Info", "Ctl", "File", "Hat"].forEach(function (k) { el[k] = dlg.querySelector("#ged" + k); });
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) { E.close(); return; }
      var b = e.target.closest("[data-g]"); if (!b) return;
      var k = b.dataset.g;
      if (k === "open") el.File.click();
      else if (k === "paste") E.pasteNow();
      else if (k === "use") E.use();
      else if (k === "savesvg") { var t = svgText(); if (t) C().download((name.replace(/[^\w.-]+/g, "-") || "glyph") + ".svg", t, "image/svg+xml"); }
      else if (k === "copysvg") { var t2 = svgText(); if (t2) PTD.glyphui.copy(t2); }
      else if (k === "reset") { S = Object.assign(defaults(), { height: S.height, hl: S.hl, vcol: S.vcol }); sync(); schedule(0); }
      else if (k === "close") E.close();
      else if (k === "swap") swap();
      else if (k === "fit") fit();
      else if (k === "zin") zoom(1.5, null); else if (k === "zout") zoom(1 / 1.5, null);
    });
    el.File.addEventListener("change", function () { var f = el.File.files && el.File.files[0]; if (f) E.loadFile(f); el.File.value = ""; });
    dlg.addEventListener("input", function (e) {
      var n = e.target; if (!n.dataset || !n.dataset.k) return;
      var k = n.dataset.k, v = n.type === "checkbox" ? n.checked : n.type === "range" || n.type === "number" ? Number(n.value) : n.value;
      if (n.type === "number" && !(v > 0)) return;
      S[k] = v; sync(); schedule(k === "height" ? 0 : 90);
    });
    dlg.addEventListener("change", function (e) { var n = e.target; if (n && n.name === "gedmode") { S.mode = n.value; draw(); } });
    dlg.addEventListener("input", function (e) { var n = e.target; if (n && (n.id === "ged_hl" || n.id === "ged_vcol")) draw(); });
    /* drop a file, paste a picture */
    function hasFiles(e) { var t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, "Files") >= 0; }
    ["dragenter", "dragover"].forEach(function (ev) { dlg.addEventListener(ev, function (e) { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; dlg.classList.add("dragover"); }); });
    dlg.addEventListener("dragleave", function (e) { if (e.target === dlg || !dlg.contains(e.relatedTarget)) dlg.classList.remove("dragover"); });
    dlg.addEventListener("drop", function (e) { if (!hasFiles(e)) return; e.preventDefault(); dlg.classList.remove("dragover"); var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) E.loadFile(f); });
    /* Ctrl+V anywhere while the editor is open (the focus may be on the preview or a slider): a picture or SVG text is taken in.
     * The document listener runs first and stops the page's own paste handler (glyphui) from adding a glyph to the cloth too. */
    document.addEventListener("paste", function (e) {
      if (!dlg || dlg.hidden) return;
      var cd = e.clipboardData; if (!cd) return;
      var t = e.target, typing = t && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && t.type === "text") || t.isContentEditable);
      if (typing) return;
      e.preventDefault(); e.stopPropagation();
      for (var i = 0; i < cd.items.length; i++) if (cd.items[i].kind === "file" && /^image\//.test(cd.items[i].type)) { E.loadFile(cd.items[i].getAsFile()); return; }
      var tx = cd.getData("text/plain") || "";
      if (/<svg[\s>]/i.test(tx)) E.loadSVGText(tx, "Pasted SVG");
      else info("The clipboard has no picture or SVG text. Copy a picture or SVG text first, then press Ctrl+V here.");
    }, true);
    /* the Paste button: reads the clipboard itself when the browser allows it */
    E.pasteNow = function () {
      var blocked = function () { info("The browser did not allow reading the clipboard from a button. Press Ctrl+V in this window instead."); };
      if (!navigator.clipboard) { blocked(); return; }
      var viaText = function () {
        if (!navigator.clipboard.readText) { blocked(); return; }
        navigator.clipboard.readText().then(function (tx) {
          if (/<svg[\s>]/i.test(tx || "")) E.loadSVGText(tx, "Pasted SVG"); else info("The clipboard has no SVG text. For a picture press Ctrl+V in this window.");
        }, blocked);
      };
      if (!navigator.clipboard.read) { viaText(); return; }
      navigator.clipboard.read().then(function (items) {
        var chain = Promise.resolve(false);
        items.forEach(function (it) {
          chain = chain.then(function (done) {
            if (done) return true;
            var img = it.types.filter(function (ty) { return /^image\//.test(ty); })[0];
            if (img) return it.getType(img).then(function (b) { E.loadFile(new File([b], "Pasted picture", { type: img })); return true; });
            if (it.types.indexOf("text/plain") >= 0) return it.getType("text/plain").then(function (b) { return b.text(); }).then(function (tx) { if (/<svg[\s>]/i.test(tx)) { E.loadSVGText(tx, "Pasted SVG"); return true; } return false; });
            return false;
          });
        });
        return chain.then(function (done) { if (!done) info("The clipboard has no picture or SVG text."); });
      }, viaText);
    };
    /* pan and zoom of the preview */
    var drag = null;
    el.Svg.addEventListener("wheel", function (e) { if (!view) return; e.preventDefault(); zoom(e.deltaY < 0 ? 1.25 : 0.8, e); }, { passive: false });
    el.Svg.addEventListener("pointerdown", function (e) { if (!view) return; drag = { x: e.clientX, y: e.clientY, v: Object.assign({}, view) }; el.Svg.setPointerCapture(e.pointerId); });
    el.Svg.addEventListener("pointermove", function (e) {
      if (!drag) return; var r = el.Svg.getBoundingClientRect(), k = drag.v.w / r.width;
      view.x = drag.v.x - (e.clientX - drag.x) * k; view.y = drag.v.y - (e.clientY - drag.y) * k; applyView();
    });
    el.Svg.addEventListener("pointerup", function () { drag = null; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && dlg && !dlg.hidden) { e.preventDefault(); e.stopPropagation(); E.close(); } }, true);
    sync();
  }

  /* ---------- view ---------- */
  var box = null;   /* the box of the thing shown: { w, h } in preview units */
  function fit() {
    if (!box) return; var r = el.Svg.getBoundingClientRect(), ar = r.width / Math.max(1, r.height), m = Math.max(box.w, box.h) * 0.04;
    var w = box.w + 2 * m, h = box.h + 2 * m;
    if (w / h < ar) { var nw = h * ar; view = { x: box.x - m - (nw - w) / 2, y: box.y - m, w: nw, h: h }; } else { var nh = w / ar; view = { x: box.x - m, y: box.y - m - (nh - h) / 2, w: w, h: nh }; }
    applyView();
  }
  function applyView() { if (view) { el.Svg.setAttribute("viewBox", view.x + " " + view.y + " " + view.w + " " + view.h); hatchScale(); } }
  /* the stripes keep the same size on the screen at every zoom; they stand still when the system asks for less motion */
  function hatchScale() {
    if (!view || !dlg) return;
    var r = el.Svg.getBoundingClientRect(), u = view.w / Math.max(50, r.width), W = 9 * u, pat = dlg.querySelector("#gedHatch");
    pat.setAttribute("width", W); pat.setAttribute("height", W);
    ["gedHl1", "gedHl2"].forEach(function (id, i) { var l = dlg.querySelector("#" + id); l.setAttribute("x1", i * W); l.setAttribute("x2", i * W); l.setAttribute("y1", -W / 2); l.setAttribute("y2", W * 1.5); l.setAttribute("stroke-width", 1.6 * u); });
    var an = dlg.querySelector("#gedAnim"); an.setAttribute("to", W + " 0");
    var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    an.setAttribute("dur", calm ? "100000s" : "2.5s");
  }
  function swap() {
    if (!res) { info("There is no picture yet. Open one first."); return; }
    if (src && src.kind !== "bitmap") { info("An SVG file has no inside and outside to swap: it is used as it is."); return; }
    var nowInv = S.invert === "yes" || (S.invert === "auto" && res.inverted);
    S.invert = nowInv ? "no" : "yes"; sync(); schedule(0);
  }
  function zoom(f, e) {
    if (!view) return; var r = el.Svg.getBoundingClientRect(), fx = e ? (e.clientX - r.left) / r.width : 0.5, fy = e ? (e.clientY - r.top) / r.height : 0.5;
    var cx = view.x + view.w * fx, cy = view.y + view.h * fy;
    view.w /= f; view.h /= f; view.x = cx - view.w * fx; view.y = cy - view.h * fy; applyView();
  }

  /* ---------- the controls ---------- */
  function sync() {
    FIELDS.forEach(function (f) {
      if (f[0] === "h") return; var n = dlg.querySelector("#ged_" + f[0]); if (!n) return;
      if (f[1] === "check") n.checked = !!S[f[0]]; else n.value = S[f[0]];
      var o = dlg.querySelector("#ged_" + f[0] + "_o"); if (o) o.textContent = S[f[0]];
    });
    dlg.querySelector("#ged_height").value = S.height;
    dlg.querySelector("#ged_hl").checked = !!S.hl; dlg.querySelector("#ged_vcol").value = S.vcol;
    dlg.querySelector("#ged_threshold").disabled = !!S.autoThr || !src || src.kind !== "bitmap";
    var bmp = !!src && src.kind === "bitmap";
    el.Ctl.querySelectorAll("input,select").forEach(function (n) { if (n.id !== "ged_threshold") n.disabled = !bmp; });
    el.Ctl.classList.toggle("off", !bmp);
    Array.prototype.forEach.call(dlg.querySelectorAll('input[name="gedmode"]'), function (r) { r.checked = r.value === S.mode; r.disabled = !src || (src.kind === "svg" && r.value !== "vector"); });
  }
  function opts() {
    return { levels: { auto: S.autoLevels, brightness: S.brightness, contrast: S.contrast }, blur: S.blur, threshold: S.autoThr ? null : S.threshold,
      invert: S.invert === "auto" ? "auto" : S.invert === "yes", speck: S.speck, grow: S.grow, tol: S.tol, cornerDeg: S.corner, maxSide: WORK };
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(run, ms); }

  /* ---------- loading ---------- */
  E.loadSVGText = function (text, nm) {
    build_();
    var r; try { r = PTD.glyph.fromSVG(text); } catch (e) { info("The SVG could not be used: " + (e && e.message || "error")); return false; }
    src = { kind: "svg", text: text }; name = (nm || "SVG").replace(/\.svg$/i, ""); res = { shape: r.shape, notes: r.notes };
    S.mode = "vector"; sync(); draw(true); return true;
  };
  E.loadRGBA = function (w, h, rgba, nm) {
    build_(); src = { kind: "bitmap", w: w, h: h, rgba: rgba }; name = (nm || "Picture").replace(/\.[a-z0-9]+$/i, "");
    var c = document.createElement("canvas"); c.width = w; c.height = h; var id = new ImageData(new Uint8ClampedArray(rgba), w, h); c.getContext("2d").putImageData(id, 0, 0);
    src.url = c.toDataURL("image/png"); if (S.mode === "vector" && res && res.shape) S.mode = "picture";
    sync(); run(true); return true;
  };
  E.loadFile = function (f) {
    build_(); if (!f) return false;
    if (/svg/i.test(f.type) || /\.svg$/i.test(f.name || "")) {
      var rd = new FileReader(); rd.onerror = function () { info("That file could not be read."); }; rd.onload = function () { E.loadSVGText(String(rd.result), f.name || "SVG"); }; rd.readAsText(f); return true;
    }
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () {
      var w = im.naturalWidth, h = im.naturalHeight, big = Math.max(w, h), k = big > 2400 ? 2400 / big : 1, cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
      var c = document.createElement("canvas"); c.width = cw; c.height = ch; var cx = c.getContext("2d"); cx.drawImage(im, 0, 0, cw, ch);
      var d = cx.getImageData(0, 0, cw, ch); URL.revokeObjectURL(url);
      E.loadRGBA(cw, ch, d.data, f.name || "Picture");
      src.origW = w; src.origH = h;
    };
    im.onerror = function () { URL.revokeObjectURL(url); info("The browser could not read that file as a picture. JPEG, PNG, WebP, GIF, BMP and SVG are the usual ones."); };
    im.src = url; return true;
  };

  /* ---------- running and drawing ---------- */
  function info(t) { build_(); el.Info.textContent = t; }
  function run(first) {
    if (!src || src.kind !== "bitmap") return;
    var t0 = Date.now();
    try { res = PTD.tracer.process({ w: src.w, h: src.h, rgba: src.rgba }, opts()); } catch (e) { res = null; info("The picture could not be traced: " + (e && e.message || "error")); return; }
    res.ms = Date.now() - t0; draw(first);
  }
  function inkURL() {
    if (!res || !res.ink) return "";
    var c = document.createElement("canvas"); c.width = res.w; c.height = res.h; var id = c.getContext("2d").createImageData(res.w, res.h), n = res.w * res.h;
    for (var i = 0; i < n; i++) { var v = 255 - Math.round(res.ink[i]); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    c.getContext("2d").putImageData(id, 0, 0); return c.toDataURL("image/png");
  }
  function draw(first) {
    if (!res) return;
    var bmp = src && src.kind === "bitmap", d, w, h, x = 0, y = 0;
    if (bmp) { w = res.w; h = res.h; d = PTD.glyph.pathD(res.contours); }
    else { var s = res.shape; d = s.d; x = s.x0; y = s.y0; w = s.x1 - s.x0; h = s.y1 - s.y0; }
    var nb = !box || box.w !== w || box.h !== h || box.x !== x || box.y !== y; box = { x: x, y: y, w: w, h: h };
    el.Paper.setAttribute("x", x); el.Paper.setAttribute("y", y); el.Paper.setAttribute("width", w); el.Paper.setAttribute("height", h);
    var mode = S.mode, pic = bmp && mode !== "vector";
    el.Img.setAttribute("x", x); el.Img.setAttribute("y", y); el.Img.setAttribute("width", w); el.Img.setAttribute("height", h);
    el.Img.style.display = pic ? "" : "none";
    if (pic) { var url = mode === "effects" ? inkURL() : src.url; el.Img.setAttribute("href", url); el.Img.setAttributeNS("http://www.w3.org/1999/xlink", "href", url); }
    el.Path.setAttribute("d", d);
    var hl = !!S.hl, table = S.vcol === "table", cs = C().state();
    el.Hat.setAttribute("d", hl ? d : "");
    if (pic) { el.Path.setAttribute("fill", hl ? "none" : "rgba(255,60,60,0.18)"); el.Path.setAttribute("stroke", "#e0201a"); el.Path.setAttribute("stroke-width", "1.5"); el.Path.setAttribute("vector-effect", "non-scaling-stroke"); el.Paper.setAttribute("fill", "#ffffff"); }
    else {
      el.Path.setAttribute("fill", table ? C().colorHex("gold") : "#111"); el.Path.setAttribute("stroke", "none");
      el.Paper.setAttribute("fill", table ? C().colorHex(cs.cloth.color) : "#ffffff");
    }
    if (first || nb || !view) fit();
    var msg;
    if (bmp) {
      var mmPx = S.height / res.h;
      msg = res.stats.kept + " outlines, " + res.stats.nodes + " curve pieces, " + res.ms + " ms. " + (res.inverted ? "The light part is the shape. " : "") +
        "At " + S.height + " mm high one picture pixel is " + (Math.round(mmPx * 100) / 100) + " mm" + (mmPx > 1.2 ? ": the picture is small for this size, so fine details will be rough." : ".");
      if (!res.contours.length) msg = "Nothing was found. Try the Shape is choice, the threshold or a smaller speck size.";
    } else msg = "SVG: the vector is shown as it will be used." + (res.notes && res.notes.length ? " Note: " + res.notes.join("; ") + "." : "");
    info(msg);
  }
  function shapeNow() {
    if (!res) throw new Error("There is no picture yet. Open one first.");
    if (src && src.kind === "svg") return res.shape;
    return PTD.glyph.shapeOf(res.contours);
  }
  function svgText() {
    try { var s = shapeNow(); return PTD.glyph.toSVG(s, { colour: "#000000", sizeMm: S.height }); } catch (e) { info(e.message); return ""; }
  }
  E.use = function () {
    var s; try { s = shapeNow(); } catch (e) { info(e.message || "Nothing to use."); return false; }
    C().addGlyph(s, name || "Glyph", { size: S.height });
    C().say("Added the glyph “" + (name || "Glyph") + "” (" + S.height + " mm high)."); E.close(); return true;
  };

  function build_() { if (!dlg) build(); }
  E.open = function () { build_(); dlg.hidden = false; sync(); if (res) draw(true); dlg.querySelector('[data-g="open"]').focus(); };
  E.isOpen = function () { return !!dlg && !dlg.hidden; };
  E.close = function () { if (dlg) dlg.hidden = true; };
  E.isOpen = function () { return !!dlg && !dlg.hidden; };
  E.state = function () { return { S: S, hasPicture: !!src, kind: src && src.kind, res: res }; };
  E.settings = function () { return S; };
  PTD.glyphed = E;
})(window.PTD = window.PTD || {});
