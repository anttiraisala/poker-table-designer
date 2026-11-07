/* Node checks for js/glyph.js (REQ-033, REQ-034): shapes, SVG in and out, strokes, holes, orientation.
 * Run from the repository root: node tests/glyph.test.js */
const Gl = require('../js/glyph.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
function flatArea(shape) {   // area by even-odd with all rings of the d string (sum of signed areas, outer positive, holes negative)
  const cs = Gl.parsePathData(shape.d); let a = 0;
  cs.forEach(c => { const p = Gl.flatten(c, 0.05); let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i][0] * q[1] - q[0] * p[i][1]; } a += s / 2; });
  return a;
}
// every built-in shape builds, is H high and centred
Gl.shapeList.forEach(s => {
  const r = Gl.fromShape(s.id, 7).shape;
  ok(near(r.y1 - r.y0, Gl.H) && near(r.y0, -Gl.H / 2) && near(r.x0, -r.x1), s.id + ': height ' + Gl.H + ' and centred (w ' + (r.x1 - r.x0).toFixed(1) + ')');
  ok(/^M[-0-9. CLZM]+$/.test(r.d), s.id + ': path text is M L C Z only');
  ok(flatArea(r) > 1000, s.id + ': has area');
});
// a ring has a hole: area of the ring = outer - inner
{
  const r = Gl.fromItems([{ kind: 'fill', rule: 'nonzero', contours: [Gl.circle(0, 0, 100), Gl.circle(0, 0, 50)] }]).shape;
  const outer = Math.PI * 1000 * 1000 / 4 * 1, ring = outer * (1 - 0.25);   // the ring is scaled so that the outer circle is 1000 high
  ok(near(flatArea(r) / ring, 1, 0.01), 'a ring keeps its hole (area ' + Math.round(flatArea(r)) + ' vs ' + Math.round(ring) + ')');
  const r2 = Gl.fromItems([{ kind: 'fill', rule: 'nonzero', contours: [Gl.circle(0, 0, 100), Gl.circle(0, 0, 50)] }]).shape;
  ok(r2.d === r.d, 'same input, same output');
}
// the same ring with both contours drawn the same direction (nonzero would fill it) still gets a hole: orientation is fixed
{
  const a = Gl.circle(0, 0, 100), b = Gl.circle(0, 0, 50);
  const r = Gl.fromItems([{ kind: 'fill', rule: 'evenodd', contours: [a, b] }]).shape;
  ok(flatArea(r) < Math.PI * 500 * 500 * 0.9, 'inner contour becomes a hole whatever its direction');
}
// SVG in: path with an arc, a rect, a transform, relative commands, implicit lineto
{
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="translate(10 10)"><rect x="0" y="0" width="40" height="20"/><path d="M60 0a10 10 0 1 1 0 20a10 10 0 1 1 0 -20z"/></g></svg>';
  const r = Gl.fromSVG(svg);
  const w = r.shape.x1 - r.shape.x0;
  ok(near(w / Gl.H, 70 / 20, 0.02), 'rect and circle: aspect 70 : 20 (got ' + (w / Gl.H).toFixed(3) + ')');
}
// white shapes are the background and are left out; a note says so
{
  const r = Gl.fromSVG('<svg><rect width="100" height="100" fill="#fff"/><circle cx="50" cy="50" r="30" fill="black"/></svg>');
  ok(near(r.shape.x1 - r.shape.x0, Gl.H, 1) && r.notes.some(n => /white/.test(n)), 'a white background is left out and noted');
}
// strokes become filled shapes: a stroked line of width 10 and length 100 is a 100 x 10 bar
{
  const r = Gl.fromSVG('<svg><line x1="0" y1="0" x2="100" y2="0" stroke="black" stroke-width="10" fill="none"/></svg>');
  const w = r.shape.x1 - r.shape.x0, h = r.shape.y1 - r.shape.y0;
  ok(near(h, Gl.H) && near(w / h, 10, 0.1), 'a stroked line is a filled bar (aspect ' + (w / h).toFixed(2) + ')');
  ok(r.notes.some(n => /lines were turned/.test(n)), 'the note says lines became shapes');
}
// several overlapping shapes are merged (union), not even-odd: two overlapping squares leave no hole
{
  const r = Gl.fromSVG('<svg><rect x="0" y="0" width="60" height="60"/><rect x="30" y="30" width="60" height="60"/></svg>');
  const cs = Gl.parsePathData(r.shape.d);
  ok(cs.length === 1, 'overlapping shapes merge into one outline (' + cs.length + ')');
}
// islands: two separate shapes stay two contours
{
  const r = Gl.fromSVG('<svg><circle cx="0" cy="0" r="10"/><circle cx="50" cy="0" r="10"/></svg>');
  ok(Gl.parsePathData(r.shape.d).length === 2, 'two islands stay two contours');
}
// errors
ok((() => { try { Gl.fromSVG('hello'); } catch (e) { return /not an SVG/.test(e.message); } })(), 'text that is not SVG is refused');
ok((() => { try { Gl.fromSVG('<svg><rect width="10" height="10" fill="none"/></svg>'); } catch (e) { return /No filled/.test(e.message); } })(), 'an SVG with no fill is refused with a reason');
ok((() => { try { Gl.fromSVG('<svg><path d="M 0 0 L"/></svg>'); } catch (e) { return /malformed/.test(e.message); } })(), 'a broken path is refused');
// scripts and external things are not read
{
  const r = Gl.fromSVG('<svg><script>alert(1)</script><image href="http://x/y.png" width="9" height="9"/><circle r="5"/></svg>');
  ok(Gl.parsePathData(r.shape.d).length === 1 && r.notes.some(n => /image/.test(n)), 'scripts and images are ignored');
}
// SVG out and in again gives the same shape
{
  const a = Gl.fromShape('heart').shape, svg = Gl.toSVG(a, { colour: '#d4af5a', sizeMm: 200 });
  ok(/viewBox="/.test(svg) && /height="200mm"/.test(svg) && /fill="#d4af5a"/.test(svg), 'SVG out has the viewBox, the real size and the colour');
  const b = Gl.fromSVG(svg).shape;
  ok(near(b.x1 - b.x0, a.x1 - a.x0, 0.5) && near(flatArea(b) / flatArea(a), 1, 0.01), 'SVG out then in keeps the shape');
}
// arcs
{
  const cs = Gl.parsePathData('M0 0A10 10 0 0 1 20 0');
  const p = Gl.flatten(cs[0], 0.01), top = Math.min.apply(null, p.map(q => q[1]));
  ok(near(top, -10, 0.05) || near(top, 0, 0.05) || near(Math.max.apply(null, p.map(q => q[1])), 10, 0.05), 'a half circle arc has radius 10');
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
