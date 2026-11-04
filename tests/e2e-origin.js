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

  // ---- defaults: the origin is at the cloth centre and never moves by itself
  let o = await O();
  ok(near(o.x, 0) && near(o.y, 0), 'the origin starts at the cloth centre: ' + JSON.stringify(o));
  ok(await ev(() => { const s = PTD.core.state(); return s.origin.distance === 300 && s.band.y === 82; }), 'default distance is 300 mm and the default layout is the old one');
  const place = () => p.click('[data-act="placeorigin"]');

  // ---- the quick button
  await place(); o = await O();
  ok(near(o.x, 0) && near(o.y, 300), 'the button puts the origin 300 mm in from the bottom edge: ' + JSON.stringify(o));
  const hand = await ev(() => document.querySelector('#stage g[transform^="translate("]').getAttribute('transform'));
  ok(/translate\(0 300\)/.test(hand), 'the artwork group follows the origin: ' + hand);
  await p.fill('[data-scope="origin"][data-key="distance"]', '250');
  ok(near((await O()).y, 300), 'changing the distance field alone does not move the origin');
  await place(); ok(near((await O()).y, 350), 'the button uses the new distance');
  await p.fill('[data-scope="origin"][data-key="distance"]', '300');
  await p.fill('[data-scope="origin"][data-key="x"]', '120'); await p.fill('[data-scope="origin"][data-key="y"]', '-40');
  o = await O(); ok(near(o.x, 120) && near(o.y, -40), 'origin X and Y can be set freely');
  ok(await ev(() => { const s = PTD.core.state(); return s.layers[0].x === -170 && s.layers[0].y === -65; }), 'moving the origin does not change the stored text positions');

  ok((await p.textContent('#placeOriginBtn')) === 'Place at 300 mm from dealer edge', 'the button text shows the distance');
  await p.fill('[data-scope="origin"][data-key="distance"]', '250');
  ok((await p.textContent('#placeOriginBtn')) === 'Place at 250 mm from dealer edge', 'the button text follows the number field next to it');
  await p.fill('[data-scope="origin"][data-key="distance"]', '300');
  await place();
  ok(/300 mm in from the dealer edge.* 0 mm sideways/.test(await p.textContent('#originInfo')), 'the readout tells where the origin is now: ' + await p.textContent('#originInfo'));
  await p.fill('[data-scope="origin"][data-key="y"]', '350');
  ok(/250 mm in from/.test(await p.textContent('#originInfo')), 'the readout follows Origin Y');
  await p.fill('[data-scope="origin"][data-key="x"]', '40');
  ok(/40 mm sideways/.test(await p.textContent('#originInfo')), 'and Origin X');
  await p.fill('[data-scope="origin"][data-key="y"]', '650');
  ok(/50 mm outside the dealer edge/.test(await p.textContent('#originInfo')), 'an origin beyond the edge is reported as outside');
  await place();

  // ---- the notch
  await ev(() => { const t = PTD.tables.get('t1'); t.preset.notch.on = true; PTD.tables.regen(t); });
  await place(); o = await O(); ok(near(o.y, 600 - 160 - 300), 'with the dealer notch on, 300 mm is measured from the bottom of the notch: ' + o.y);
  await ev(() => { const t = PTD.tables.get('t1'); t.preset.notch.on = false; PTD.tables.regen(t); });
  await place();

  // ---- table changes never move the origin
  await ev(() => { const t = PTD.tables.get('t1'); t.preset.h = 1000; PTD.tables.regen(t); t.rot = 90; PTD.core.renderStage(); });
  o = await O(); ok(near(o.x, 0) && near(o.y, 300), 'resizing and turning the table leaves the origin where it was');
  await ev(() => { const t = PTD.tables.get('t1'); t.rot = 0; t.preset.h = 1200; PTD.tables.regen(t); });
  await place();

  // ---- rotation: the button follows the dealer side
  await ev(() => { PTD.tables.get('t1').rot = 90; });
  await place(); o = await O(); ok(near(o.y, 0) && near(o.x, -300), 'with the table turned by 90 degrees the button measures from the new dealer side: ' + JSON.stringify(o));
  ok(await ev(() => !/rotate/.test(document.querySelector('#stage g[transform^="translate("]').getAttribute('transform'))), 'the artwork itself is not rotated');
  await ev(() => { PTD.tables.get('t1').rot = 0; });
  await place();

  // ---- several tables: the button measures from the chosen table
  await ev(() => { const s = PTD.core.state(); const t2 = PTD.tables.make('t2', 'Table 2', 'rectangle', 1); t2.preset.h = 800; PTD.tables.regen(t2); s.tables.push(t2); PTD.core.renderPanels(); PTD.core.renderStage(); });
  await place(); ok(near((await O()).y, 300), 'by default the first visible table is used');
  await p.selectOption('#anchorTable', 't2'); await place();
  o = await O(); ok(near(o.y, 400 - 300), 'the chosen table is used (bottom at 400): ' + o.y);
  await ev(() => { PTD.tables.get('t2').visible = false; PTD.core.renderStage(); });
  await place(); ok(near((await O()).y, 300), 'a hidden chosen table falls back to the first visible one');
  await ev(() => { const s = PTD.core.state(); s.tables = s.tables.filter(t => t.id === 't1'); s.origin.table = ''; });
  await place();

  // ---- everything that uses artwork positions follows the origin
  const pot = await ev(() => { const s = PTD.core.state(); const c = PTD.scene.build(s).objs.filter(q => q.k === "chip"); const xs = c.map(q => q.x), ys = c.map(q => q.y); return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, ox: s.cards.potX, oy: s.cards.potY }; });
  ok(Math.abs(pot.x - (0 + pot.ox)) < 80 && Math.abs(pot.y - (300 + 82 + pot.oy)) < 80, 'the pot lies around origin + hand offset + its offset: ' + JSON.stringify(pot));
  const sheet = await ev(() => PTD.sheet.data().art.map(a => [a.kind, a.name, a.x, a.y]));
  ok(sheet.some(a => a[0] === 'Cards' && near(a[2], 0) && near(a[3], 382)), 'the layout sheet lists the hand (origin plus its offset) measured from the cloth centre: ' + JSON.stringify(sheet.filter(a => a[0] === 'Cards')));
  const cut = await ev(async () => { const g = await PTD.exporter.gather({ bet: false }); const it = g.items.filter(i => i.name === 'Line')[0]; const ys = it.rings[0].map(q => q[1]); return { y0: Math.min(...ys), y1: Math.max(...ys) }; });
  ok(near(cut.y0, 300 + 82 - 50 - 4) || near(cut.y0, 300 + 82 + 50), 'cut lines are placed from the origin: ' + JSON.stringify(cut));
  const svgText = await ev(async () => (await PTD.exporter.artSVG({ x0: -500, y0: -500, x1: 500, y1: 800 }, 0.2, false)).text);
  ok(/translate\(0 300\)/.test(svgText), 'the picture and the Blender texture draw the artwork from the origin');

  // ---- project files
  ok(await ev(() => JSON.stringify(PTD.core.toPartJSON('artwork', false).artwork.origin) === JSON.stringify({ x: 0, y: 300, distance: 300, table: '' })), 'the artwork file carries the origin');
  await ev(() => { const o = PTD.core.toJSON(false); delete o.artwork.origin; o.artwork.layers[0].x = 111; o.artwork.layers[0].y = -77; PTD.core.loadText(JSON.stringify(o)); });
  ok(await ev(() => PTD.core.state().origin.x === 0 && PTD.core.state().origin.y === 0 && PTD.core.state().layers[0].x === 111 && PTD.core.state().layers[0].y === -77), 'a file from before the origin existed loads with the origin at the cloth centre and unchanged positions');
  o = await O(); ok(near(o.x, 0) && near(o.y, 0), 'and its artwork stays where it was');
  await ev(() => PTD.core.loadText(JSON.stringify({ format: 'poker-table-designer-project', version: 1, artwork: PTD.core.toPartJSON('artwork', false).artwork })));

  // ---- a V33 file (origin that followed the table) becomes a fixed point
  await ev(() => { const o = PTD.core.toJSON(false); o.artwork.origin = { mode: 'auto', table: '', distance: 300, sideways: 40 }; PTD.core.loadText(JSON.stringify(o)); });
  o = await O(); ok(near(o.x, 40) && near(o.y, 300) && await ev(() => PTD.core.state().origin.mode === undefined), 'a V33 file with Auto and one table becomes the fixed point it was showing: ' + JSON.stringify(o));
  await ev(() => { const o = PTD.core.toJSON(false); o.artwork.origin = { mode: 'centre', sideways: 25 }; PTD.core.loadText(JSON.stringify(o)); });
  o = await O(); ok(near(o.x, 25) && near(o.y, 0), 'a V33 file with Cloth centre becomes a fixed point at its sideways offset');

  // ---- randomizer keeps texts inside the player area whatever the origin is
  await ev(() => { const s = PTD.core.state(); s.origin.x = 0; s.origin.y = 300; s.tables[0].bet.on = true; PTD.core.renderStage(); });
  await ev(() => { PTD.random.opts.words = false; PTD.random.once && PTD.random.once(); });
  await p.waitForFunction(() => !PTD.random.running || true, null, { timeout: 100 }).catch(() => {});
  await p.waitForTimeout(3500);
  const inside = await ev(() => { const s = PTD.core.state(), A = PTD.core.artOrigin(), bb = PTD.tables.geo(s.tables[0]).bbox; return s.layers.every(l => l.x + A.x > bb.x0 && l.x + A.x < bb.x1 && l.y + A.y > bb.y0 && l.y + A.y < bb.y1); });
  ok(inside, 'after a random round every text lies inside the table outline (positions are stored from the origin)');

  // ---- the controls
  ok(await ev(() => document.getElementById('anchorTable').options.length >= 2), 'the table list of the button is filled');
  await ev(() => { PTD.tables.get('t1').visible = false; PTD.core.renderStage(); });
  ok(await p.isDisabled('[data-act="placeorigin"]'), 'the button is greyed out when no table is visible');
  await ev(() => { PTD.tables.get('t1').visible = true; PTD.core.renderStage(); });
  ok(!(await p.isDisabled('[data-act="placeorigin"]')), 'and enabled again when a table is visible');

  ok(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
