/* Exercises the Paper.js and opentype.js code paths with small mocks, because the real libraries are loaded from a CDN
 * at runtime. It checks the glue code only, not the libraries.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-mocks.js */

const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'), os = require('os');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'ptd-e2e-')) + path.sep;
const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack||'').split('\n').slice(1,3).join('|')));
  p.on('console', m => { if (m.type()==='error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => {
    class Pt { constructor(x, y) { this.x = x; this.y = y; } }
    class Path { constructor(o) { this.segments = (o.segments || []).map(pt => ({ point: pt })); } clone() { return new Path({ segments: this.segments.map(s => s.point) }); } translate(d) { this.segments.forEach(s => { s.point = new Pt(s.point.x + d.x, s.point.y + d.y); }); } }
    class Compound { constructor(o) { this.children = o.children || []; }
      clone() { return new Compound({ children: this.children.map(c => c.clone()) }); }
      translate(d) { this.children.forEach(c => c.translate(d)); }
      unite(o) { return new Compound({ children: this.children.concat(o.children) }); }
      subtract() { return this; } intersect() { return this; } }
    window.paper = { Path, CompoundPath: Compound, Point: Pt, setup() {} };
    window.__paperCalls = 0;
    // opentype mock: every glyph is a 0.5em square
    const Pth = class { constructor() { this.commands = []; } getBoundingBox() { return { x1: 0, y1: -80, x2: 200, y2: 0 }; } toPathData() { return 'M0 0L200 0L200 -80L0 -80Z'; } };
    window.opentype = { Path: Pth, parse() { return { unitsPerEm: 1000, charToGlyph: () => ({ advanceWidth: 500, getPath: (x, y, s) => ({ commands: [{ type: 'M', x, y }] }) }), getKerningValue: () => 0 }; } };
  });
  await p.goto(PAGE); await p.waitForTimeout(600);
  const ev = (f, a) => p.evaluate(f, a);
  // import a font so freeze works
  const ttf = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  await p.click('#tabs button[data-tab="fonts"]');
  const [ch] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-act="fontimport"]')]); await ch.setFiles(ttf); await p.waitForTimeout(400);
  const fam = await ev(() => PTD.core.state().fonts[0].family);
  await ev(f => { PTD.core.state().layers[0].font = f; PTD.core.renderPanels(); PTD.core.renderStage(); }, fam);
  await p.click('#tabs button[data-tab="artwork"]'); await p.click('[data-act="toggle"][data-id="l1"]');
  await p.click('[data-act="freeze"][data-id="l1"]'); await p.waitForTimeout(300);
  ok(await ev(() => !!PTD.core.state().layers[0].frozen), 'freeze to outlines stored the geometry');
  ok(await ev(() => document.querySelector('[data-act="unfreeze"]') !== null), 'unfreeze button shown');
  const spec = await ev(() => PTD.core.state().layers[0].text);
  await p.click('[data-act="unfreeze"][data-id="l1"]');
  ok(await ev(() => PTD.core.state().layers[0].frozen === null && PTD.core.state().layers[0].text === 'Molino'), 'unfreeze keeps the original spec');
  await p.click('#tabs button[data-tab="export"]');
  // cut with mocked paper: text layer 1 uses the imported font => outlined automatically at export
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('[data-act="cutsvg"][data-col=""]')]);
  await dl.saveAs(WORK + 'cutp.svg'); const svg = fs.readFileSync(WORK + 'cutp.svg', 'utf8');
  ok(/<path d="M/.test(svg), 'cut with Paper mock produced paths');
  const m = await ev(() => document.getElementById('exportMsg').textContent);
  ok(!/Paper.js could not be loaded/.test(m), 'paper path used: ' + m.slice(0, 160));
  console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors'); console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
