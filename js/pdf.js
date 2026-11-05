/* A very small PDF writer (vector lines, polygons and text in the standard fonts, no libraries). It is used for the
 * calibration measuring guide. Also runs in Node (tests/pdf.test.js).
 *
 * A page is { w, h, ops } in points with the origin at the TOP left (y grows downwards, like the screen). Operations:
 *   { t: "line", x1, y1, x2, y2, w, color }            color is "#rrggbb" (default black)
 *   { t: "rect", x, y, w, h, lw, stroke, fill }
 *   { t: "poly", pts: [[x, y], ...], fill, stroke, lw }
 *   { t: "text", x, y, s, size, bold, color }           y is the baseline; left aligned
 * Text is written in WinAnsi (Latin 1); other characters become "?". */
(function (root) {
  "use strict";
  var P = {};

  function n(v) { return String(Math.round(v * 1000) / 1000); }
  function rgb(hex, dflt) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return dflt || "0 0 0";
    return [0, 2, 4].map(function (i) { return n(parseInt(m[1].substr(i, 2), 16) / 255); }).join(" ");
  }
  function esc(s) {
    var out = "";
    String(s).split("").forEach(function (ch) {
      var c = ch.charCodeAt(0);
      if (c === 40 || c === 41 || c === 92) out += "\\" + ch;
      else if (c >= 32 && c < 127) out += ch;
      else if (c >= 160 && c < 256) out += "\\" + ("00" + c.toString(8)).slice(-3);
      else out += "?";
    });
    return out;
  }
  /* Approximate width of a text in Helvetica (good enough for layout; not exact). */
  P.textWidth = function (s, size, bold) { return String(s).length * size * (bold ? 0.56 : 0.52); };

  function content(page) {
    var H = page.h, o = [];
    function Y(y) { return n(H - y); }
    page.ops.forEach(function (op) {
      if (op.t === "line") o.push("q " + rgb(op.color) + " RG " + n(op.w || 0.5) + " w " + n(op.x1) + " " + Y(op.y1) + " m " + n(op.x2) + " " + Y(op.y2) + " l S Q");
      else if (op.t === "rect" || op.t === "poly") {
        var pts = op.t === "rect" ? [[op.x, op.y], [op.x + op.w, op.y], [op.x + op.w, op.y + op.h], [op.x, op.y + op.h]] : op.pts;
        var s = pts.map(function (p, i) { return n(p[0]) + " " + Y(p[1]) + (i ? " l" : " m"); }).join(" ") + " h";
        var fill = op.fill ? rgb(op.fill) + " rg " : "", stroke = op.stroke ? rgb(op.stroke) + " RG " + n(op.lw || op.w || 0.5) + " w " : "";
        var paint = op.fill && op.stroke ? "B" : op.fill ? "f" : "S";
        o.push("q " + fill + stroke + s + " " + paint + " Q");
      } else if (op.t === "text") o.push("q " + rgb(op.color) + " rg BT /" + (op.bold ? "F2" : "F1") + " " + n(op.size || 10) + " Tf " + n(op.x) + " " + Y(op.y) + " Td (" + esc(op.s) + ") Tj ET Q");
    });
    return o.join("\n") + "\n";
  }

  /* pages: [{ w, h, ops }] -> the PDF file as a string (all characters below 128, so one character is one byte). */
  P.build = function (pages, info) {
    var objs = [], kids = [], i;
    objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    var next = 5;
    pages.forEach(function (pg) {
      var pageNo = next++, contNo = next++, c = content(pg);
      kids.push(pageNo + " 0 R");
      objs[pageNo] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + n(pg.w) + " " + n(pg.h) + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contNo + " 0 R >>";
      objs[contNo] = "<< /Length " + c.length + " >>\nstream\n" + c + "endstream";
    });
    objs[2] = "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + pages.length + " >>";
    var infoNo = next++;
    objs[infoNo] = "<< /Title (" + esc((info && info.title) || "Document") + ") /Producer (Poker Table Designer) >>";
    var out = "%PDF-1.4\n", offs = [];
    for (i = 1; i < objs.length; i++) { offs[i] = out.length; out += i + " 0 obj\n" + objs[i] + "\nendobj\n"; }
    var xref = out.length;
    out += "xref\n0 " + objs.length + "\n0000000000 65535 f \n";
    for (i = 1; i < objs.length; i++) out += ("0000000000" + offs[i]).slice(-10) + " 00000 n \n";
    out += "trailer\n<< /Size " + objs.length + " /Root 1 0 R /Info " + infoNo + " 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
    return out;
  };
  P.A4 = { w: 595.28, h: 841.89 };

  if (typeof module !== "undefined" && module.exports) module.exports = P;
  else (root.PTD = root.PTD || {}).pdf = P;
})(typeof window !== "undefined" ? window : this);
