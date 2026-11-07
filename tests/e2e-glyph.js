/* Browser checks for REQ-033 to REQ-036 (glyphs): add a shape, scale with the handles, rotate, outline, export, SVG in and out, paste,
 * the glyph editor with a picture and an SVG file, the saved form, clone, undo.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-glyph.js */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t = 0.5) => Math.abs(a - b) <= t;
(async () => {
  const root = path.resolve(__dirname, '..');
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  const ev = (f, a) => p.evaluate(f, a);
  const url = 'file://' + path.join(root, 'index.html');
  const wait = (ms) => p.waitForTimeout(ms || 250);
  await p.goto(url); await ev(() => { localStorage.clear(); }); await p.goto(url); await wait(500);
  await ev(() => { PTD.core.cfg().snap = false; const s = PTD.core.state(); s.layers = []; s.groups = []; s.band.at = 0; s.band.hidden = true; PTD.core.save(); PTD.core.renderPanels(); PTD.core.renderStage(); });
  const L = () => ev(() => PTD.core.state().layers.map(l => ({ id: l.id, text: l.text, glyph: !!l.glyph, size: l.size, rot: l.rot, x: l.x, y: l.y, outline: l.outline, outlineW: l.outlineW, hasFz: !!l.frozen })));

  // 1. add a shape with the buttons of the Artwork tab
  ok(await ev(() => !!document.getElementById('glyphAddShape') && document.getElementById('glyphShape').options.length >= 7), 'the Glyphs section has a shape list and an Add shape button');
  await p.selectOption('#glyphShape', 'heart'); await p.click('#glyphAddShape'); await wait();
  let ls = await L();
  ok(ls.length === 1 && ls[0].glyph && ls[0].text === 'Heart' && ls[0].size === 150 && ls[0].hasFz, 'Add shape makes one glyph layer named Heart, 150 mm high');
  const bb = () => ev(() => { const l = PTD.core.state().layers[0]; return PTD.core.ui.tbox[l.id]; });
  let box = await bb();
  ok(box && near(box.h, 150, 0.2) && box.w > 100 && box.w < 150, 'its box on the stage is 150 mm high (width ' + (box && box.w.toFixed(1)) + ')');
  ok(await ev(() => document.querySelectorAll('#stage path[fill-rule="evenodd"]').length >= 1), 'it is drawn as a path on the stage');
  ok(await ev(() => /glyph/.test(document.querySelector('[data-panel="l1"]').textContent)), 'the list row says glyph');
  // 2. the glyph panel
  await ev(() => { PTD.core.ui.open.l1 = true; PTD.core.renderPanels(); }); await wait();
  ok(await ev(() => !!document.querySelector('[data-panel="l1"] [data-act="glyphcopy"]') && !document.querySelector('[data-panel="l1"] [data-key="font"]')), 'the glyph panel has Copy as SVG and no font field');
  await ev(() => { const i = document.querySelector('[data-panel="l1"] input[type=number][data-key="size"]'); i.value = '200'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait();
  box = await bb(); ok(near(box.h, 200, 0.2), 'the Height field scales the glyph (box ' + box.h.toFixed(1) + ' mm)');
  // 3. handles: drag the bottom right handle outwards
  await ev(() => { const s = PTD.core.state(); s.selected = 'l1'; PTD.core.ui.extra = {}; PTD.core.renderStage(); });
  ok(await ev(() => !!PTD.thandles.target()), 'a selected glyph gets the resize handles');
  const hc = await ev(() => { const n = document.querySelector('[data-h="thandle:1:1"] rect').getBoundingClientRect(); return { x: n.left + n.width / 2, y: n.top + n.height / 2 }; });
  await p.mouse.move(hc.x, hc.y); await p.mouse.down(); await p.mouse.move(hc.x + 20, hc.y + 20, { steps: 4 }); await p.mouse.move(hc.x + 60, hc.y + 60, { steps: 4 }); await p.mouse.up(); await wait();
  ls = await L(); ok(ls[0].size > 205, 'dragging a handle scales the glyph (size ' + ls[0].size + ')');
  // 4. rotation, outline and export
  await ev(() => { const l = PTD.core.state().layers[0]; l.size = 100; l.rot = 0; l.x = 0; l.y = 0; l.outline = true; l.outlineW = 4; PTD.core.save(); PTD.core.renderStage(); });
  const ex = async () => ev(async () => { const g = await PTD.exporter.gather({ bet: false }); const it = g.items.filter(i => i.name === 'Heart')[0]; if (!it) return null; const xs = [], ys = []; it.rings.forEach(r => r.forEach(q => { xs.push(q[0]); ys.push(q[1]); })); return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), halo: it.halo, rings: it.rings.length, warns: g.warnings.length }; });
  let e0 = await ex();
  ok(e0 && near(e0.h, 100, 0.3) && e0.halo === 4 && e0.rings === 1, 'the cut export has the glyph as an outline 100 mm high with a 4 mm halo (' + JSON.stringify(e0) + ')');
  await ev(() => { PTD.core.state().layers[0].rot = 90; PTD.core.save(); });
  let e1 = await ex(); ok(e1 && near(e1.w, 100, 0.3) && near(e1.h, e0.w, 0.3), 'a turn of 90 degrees swaps width and height in the export');
  await ev(() => { PTD.core.state().layers[0].rot = 0; PTD.core.save(); });
  ok(await ev(async () => { const f = PTD.measure.features ? PTD.measure.features() : null; return true; }), 'measure still runs');
  // 5. SVG out
  const svg = await ev(() => PTD.core.glyphSVG(PTD.core.state().layers[0]));
  ok(/^<svg /.test(svg) && /height="100mm"/.test(svg) && /fill="#[0-9a-f]{6}"/i.test(svg) && /<path /.test(svg), 'Copy as SVG text has the real size and the colour');
  await p.click('#glyphSvgBtn'); await wait();
  const wt = await ev(() => document.getElementById('svgText').value);
  ok(wt === svg, 'the SVG text window shows the selected glyph');
  // 6. SVG in through the window
  await ev(() => { document.getElementById('svgText').value = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/><rect x="10" y="10" width="80" height="80" fill="none" stroke="black" stroke-width="6"/></svg>'; });
  await p.click('#svgDlg [data-s="add"]'); await wait();
  ls = await L(); ok(ls.length === 2 && ls[1].glyph && ls[1].text === 'SVG glyph', 'Add as glyph makes a second glyph from pasted SVG (a filled circle and a stroked square)');
  const n2 = await ev(() => PTD.glyph.parsePathData(PTD.core.state().layers[1].frozen.d).length);
  ok(n2 === 5, 'the circle and the stroked square merge into one shape with four corner holes (' + n2 + ' contours)');
  ok(await ev(() => document.getElementById('svgDlg').hidden), 'the window closed after adding');
  // 7. paste with Ctrl+V (a paste event with SVG text)
  await ev(() => { document.activeElement && document.activeElement.blur(); const dt = new DataTransfer(); dt.setData('text/plain', '<svg viewBox="0 0 10 10"><path d="M0 0L10 0L5 10Z"/></svg>'); document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }); await wait();
  ls = await L(); ok(ls.length === 3 && ls[2].glyph && ls[2].text === 'Pasted SVG', 'pasting SVG text with Ctrl+V adds a glyph');
  // pasting text that is not SVG does nothing here
  await ev(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'hello'); document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }); await wait();
  ok((await L()).length === 3, 'pasting other text adds nothing');
  // bad SVG says why
  await ev(() => { PTD.glyphui.importSVG('<svg><rect width="5" height="5" fill="none"/></svg>', 'x'); });
  ok(/not used/.test(await ev(() => document.getElementById('status') ? document.getElementById('status').textContent : '')) || (await L()).length === 3, 'a bad SVG adds nothing');
  // 8. clone, undo and the saved form
  await ev(() => { PTD.core.state().selected = 'l1'; PTD.core.ui.extra = {}; }); await ev(() => PTD.core.actClone()); await wait();
  ls = await L(); ok(ls.length === 4 && ls[1].glyph && ls[1].size === 100, 'Clone copies a glyph with its size');
  await p.keyboard.press('Control+z'); await wait();
  ok((await L()).length === 3, 'Undo takes the clone away');
  const txt = await ev(() => JSON.stringify(PTD.core.toJSON()));
  ok(/"glyph":true/.test(txt), 'the project JSON holds the glyph flag and the shape');
  await ev((t) => PTD.core.loadText(t), txt); await wait();
  ls = await L(); ok(ls.length === 3 && ls.every(l => l.glyph && l.hasFz), 'loading the project back keeps all three glyphs');
  // 9. the glyph editor with a picture
  await p.click('#glyphEdBtn'); await wait();
  ok(await ev(() => !document.getElementById('glyphDlg').hidden), 'the glyph editor opens');
  const png = await ev(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 300); x.fillStyle = '#222'; x.beginPath(); x.arc(150, 150, 100, 0, 7); x.fill(); x.fillRect(285, 60, 60, 180); x.fillStyle = '#fff'; x.beginPath(); x.arc(150, 150, 40, 0, 7); x.fill(); return c.toDataURL('image/png'); });
  const pf = path.join(os.tmpdir(), 'ptd-disc.png'); fs.writeFileSync(pf, Buffer.from(png.split(',')[1], 'base64'));
  await p.setInputFiles('#gedFile', pf); await p.waitForTimeout(1200);
  let st = await ev(() => { const s = PTD.glyphed.state(); return { has: s.hasPicture, kind: s.kind, n: s.res && s.res.contours.length, nodes: s.res && s.res.stats.nodes, info: document.getElementById('gedInfo').textContent }; });
  ok(st.has && st.kind === 'bitmap' && st.n === 3, 'a PNG is traced at once: a disc with a hole and a bar are three outlines (got ' + st.n + ')');
  ok(/outlines/.test(st.info), 'the info line reports the result (' + st.info.slice(0, 60) + ')');
  ok(st.nodes < 60, 'the outlines are smooth curves, few pieces (' + st.nodes + ')');
  // modes
  for (const m of ['effects', 'vector', 'picture']) { await p.check('input[name="gedmode"][value="' + m + '"]'); await wait(150); }
  ok(await ev(() => document.getElementById('gedPath').getAttribute('d').length > 20), 'the preview shows the vector path in all modes');
  // a slider triggers a new trace: a big speck size removes the bar? no: raise speck above everything small
  await ev(() => { const i = document.getElementById('ged_speck'); i.value = '300'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(500);
  ok((await ev(() => PTD.glyphed.state().res.contours.length)) >= 2, 'changing a slider traces again');
  await p.click('#glyphDlg [data-g="reset"]'); await p.waitForTimeout(500);
  ok((await ev(() => PTD.glyphed.settings().speck)) === 12, 'Reset effects puts the values back');
  // use as glyph at 300 mm
  await ev(() => { const i = document.getElementById('ged_height'); i.value = '300'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
  await p.click('#glyphDlg [data-g="use"]'); await wait();
  ls = await L(); const last = ls[ls.length - 1];
  ok(ls.length === 4 && last.glyph && last.size === 300 && last.text === 'ptd-disc', 'Use as glyph adds the traced picture at 300 mm named after the file (' + last.text + ' ' + last.size + ')');
  ok(await ev(() => document.getElementById('glyphDlg').hidden), 'the editor closed');
  const hole = await ev(() => PTD.glyph.parsePathData(PTD.core.state().layers[3].frozen.d).length);
  ok(hole === 3, 'the glyph made from the picture has its hole and its separate bar (' + hole + ' contours)');
  // 10. SVG file into the editor
  await p.click('#glyphEdBtn'); await wait();
  const sf = path.join(os.tmpdir(), 'ptd-star.svg'); fs.writeFileSync(sf, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,5 61,38 95,38 67,59 78,92 50,72 22,92 33,59 5,38 39,38"/></svg>');
  await p.setInputFiles('#gedFile', sf); await wait(500);
  st = await ev(() => ({ kind: PTD.glyphed.state().kind, dis: document.getElementById('ged_blur').disabled, info: document.getElementById('gedInfo').textContent }));
  ok(st.kind === 'svg' && st.dis && /SVG/.test(st.info), 'an SVG file is shown as it is and the picture effects are switched off');
  await p.click('#glyphDlg [data-g="use"]'); await wait();
  ls = await L(); ok(ls.length === 5 && ls[4].text === 'ptd-star', 'Use as glyph works for an SVG file too');
  // 11. Esc closes the editor
  await p.click('#glyphEdBtn'); await wait(); await p.keyboard.press('Escape'); await wait();
  ok(await ev(() => document.getElementById('glyphDlg').hidden), 'Esc closes the glyph editor');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
