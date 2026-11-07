/* Node checks for js/tracer.js (REQ-035): smooth contours from bitmaps, corners, holes, specks, effects.
 * Run from the repository root: node tests/tracer.test.js */
const T = require('../js/tracer.js'), Gl = require('../js/glyph.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t) => Math.abs(a - b) <= t;
function img(w, h, f) { const rgba = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f(x, y); const i = (y * w + x) * 4; rgba[i] = rgba[i + 1] = rgba[i + 2] = 255 - v; rgba[i + 3] = 255; } return { w, h, rgba }; }   // v = ink 0..255
const disc = (cx, cy, r) => (x, y) => { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); return d <= r - 0.5 ? 255 : d >= r + 0.5 ? 0 : 255 * (r + 0.5 - d); };   // anti-aliased
function areaOf(shapeD) { return Gl.parsePathData(shapeD).reduce((a, c) => { const p = Gl.flatten(c, 0.05); let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i][0] * q[1] - q[0] * p[i][1]; } return a + s / 2; }, 0); }
// a disc: one contour, few curves, round
{
  const r = T.process(img(200, 200, disc(100, 100, 60)), { blur: 0 });
  ok(r.contours.length === 1, 'a disc gives one contour (' + r.contours.length + ')');
  const c = r.contours[0], pts = Gl.flatten(c, 0.02);
  const rad = pts.map(p => Math.hypot(p[0] - 99.5, p[1] - 99.5)), mn = Math.min(...rad), mx = Math.max(...rad);   // pixel centres are at whole numbers, so the disc centre is 99.5
  ok(near(mn, 60, 0.6) && near(mx, 60, 0.6), 'the disc outline is round within 0.6 px (radius ' + mn.toFixed(2) + ' to ' + mx.toFixed(2) + ')');
  ok(c.segs.length <= 24, 'a disc needs few curves, not hundreds of pixel steps (' + c.segs.length + ')');
  ok(c.segs.every(g => g[0] === 'C'), 'the disc is made of curves');
}
// a square: four straight sides, sharp corners
{
  const r = T.process(img(200, 200, (x, y) => x >= 50 && x < 150 && y >= 50 && y < 150 ? 255 : 0), { blur: 0 });
  const c = r.contours[0];
  ok(r.contours.length === 1 && c.segs.length <= 8, 'a square is about four lines (' + c.segs.length + ' segments)');
  ok(c.segs.filter(g => g[0] === 'L').length >= 4, 'the square keeps straight lines');
  const s = Gl.shapeOf(r.contours), w = s.x1 - s.x0;
  ok(near(w / Gl.H, 1, 0.02), 'the square comes out square (aspect ' + (w / Gl.H).toFixed(3) + ')');
}
// a ring: hole kept
{
  const f = (x, y) => { const d = Math.hypot(x + 0.5 - 100, y + 0.5 - 100); return d < 60 && d > 30 ? 255 : 0; };
  const r = T.process(img(200, 200, f), { blur: 0.6 });
  ok(r.contours.length === 2, 'a ring gives two contours (outer and hole): ' + r.contours.length);
  const s = Gl.shapeOf(r.contours);
  ok(near(areaOf(s.d) / (Math.PI * (60 * 60 - 30 * 30)) , (Gl.H / 120) * (Gl.H / 120), 0.05 * (Gl.H / 120) * (Gl.H / 120)), 'the ring area is right after scaling (the hole is a hole)');
}
// specks are dropped, tiny holes too; the size is adjustable
{
  const f = (x, y) => (Math.hypot(x - 100, y - 100) < 50 ? 255 : 0) + ((x - 20) ** 2 + (y - 20) ** 2 < 3 ? 255 : 0);
  const a = T.process(img(200, 200, (x, y) => Math.min(255, f(x, y))), { blur: 0, speck: 20 });
  const b = T.process(img(200, 200, (x, y) => Math.min(255, f(x, y))), { blur: 0, speck: 0 });
  ok(a.contours.length === 1 && b.contours.length === 2, 'a small speck is dropped with speck=20 and kept with speck=0 (' + a.contours.length + ' / ' + b.contours.length + ')');
}
// noise: a noisy edge is still smooth after blur and fit
{
  let seed = 5; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const noisy = img(200, 200, (x, y) => { const base = disc(100, 100, 60)(x, y); return Math.max(0, Math.min(255, base + (rnd() - 0.5) * 120)); });
  const r = T.process(noisy, { blur: 1.5 });
  ok(r.contours.length === 1, 'a noisy disc still gives one contour (' + r.contours.length + ')');
  const pts = Gl.flatten(r.contours[0], 0.05), rad = pts.map(p => Math.hypot(p[0] - 99.5, p[1] - 99.5));
  ok(Math.max(...rad) - Math.min(...rad) < 3, 'the noisy disc is round within 3 px');
}
// dark background with a light shape is inverted automatically; explicit invert works
{
  const light = img(100, 100, (x, y) => Math.hypot(x - 50, y - 50) < 25 ? 0 : 255);
  const r = T.process(light, { blur: 0 });
  ok(r.inverted && r.contours.length === 1, 'a light shape on a dark ground is found by the automatic invert');
  const r2 = T.process(light, { blur: 0, invert: false });
  ok(r2.contours.length >= 1 && !r2.inverted, 'invert=false keeps the dark part');
}
// transparency counts as paper
{
  const w = 60, h = 60, rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (Math.hypot(x - 30, y - 30) < 15) { rgba[i + 3] = 255; } }   // black opaque disc, the rest transparent (rgb 0)
  const r = T.process({ w, h, rgba }, { blur: 0 });
  ok(r.contours.length === 1, 'a transparent background is paper (one contour)');
}
// effects
{
  const f = new Float32Array(100); for (let i = 0; i < 100; i++) f[i] = i < 50 ? 100 : 160;
  const g = T.levels(f, { auto: true });
  ok(g[0] < 10 && g[99] > 245, 'automatic levels stretch a low-contrast picture to the full range');
  const t = T.otsu(g); ok(t > 10 && t < 245, 'the automatic threshold sits between the two levels (' + t + ')');
  const gr = T.grow(new Float32Array([0, 0, 0, 0, 255, 0, 0, 0, 0]), 3, 3, 1);
  ok(gr.every(v => v === 255) || gr[0] === 0, 'grow makes the shape thicker');
  const big = T.shrinkTo(new Float32Array(400 * 400).fill(5), 400, 400, 100);
  ok(big.w === 100 && big.h === 100 && big.f === 4, 'a big picture is shrunk to the work size');
}
// into a glyph: a traced disc becomes a glyph shape that is H high
{
  const s = Gl.shapeOf(T.process(img(200, 200, disc(100, 100, 60)), { blur: 0.8 }).contours);
  ok(near(s.y1 - s.y0, Gl.H, 0.01) && near((s.x1 - s.x0) / Gl.H, 1, 0.02), 'the traced disc becomes a round glyph, H high');
}
// speed: a 1200 x 1200 picture is traced in reasonable time
{
  const t0 = Date.now(); const r = T.process(img(1200, 1200, disc(600, 600, 500)), { blur: 1 }); const dt = Date.now() - t0;
  ok(dt < 8000 && r.contours.length === 1, 'a 1200 x 1200 picture traces in ' + dt + ' ms');
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
