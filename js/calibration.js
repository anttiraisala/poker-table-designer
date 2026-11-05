/* Calibration images: test strips that are cut to find the real scale error and the blade offset of a cutter.
 * The strip is a 10 mm bar, across the roll, with 10 x 10 mm blocks at every even centimetre (0, 20, 40 ...) and a
 * 15 x 5 mm foot at 0, 100, 200 ... (the foot reaches 5 mm to the right of its block, which also shows which end is
 * the left one). It is exported horizontally (across the roll) and vertically (along the roll) as SVG (filled and
 * hairline outline), as EPS for Roland CutStudio and as black and white PNG and JPG at 300 and 254 dpi, all in one zip file. Nothing here is part of
 * the project; the strip lengths and the margin belong to the cutter (js/cutters.js). Several strips of different
 * lengths are made in one file: across the roll (horizontal) they are stacked along the roll, along the roll (vertical)
 * they stand side by side across it, in the order of the lengths given, with a 20 mm gap. */
(function (PTD) {
  "use strict";
  var K = {};
  var C = function () { return PTD.core; };
  var BAR = 10, BLOCK = 10, FOOT_W = 15, FOOT_H = 5, PITCH = 20, MAJOR = 100, TOP = 10;   /* TOP: the height of the marks above the bar */
  K.DPIS = [300, 254];

  function r3(v) { return Math.round(v * 1000) / 1000; }
  K.GAP = 20;
  /* The strip lengths and the bitmap margin of a cutter. */
  K.settings = function (cutter) {
    var cal = (cutter && cutter.calib) || {}, mar = Number(cal.margin);
    function lens(d) { var a = cal[d] && cal[d].lengths; return Array.isArray(a) && a.length ? a.map(Number).filter(isFinite) : [480]; }
    return { x: lens("x"), y: lens("y"), marginMm: isFinite(mar) ? Math.max(0, Math.min(50, mar)) : 5 };
  };

  /* The outline of the horizontal strip as one closed polygon, in millimetres, y down. The bar is at the bottom, the marks above. */
  K.polygon = function (L) {
    var segs = [];   /* [x0, x1, height above the bar] */
    for (var c = 0; c + BLOCK <= L + 1e-9; c += PITCH) {
      segs.push([c, c + BLOCK, BLOCK]);
      if (c % MAJOR === 0 && c + FOOT_W <= L + 1e-9) segs.push([c + BLOCK, c + FOOT_W, FOOT_H]);
    }
    var yBar = TOP, yBottom = TOP + BAR, pts = [[0, yBottom]], cur = 0, lastH = 0;
    function atHeight(x, h) {
      var y = yBar - h;
      pts.push([x, yBar - lastH]); pts.push([x, y]); lastH = h;
    }
    segs.forEach(function (s) {
      if (s[0] > cur + 1e-9) { if (lastH !== 0) atHeight(cur, 0); }
      if (s[2] !== lastH || s[0] > cur + 1e-9) atHeight(s[0], s[2]);
      cur = s[1];
    });
    if (lastH !== 0) atHeight(cur, 0);
    pts.push([L, yBar]); pts.push([L, yBottom]);
    /* the first point is the start of the bar; remove consecutive duplicates and points on a straight line */
    var out = [];
    pts.forEach(function (p) { var q = out[out.length - 1]; if (!q || Math.abs(q[0] - p[0]) > 1e-9 || Math.abs(q[1] - p[1]) > 1e-9) out.push(p); });
    return out.filter(function (p, i) {
      var a = out[(i + out.length - 1) % out.length], b = out[(i + 1) % out.length];
      return !((Math.abs(a[0] - p[0]) < 1e-9 && Math.abs(p[0] - b[0]) < 1e-9) || (Math.abs(a[1] - p[1]) < 1e-9 && Math.abs(p[1] - b[1]) < 1e-9));
    });
  };
  /* The strip in one orientation: { pts, w, h } in millimetres. Vertical = the horizontal strip turned 90 degrees clockwise
   * (the marks point to the right). */
  K.shape = function (orientation, L) {
    var pts = K.polygon(L), H = TOP + BAR;
    var out = orientation === "vertical" ? { pts: pts.map(function (p) { return [r3(H - p[1]), r3(p[0])]; }), w: H, h: L } : { pts: pts.map(function (p) { return [r3(p[0]), r3(p[1])]; }), w: L, h: H };
    out.rings = [out.pts];
    return out;
  };
  /* Several strips in one drawing: horizontal ones stacked top to bottom, vertical ones side by side, GAP apart. */
  K.combine = function (orientation, lengths) {
    var rings = [], w = 0, h = 0, pos = 0;
    lengths.forEach(function (L) {
      var sh = K.shape(orientation, L), dx = orientation === "vertical" ? pos : 0, dy = orientation === "vertical" ? 0 : pos;
      rings.push(sh.pts.map(function (p) { return [r3(p[0] + dx), r3(p[1] + dy)]; }));
      if (orientation === "vertical") { pos += sh.w + K.GAP; w = pos - K.GAP; h = Math.max(h, sh.h); }
      else { pos += sh.h + K.GAP; h = pos - K.GAP; w = Math.max(w, sh.w); }
    });
    return { rings: rings, pts: rings[0], w: w, h: h };
  };
  function pathD(rings) { return rings.map(function (pts) { return "M" + pts.map(function (p) { return p[0] + " " + p[1]; }).join("L") + "Z"; }).join(""); }
  K.svg = function (shape, outline) {
    var body = outline ? '<path d="' + pathD(shape.rings) + '" fill="none" stroke="#000" stroke-width="0.01" stroke-linejoin="miter"/>'
      : '<path d="' + pathD(shape.rings) + '" fill="#000" stroke="none"/>';
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + shape.w + 'mm" height="' + shape.h + 'mm" viewBox="0 0 ' + shape.w + ' ' + shape.h + '">\n' + body + '\n</svg>\n';
  };

  /* ---------- bytes ---------- */
  var crcTable = null;
  function crc32(u8, crc) {
    if (!crcTable) { crcTable = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; } }
    var x = (crc === undefined ? 0 : crc) ^ 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) x = crcTable[(x ^ u8[i]) & 0xFF] ^ (x >>> 8);
    return (x ^ 0xFFFFFFFF) >>> 0;
  }
  function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
  function u16(n) { return [n & 255, (n >>> 8) & 255]; }
  /* A zip file without compression (the files are already small or compressed). */
  K.zip = function (files) {
    var chunks = [], central = [], offset = 0, enc = new TextEncoder(), now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = f.data, crc = crc32(data);
      var local = [].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      chunks.push(new Uint8Array(local), name, data);
      central.push({ name: name, crc: crc, size: data.length, offset: offset });
      offset += local.length + name.length + data.length;
    });
    var cdStart = offset, cdSize = 0;
    central.forEach(function (e) {
      var h = [].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate), u32(e.crc), u32(e.size), u32(e.size), u16(e.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(e.offset));
      chunks.push(new Uint8Array(h), e.name); cdSize += h.length + e.name.length;
    });
    chunks.push(new Uint8Array([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(central.length), u16(central.length), u32(cdSize), u32(cdStart), u16(0))));
    return new Blob(chunks, { type: "application/zip" });
  };

  /* ---------- bitmaps ---------- */
  /* Draws the shape on a white canvas (margin around it) and turns every pixel into exactly black or exactly white. */
  K.canvas = function (shape, dpi, marginMm) {
    var ppm = dpi / 25.4, W = Math.round((shape.w + 2 * marginMm) * ppm), H = Math.round((shape.h + 2 * marginMm) * ppm);
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#000";
    shape.rings.forEach(function (pts) {
      ctx.beginPath();
      pts.forEach(function (p, i) { var x = (p[0] + marginMm) * ppm, y = (p[1] + marginMm) * ppm; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath(); ctx.fill();
    });
    var img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (var i = 0; i < d.length; i += 4) { var v = d[i] < 128 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return cv;
  };
  function blobOf(cv, type, q) { return new Promise(function (res) { cv.toBlob(res, type, q); }); }
  function bytesOf(blob) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(new Uint8Array(fr.result)); }; fr.readAsArrayBuffer(blob); }); }
  /* The dpi is written into the file so that a viewer or cutter program shows the real size (PNG pHYs, JPEG JFIF density). */
  function pngWithDpi(bytes, dpi) {
    var ppm = Math.round(dpi / 0.0254), data = [].concat(u32(ppm).reverse(), u32(ppm).reverse(), [1]);
    var typeAndData = new Uint8Array([0x70, 0x48, 0x59, 0x73].concat(data));
    var chunk = new Uint8Array([].concat(u32(9).reverse(), Array.prototype.slice.call(typeAndData), u32(crc32(typeAndData)).reverse()));
    var at = 8 + 8 + 13 + 4;   /* signature, IHDR length and type, IHDR data, IHDR crc */
    var out = new Uint8Array(bytes.length + chunk.length);
    out.set(bytes.subarray(0, at), 0); out.set(chunk, at); out.set(bytes.subarray(at), at + chunk.length);
    return out;
  }
  function jpegWithDpi(bytes, dpi) {
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF && bytes[3] === 0xE0 && bytes[6] === 0x4A && bytes[7] === 0x46) {   /* "JFIF" */
      bytes[13] = 1; bytes[14] = (dpi >> 8) & 255; bytes[15] = dpi & 255; bytes[16] = (dpi >> 8) & 255; bytes[17] = dpi & 255;
    }
    return bytes;
  }

  /* All files for one cutter as { name, data: Uint8Array }. */
  K.build = function (cutter) {
    var s = K.settings(cutter), enc = new TextEncoder(), files = [], jobs = [];
    [["horizontal", s.x], ["vertical", s.y]].forEach(function (pair) {
      var o = pair[0], shape = K.combine(o, pair[1]);
      files.push({ name: "calibration-" + o + "-filled.svg", data: enc.encode(K.svg(shape, false)) });
      files.push({ name: "calibration-" + o + "-outline.svg", data: enc.encode(K.svg(shape, true)) });
      /* EPS for Roland CutStudio (lines only, see eps.js); the file is the strips themselves, so it has no dpi */
      var eps = PTD.eps.build(shape.rings.map(function (r) { return { pts: r, closed: true }; }));
      files.push({ name: "calibration-" + o + ".eps", data: enc.encode(eps.text) });
      K.DPIS.forEach(function (dpi) {
        var cv = K.canvas(shape, dpi, s.marginMm);
        jobs.push(blobOf(cv, "image/png").then(bytesOf).then(function (b) { files.push({ name: "calibration-" + o + "-" + dpi + "dpi.png", data: pngWithDpi(b, dpi) }); }));
        jobs.push(blobOf(cv, "image/jpeg", 0.95).then(bytesOf).then(function (b) { files.push({ name: "calibration-" + o + "-" + dpi + "dpi.jpg", data: jpegWithDpi(b, dpi) }); }));
      });
    });
    return Promise.all(jobs).then(function () { files.sort(function (a, b) { return a.name < b.name ? -1 : 1; }); return files; });
  };
  K.download = function (cutter) {
    var core = C();
    core.say("Making the calibration images ...");
    return K.build(cutter).then(function (files) {
      core.download("calibration-images.zip", K.zip(files), "application/zip");
      core.say("Calibration images: " + files.length + " files in calibration-images.zip");
    });
  };
  PTD.calibration = K;
})(window.PTD = window.PTD || {});
