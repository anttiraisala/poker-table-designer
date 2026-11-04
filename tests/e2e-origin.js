/* Browser checks for the artwork origin (anchored to the dealer edge or the cloth centre).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-origin.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, e = 0.6) => Math.abs(a - b) <= e;
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(800);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const o = PTD.random.opts; Object.keys(o).forEach(k => { if (/(Vary|Set)$/.test(k)) o[k] = false; }); o.shape = false; });
  const O = () => ev(() => PTD.core.artOrigin());

  // ---- defaults: one table, the origin is 300 mm in from the bottom edge
  let o = await O();
  ok(await ev(() => PTD.core.state().origin.mode === 'auto' && PTD.core.originMode() === 'edge'), 'default mode is auto and picks the edge with one table');
  ok(near(o.x, 0) && near(o.y, 300), 'origin is 300 mm above the bottom edge of the default table: ' + JSON.stringify(o));
  ok(await ev(() => { const s = PTD.core.state(); return s.band.x === 0 && s.band.y === 0; }), 'the hand sits at the origin by default');
  const hand = await ev(() => { const g = document.querySelector('#stage g[transform^="translate("]'); return g ? g.getAttribute('transform') : ''; });
  ok(/translate\(0 300\)/.test(hand), 'the artwork group is translated to the origin: ' + hand);

  // ---- distance, sideways, notch
  await p.fill('[data-scope="origin"][data-key="distance"]', '250');
  o = await O(); ok(near(o.y, 350), 'distance 250 moves the origin to y 350');
  await p.fill('[data-scope="origin"][data-key="sideways"]', '100');
  o = await O(); ok(near(o.x, 100), 'sideways offset 100 moves it along the edge');
  await p.fill('[data-scope="origin"][data-key="distance"]', '300'); await p.fill('[data-scope="origin"][data-key="sideways"]', '0');
  await ev(() => { const t = PTD.tables.get('t1'); t.preset.notch.on = true; PTD.tables.regen(t); PTD.core.renderStage(); });
  o = await O(); ok(near(o.y, 600 - 160 - 300), 'with the dealer notch on, 300 mm is measured from the bottom of the notch: ' + o.y);
  await ev(() => { const t = PTD.tables.get('t1'); t.preset.notch.on = false; PTD.tables.regen(t); PTD.core.renderStage(); });

  // ---- resizing the table: the origin follows the edge, the table centre stays
  await ev(() => { const t = PTD.tables.get('t1'); t.preset.h = 1000; PTD.tables.regen(t); PTD.core.renderStage(); });
  o = await O(); ok(near(o.y, 500 - 300), 'a shorter table moves the origin with its edge (y ' + o.y + ')');
  await ev(() => { const t = PTD.tables.get('t1'); t.preset.h = 1200; PTD.tables.regen(t); });

  // ---- rotation: the origin turns with the table, the text stays upright
  await ev(() => { PTD.tables.get('t1').rot = 90; PTD.core.renderStage(); });
  o = await O(); ok(near(o.y, 0) && Math.abs(o.x) > 200, 'a table turned by 90 degrees puts the origin on the side: ' + JSON.stringify(o));
  ok(await ev(() => !/rotate/.test(document.querySelector('#stage g[transform^="translate("]').getAttribute('transform'))), 'the artwork itself is not rotated with the table');
  await ev(() => { PTD.tables.get('t1').rot = 0; PTD.core.renderStage(); });

  // ---- several tables: auto uses the cloth centre; edge mode follows the chosen anchor table
  await ev(() => { const s = PTD.core.state(); s.tables.push(PTD.tables.make('t2', 'Table 2', 'rectangle', 1)); PTD.core.renderPanels(); PTD.core.renderStage(); });
  o = await O(); ok(await ev(() => PTD.core.originMode() === 'centre') && near(o.x, 0) && near(o.y, 0), 'with two visible tables auto puts the origin at the cloth centre');
  await ev(() => { const s = PTD.core.state(); s.origin.mode = 'edge'; s.origin.table = 't2'; PTD.core.renderStage(); });
  o = await O(); const t2 = await ev(() => PTD.tables.geo(PTD.tables.get('t2')).bbox);
  ok(near(o.y, t2.y1 - 300), 'edge mode follows the anchor table (y ' + o.y + ' vs bottom ' + t2.y1 + ')');
  await ev(() => { PTD.tables.get('t2').visible = false; PTD.core.renderStage(); });
  o = await O(); ok(near(o.y, 300), 'a hidden anchor table falls back to the first visible one');
  await ev(() => { const s = PTD.core.state(); s.tables = s.tables.filter(t => t.id === 't1'); s.origin.mode = 'auto'; s.origin.table = ''; PTD.core.renderStage(); });

  // ---- everything that uses artwork positions follows the origin
  const pot = await ev(() => { const s = PTD.core.state(); const c = PTD.scene.build(s).objs.filter(q => q.k === "chip"); const xs = c.map(q => q.x), ys = c.map(q => q.y); return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, ox: s.cards.potX, oy: s.cards.potY }; });
  ok(Math.abs(pot.x - (0 + pot.ox)) < 80 && Math.abs(pot.y - (300 + pot.oy)) < 80, 'the pot lies around origin + its offset: ' + JSON.stringify(pot));
  const sheet = await ev(() => PTD.sheet.data().art.map(a => [a.kind, a.name, a.x, a.y]));
  ok(sheet.some(a => a[0] === 'Cards' && near(a[2], 0) && near(a[3], 300)), 'the layout sheet lists the hand at the origin measured from the cloth centre: ' + JSON.stringify(sheet.filter(a => a[0] === 'Cards')));
  const cut = await ev(async () => { const g = await PTD.exporter.gather({ bet: false }); const it = g.items.filter(i => i.name === 'Line')[0]; const ys = it.rings[0].map(q => q[1]); return { y0: Math.min(...ys), y1: Math.max(...ys) }; });
  ok(near(cut.y0, 300 - 50 - 4) || near(cut.y0, 300 + 50), 'cut lines are placed from the origin: ' + JSON.stringify(cut));
  const svgText = await ev(async () => (await PTD.exporter.artSVG({ x0: -500, y0: -500, x1: 500, y1: 800 }, 0.2, false)).text);
  ok(/translate\(0 300\)/.test(svgText), 'the picture and the Blender texture draw the artwork from the origin');

  // ---- project files
  ok(await ev(() => JSON.stringify(PTD.core.toPartJSON('artwork', false).artwork.origin) === JSON.stringify({ mode: 'auto', table: '', distance: 300, sideways: 0 })), 'the artwork file carries the origin settings');
  await ev(() => { const o = PTD.core.toJSON(false); delete o.artwork.origin; o.artwork.layers[0].x = 111; o.artwork.layers[0].y = -77; PTD.core.loadText(JSON.stringify(o)); });
  ok(await ev(() => PTD.core.state().origin.mode === 'centre' && PTD.core.state().layers[0].x === 111 && PTD.core.state().layers[0].y === -77), 'a file from before the origin existed loads with the cloth centre as its origin and unchanged positions');
  o = await O(); ok(near(o.x, 0) && near(o.y, 0), 'and its artwork stays where it was');
  await ev(() => PTD.core.loadText(JSON.stringify({ format: 'poker-table-designer-project', version: 1, artwork: PTD.core.toPartJSON('artwork', false).artwork })));

  // ---- randomizer keeps texts inside the player area whatever the origin is
  await ev(() => { const s = PTD.core.state(); s.origin = { mode: 'edge', table: '', distance: 300, sideways: 0 }; s.tables[0].bet.on = true; PTD.core.renderStage(); });
  await ev(() => { PTD.random.opts.words = false; PTD.random.once && PTD.random.once(); });
  await p.waitForFunction(() => !PTD.random.running || true, null, { timeout: 100 }).catch(() => {});
  await p.waitForTimeout(3500);
  const inside = await ev(() => { const s = PTD.core.state(), A = PTD.core.artOrigin(), bb = PTD.tables.geo(s.tables[0]).bbox; return s.layers.every(l => l.x + A.x > bb.x0 && l.x + A.x < bb.x1 && l.y + A.y > bb.y0 && l.y + A.y < bb.y1); });
  ok(inside, 'after a random round every text lies inside the table outline (positions are stored from the origin)');

  // ---- the anchor controls
  ok(await ev(() => document.getElementById('anchorTable').options.length >= 2), 'the anchor table list is filled');
  await p.selectOption('[data-scope="origin"][data-key="mode"]', 'centre');
  ok(await p.isDisabled('[data-scope="origin"][data-key="distance"]'), 'the distance field is greyed out when the origin is at the cloth centre');
  await p.selectOption('[data-scope="origin"][data-key="mode"]', 'edge');
  ok(!(await p.isDisabled('[data-scope="origin"][data-key="distance"]')), 'and enabled again for the dealer edge');

  ok(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
