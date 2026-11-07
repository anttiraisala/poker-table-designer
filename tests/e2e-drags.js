/* Browser checks for REQ-012 (no flash of a fallback font), REQ-013 (resize handles of a text), REQ-014 (the hint line),
 * REQ-017 (the readout next to the pointer), REQ-018 (the options in the Settings) and REQ-019 (the F key).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-drags.js */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t = 1.5) => Math.abs(a - b) <= t;
(async () => {
  const root = path.resolve(__dirname, '..');
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load|ERR_/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.join(root, 'index.html')); await p.waitForTimeout(600);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const o = PTD.random.opts; Object.keys(o).forEach(k => { if (/(Vary|Set)$/.test(k)) o[k] = false; }); o.shape = false; PTD.core.fitView(); });
  const setSel = (ids) => ev((ids) => { const s = PTD.core.state(), u = PTD.core.ui; PTD.core.setTool('select'); s.selected = ids[0] || null; u.extra = {}; ids.slice(1).forEach(k => { u.extra[k] = true; }); ids.forEach(k => { u.open[k] = true; }); PTD.core.setTab('artwork'); PTD.core.renderPanels(); PTD.core.renderStage(); }, ids);
  const toClient = (w) => ev((w) => { const r = document.getElementById('stage').getBoundingClientRect(), v = PTD.core.ui.view; return { x: r.left + r.width / 2 + (w.x - v.cx) * v.z, y: r.top + r.height / 2 + (w.y - v.cy) * v.z }; }, w);
  const zoom = () => ev(() => PTD.core.ui.view.z);
  const lay = (id) => ev((id) => { const l = PTD.core.getLayer(id); return { x: l.x, y: l.y, size: l.size, ls: l.ls, rot: l.rot, font: l.font }; }, id);
  const pt = (id, u, v) => ev(({ id, u, v }) => { const c = PTD.core, l = c.getLayer(id), bx = c.ui.tbox[id], AO = c.artOrigin(); const px = bx.x + u * bx.w, py = bx.y + v * bx.h, a = (l.rot || 0) * Math.PI / 180, dx = px - l.x, dy = py - l.y; return { x: AO.x + l.x + dx * Math.cos(a) - dy * Math.sin(a), y: AO.y + l.y + dx * Math.sin(a) + dy * Math.cos(a) }; }, { id, u, v });
  const hint = () => ev(() => { const n = document.getElementById('opHint'); return { op: n.getAttribute('data-op') || '', text: n.textContent }; });
  const readout = () => ev(() => { const n = document.getElementById('dragReadout'); return { shown: !n.hidden, text: n.textContent }; });
  const msg = () => ev(() => document.getElementById('toolMsg').textContent);
  const undoClick = () => p.click('#undoBtn');
  const settle = () => p.waitForTimeout(1300);
  const stageEmpty = async () => { const r = await ev(() => { const q = document.getElementById('stage').getBoundingClientRect(); return { x: q.left + 15, y: q.top + 15 }; }); return r; };
  const FONT = (id) => '[data-scope="layer:' + id + '"][data-key="font"]';

  // ---- REQ-018: the options in the Settings
  await p.click('#settingsBtn');
  const optSel = '[data-scope="cfg"][data-key="dragReadout"]';
  ok(await p.locator('#settingsPane h3.sec', { hasText: 'Options' }).count() === 1, 'the Settings pane has an Options section');
  ok(await p.isChecked(optSel), 'the readout option is on by default');
  ok(/pointer/i.test(await ev(() => document.querySelector('[data-scope="cfg"][data-key="dragReadout"]').title)), 'the option has a tooltip');
  await p.uncheck(optSel);
  ok(await ev(() => PTD.core.cfg().dragReadout) === false, 'unchecking the option changes the settings');
  await p.waitForTimeout(500);
  await p.reload(); await p.waitForTimeout(700);
  await p.click('#settingsBtn');
  ok(!(await p.isChecked(optSel)), 'the choice is still off after a reload (it is in the settings file)');
  await ev(() => PTD.core.loadText(JSON.stringify({ units: 'mm', snap: true })));
  ok(await ev(() => PTD.core.cfg().dragReadout) === true, 'an old settings file without the key gets the default (on)');
  await p.uncheck(optSel).catch(() => {});
  await p.click('#settingsBtn');   /* back to the tab before */
  await p.click('#settingsBtn');
  await p.click('[data-act="creset"]');
  await p.waitForTimeout(200);
  ok(await ev(() => PTD.core.cfg().dragReadout) === true && await p.isChecked(optSel), 'Reset settings brings the option back to on');
  await p.click('#settingsBtn');
  await ev(() => { const o = PTD.random.opts; Object.keys(o).forEach(k => { if (/(Vary|Set)$/.test(k)) o[k] = false; }); o.shape = false; PTD.core.fitView(); });

  // ---- REQ-014: the hint texts are complete, and every drag names a hint
  const ids = await ev(() => PTD.hints.ids());
  const data = await ev(() => PTD.hints.ids().map(i => PTD.hints.get(i)));
  ok(ids.length >= 20 && data.every(d => d.what && d.what.length > 5 && d.keys.every(k => k.label && k.text)), 'every hint has a text and its keys have a label and an effect');
  const used = new Set();
  ['app.js', 'guides.js', 'cpoints.js', 'measure.js', 'tables.js', 'align.js', 'thandles.js'].forEach(f => {
    const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
    (src.match(/\bop:\s*[^,\n]+,/g) || []).forEach(m => (m.match(/"([a-z-]+)"/g) || []).forEach(q => used.add(q.replace(/"/g, ''))));
  });
  ok(used.size >= 14 && [...used].every(i => ids.includes(i)), 'every operation id used by a drag in the code has a hint (' + used.size + ' ids)');
  ok(['tool-dim', 'tool-measure', 'tool-cpoint', 'tool-align', 'tool-guide'].every(i => ids.includes(i)), 'every tool has a hint');

  // ---- tools show their hint, and it goes away with the tool
  await ev(() => PTD.core.setTool('measure'));
  let h = await hint();
  ok(h.op === 'tool-measure' && /Tab/.test(h.text) && /Enter/.test(h.text) && /Esc/.test(h.text), 'the Measure tool shows its hint with its keys');
  await ev(() => PTD.core.setTool('select'));
  ok((await hint()).op === '', 'the hint is gone when the tool ends');
  for (const [t, op] of [['dim', 'tool-dim'], ['cpoint', 'tool-cpoint'], ['align', 'tool-align'], ['guideX', 'tool-guide']]) {
    await ev((t) => PTD.core.setTool(t), t);
    ok((await hint()).op === op, 'the tool ' + t + ' shows the hint ' + op);
  }
  await ev(() => PTD.core.setTool('select'));

  // ---- moving a text: hint, readout, snapping keys, Esc
  await ev(() => { PTD.core.cfg().snap = true; const L = PTD.core.state().layers; L.forEach(l => { l.rot = 0; }); PTD.core.renderStage(); });
  await setSel(['l1']);
  const z = await zoom();
  const bb = await ev(() => PTD.core.ui.bounds.l1);
  const gx = bb.x + 100;   /* a vertical guide 100 mm to the right of the left edge of the text */
  const gid = await ev((x) => { PTD.guides.add('x', x); const g = PTD.core.state().guides; return g[g.length - 1].id; }, gx);
  await setSel(['l1']);
  const c0 = await toClient({ x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 });
  const x0 = (await lay('l1')).x;
  await p.mouse.move(c0.x, c0.y); await p.mouse.down();
  await p.mouse.move(c0.x + 98 * z, c0.y, { steps: 6 });
  h = await hint();
  ok(h.op === 'move' && /Drag to move/.test(h.text) && /Alt or Ctrl/.test(h.text) && /Esc/.test(h.text), 'moving a text shows the hint of a move with its keys');
  let r = await readout();
  ok(r.shown && /dx .*dy/.test(r.text), 'the readout next to the pointer shows dx and dy while dragging (' + r.text + ')');
  ok(await ev((g) => { const s = PTD.core.ui.snapLines; return !!(s && s.x && s.x.some(v => Math.abs(v - g) < 0.01)); }, gx), 'the move snaps to the guide');
  await p.keyboard.down('Alt');
  await p.waitForTimeout(50);
  ok(await ev(() => { const s = PTD.core.ui.snapLines; return !s || !(s.x && s.x.length); }), 'pressing Alt during the drag switches snapping off at once');
  ok(await ev(() => document.querySelector('#opHint .k.held') !== null), 'the held key is marked in the hint');
  await p.keyboard.up('Alt');
  await p.waitForTimeout(50);
  ok(await ev((g) => { const s = PTD.core.ui.snapLines; return !!(s && s.x && s.x.some(v => Math.abs(v - g) < 0.01)); }, gx), 'releasing Alt brings the snap back');
  await p.keyboard.down('Control'); await p.waitForTimeout(50);
  ok(await ev(() => { const s = PTD.core.ui.snapLines; return !s || !(s.x && s.x.length); }), 'Ctrl switches snapping off as well');
  await p.keyboard.up('Control');
  await p.keyboard.press('Escape');
  ok((await lay('l1')).x === x0, 'Esc during the drag puts the text back where it was');
  ok((await hint()).op === '' && !(await readout()).shown, 'the hint and the readout are gone after Esc');
  await p.mouse.up();
  ok((await lay('l1')).x === x0, 'releasing the button after Esc changes nothing');
  ok(await ev(() => PTD.core.state().selected === 'l1'), 'the selection is kept after Esc');
  await p.mouse.move(c0.x, c0.y); await p.mouse.down(); await p.mouse.move(c0.x + 30 * z, c0.y + 10 * z, { steps: 4 }); await p.mouse.up();
  ok((await hint()).op === '' && !(await readout()).shown, 'the hint and the readout are gone when the drag ends');
  const moved = await lay('l1');
  ok(moved.x !== x0, 'a normal drag still moves the text');
  await undoClick();
  ok((await lay('l1')).x === x0, 'one Undo takes the move back');
  await ev((id) => PTD.guides.remove(id), gid);

  // ---- the readout can be switched off
  await ev(() => { PTD.core.cfg().dragReadout = false; });
  await p.mouse.move(c0.x, c0.y); await p.mouse.down(); await p.mouse.move(c0.x + 30 * z, c0.y, { steps: 4 });
  ok(!(await readout()).shown, 'with the option off no readout is shown');
  ok((await hint()).op === 'move', 'the hint is shown without the readout');
  await p.mouse.up(); await undoClick();
  await ev(() => { PTD.core.cfg().dragReadout = true; });

  // ---- area selection: Esc gives the old selection back
  await setSel(['l1']);
  const b2 = await ev(() => PTD.core.ui.bounds.l2);
  const s0 = await stageEmpty(), e0 = await toClient({ x: b2.x + b2.w + 20, y: b2.y + b2.h + 20 });
  await p.keyboard.down('Shift');
  await p.mouse.move(s0.x, s0.y); await p.mouse.down(); await p.mouse.move(e0.x, e0.y, { steps: 8 });
  h = await hint(); r = await readout();
  ok(h.op === 'marquee' && /Shift or Ctrl/.test(h.text), 'an area selection shows its hint');
  ok(r.shown && /selected/.test(r.text) && /x/.test(r.text), 'the readout of an area shows its size and the count (' + r.text + ')');
  ok(await ev(() => PTD.core.selectedIds().length) > 1, 'the area adds texts to the selection');
  await p.keyboard.press('Escape'); await p.mouse.up(); await p.keyboard.up('Shift');
  ok(await ev(() => PTD.core.selectedIds().join(',')) === 'l1', 'Esc during an area selection gives the selection from before back');

  // ---- a guide: hint, readout, Esc
  await ev(() => { PTD.guides.add('x', -330); });
  const g2 = await ev(() => { const g = PTD.core.state().guides; return g[g.length - 1]; });
  const gc0 = await toClient({ x: -330, y: 0 }), gTop = await stageEmpty(), gc = { x: gc0.x, y: gTop.y + 30 };   /* the guide is endless: press it far from the texts */
  const gAbs = await ev((id) => PTD.guides.abs(PTD.guides.get(id)), g2.id);
  await p.mouse.move(gc.x, gc.y); await p.mouse.down(); await p.mouse.move(gc.x + 40, gc.y, { steps: 5 });
  h = await hint(); r = await readout();
  ok(h.op === 'guide' && r.shown && /^X /.test(r.text), 'dragging a guide shows its hint and its position (' + r.text + ')');
  ok(await ev((a) => Math.abs(PTD.guides.abs(PTD.guides.get(PTD.core.state().guides.slice(-1)[0].id)) - a) > 1, gAbs), 'the guide moved during the drag');
  await p.keyboard.press('Escape'); await p.mouse.up();
  ok(await ev(([id, a]) => Math.abs(PTD.guides.abs(PTD.guides.get(id)) - a) < 0.01, [g2.id, gAbs]), 'Esc puts the guide back');
  await ev((id) => PTD.guides.remove(id), g2.id);

  // ---- placing a guide: Alt switches snapping off
  await ev(() => { PTD.guides.add('x', 400); PTD.core.setTool('guideX'); });
  const gcl = await toClient({ x: 402, y: 0 });
  await p.mouse.click(gcl.x, gcl.y);
  const pos1 = await ev(() => PTD.core.state().guides.slice(-1)[0] && PTD.guides.abs(PTD.core.state().guides.slice(-1)[0]));
  await ev(() => { const gs = PTD.core.state().guides; PTD.guides.remove(gs[gs.length - 1].id); PTD.core.setTool('guideX'); });
  await p.keyboard.down('Alt'); await p.mouse.click(gcl.x, gcl.y); await p.keyboard.up('Alt');
  const pos2 = await ev(() => PTD.guides.abs(PTD.core.state().guides.slice(-1)[0]));
  ok(near(pos1, 400, 0.05) && near(pos2, 402, 0.6), 'placing a guide snaps to a near guide, and with Alt it does not (' + pos1 + ', ' + pos2 + ')');
  await ev(() => { PTD.core.state().guides.slice().forEach(g => PTD.guides.remove(g.id)); });
  await ev(() => PTD.core.setTool('select'));

  // ---- pan and scrub hints
  const stg = await ev(() => { const q = document.getElementById('stage').getBoundingClientRect(); return { x: q.left + q.width - 60, y: q.top + q.height - 60 }; });
  await p.mouse.move(stg.x, stg.y); await p.mouse.down({ button: 'right' }); await p.mouse.move(stg.x - 30, stg.y - 20, { steps: 3 });
  ok((await hint()).op === 'pan', 'panning shows its hint');
  await p.mouse.up({ button: 'right' });
  ok((await hint()).op === '', 'the pan hint ends with the drag');
  await setSel(['l1']);
  const sbox = await p.locator('[data-scope="layer:l1"][data-key="size"][type="number"]').boundingBox();
  await p.mouse.move(sbox.x + 8, sbox.y + sbox.height / 2); await p.mouse.down(); await p.mouse.move(sbox.x + 30, sbox.y + sbox.height / 2, { steps: 4 });
  h = await hint();
  ok(h.op === 'scrub' && /Shift/.test(h.text) && /Alt/.test(h.text), 'scrubbing a number shows its hint');
  await p.mouse.up(); await undoClick().catch(() => {});

  // ---- REQ-013: the handles
  await ev(() => { PTD.core.cfg().snap = false; const l = PTD.core.getLayer('l1'); l.rot = 0; l.size = 100; l.ls = 2; PTD.core.renderStage(); PTD.core.save(); });
  await settle();
  await setSel(['l1']);
  let hs = await ev(() => PTD.thandles.handles().length);
  ok(hs === 8, 'one selected text has eight handles (' + hs + ')');
  ok(await ev(() => document.querySelectorAll('[data-h^="thandle:"]').length) === 8, 'the handles are on the stage');
  await setSel(['l1', 'l2']);
  ok(await ev(() => PTD.thandles.handles().length) === 0, 'with two texts selected there are no handles');
  await setSel(['band']);
  ok(await ev(() => PTD.thandles.handles().length) === 0, 'the lines and cards have no handles');
  await ev(() => { const l = PTD.core.getLayer('l2'); l.frozen = { d: 'M0 0L40 0L40 20Z', x0: 0, y0: 0, x1: 40, y1: 20 }; PTD.core.renderStage(); });
  await setSel(['l2']);
  ok(await ev(() => PTD.thandles.handles().length) === 0, 'a frozen text has no handles');
  await ev(() => { PTD.core.getLayer('l2').frozen = null; PTD.core.renderStage(); });
  await ev(() => PTD.core.setTool('measure'));
  await setSel(['l1']);
  await ev(() => PTD.core.setTool('measure'));
  ok(await ev(() => PTD.thandles.handles().length) === 0, 'there are no handles outside the Select tool');
  await ev(() => PTD.core.setTool('select'));

  async function scale(id, u, v, dx, dy, o = {}) {
    const h0 = await pt(id, u, v), c = await toClient(h0);
    await p.mouse.move(c.x, c.y);
    if (o.shift) await p.keyboard.down('Shift');
    await p.mouse.down();
    await p.mouse.move(c.x + dx, c.y + dy, { steps: 6 });
    return { h0, c };
  }
  async function finish(o = {}) { await p.mouse.up(); if (o.shift) await p.keyboard.up('Shift'); }

  // corner: the opposite corner stays, the factor follows the diagonal
  await setSel(['l1']);
  let a = await lay('l1'), F = await pt('l1', 1, 1), H0 = await pt('l1', 0, 0);
  let zz = await zoom();
  let dxp = -60, dyp = -30;
  let d0 = { x: H0.x - F.x, y: H0.y - F.y }, dl = { x: dxp / zz, y: dyp / zz };
  let kExp = ((d0.x + dl.x) * d0.x + (d0.y + dl.y) * d0.y) / (d0.x * d0.x + d0.y * d0.y);
  await scale('l1', 0, 0, dxp, dyp);
  h = await hint(); r = await readout();
  ok(h.op === 'text-scale' && /Shift/.test(h.text) && /scale from the centre/.test(h.text) && /Alt or Ctrl/.test(h.text), 'scaling by a handle shows its hint with Shift, Alt or Ctrl and Esc');
  ok(r.shown && /^Size [0-9.]+ mm +x[0-9.]+$/.test(r.text), 'the readout shows the size and the factor (' + r.text + ')');
  await finish();
  let a1 = await lay('l1'), F1 = await pt('l1', 1, 1);
  ok(near(F1.x, F.x) && near(F1.y, F.y), 'the opposite corner stays in place (' + F.x.toFixed(1) + ',' + F.y.toFixed(1) + ' to ' + F1.x.toFixed(1) + ',' + F1.y.toFixed(1) + ')');
  ok(Math.abs(a1.size / a.size - kExp) < 0.015, 'the size follows the diagonal: factor ' + (a1.size / a.size).toFixed(3) + ' expected ' + kExp.toFixed(3));
  ok(Math.abs(a1.ls / a.ls - a1.size / a.size) < 0.01, 'the letter space scales with the size');
  ok((await hint()).op === '' && !(await readout()).shown, 'the hint and the readout end with the drag');
  await undoClick();
  let a2 = await lay('l1');
  ok(a2.size === a.size && a2.x === a.x && a2.y === a.y && a2.ls === a.ls, 'one Undo takes the whole scaling back');

  // a side handle: the opposite side and the centre line stay
  await settle();
  await setSel(['l1']);
  a = await lay('l1'); const R0 = await pt('l1', 1, 0.5);
  await scale('l1', 0, 0.5, -50, 25);
  await finish();
  a1 = await lay('l1'); const R1 = await pt('l1', 1, 0.5);
  ok(near(R1.x, R0.x) && near(R1.y, R0.y), 'a side handle keeps the opposite side and the centre line in place');
  ok(a1.size > a.size, 'dragging a side handle outwards makes the text bigger');
  await undoClick();

  // Shift: the centre stays, also when Shift is pressed and released during the drag
  await settle();
  await setSel(['l1']);
  a = await lay('l1'); const C0 = await pt('l1', 0.5, 0.5); F = await pt('l1', 1, 1);
  await scale('l1', 0, 0, -50, -25, { shift: true });
  await finish({ shift: true });
  const C1 = await pt('l1', 0.5, 0.5);
  ok(near(C1.x, C0.x) && near(C1.y, C0.y), 'with Shift the centre of the text stays in place');
  await undoClick(); await settle();
  await setSel(['l1']);
  await scale('l1', 0, 0, -50, -25);
  let Fm = await pt('l1', 1, 1);
  ok(near(Fm.x, F.x) && near(Fm.y, F.y), 'without Shift the opposite corner stays during the drag');
  await p.keyboard.down('Shift'); await p.waitForTimeout(60);
  let Cm = await pt('l1', 0.5, 0.5);
  ok(near(Cm.x, C0.x) && near(Cm.y, C0.y), 'pressing Shift during the drag switches to scaling from the centre at once');
  await p.keyboard.up('Shift'); await p.waitForTimeout(60);
  Fm = await pt('l1', 1, 1);
  ok(near(Fm.x, F.x) && near(Fm.y, F.y), 'releasing Shift switches back');
  await p.keyboard.press('Escape');
  a2 = await lay('l1');
  ok(a2.size === a.size && a2.x === a.x, 'Esc during the scaling puts the text back');
  await p.mouse.up();
  ok((await lay('l1')).size === a.size, 'releasing the button after Esc changes nothing');

  // the size is kept between 1 and 3000 mm; a drag past the opposite corner does not mirror the text
  await setSel(['l1']);
  await scale('l1', 0, 0, 2000, 1500);
  const aMin = await lay('l1');
  ok(aMin.size >= 1 && aMin.size < 2, 'dragging past the opposite corner stops at the smallest size (' + aMin.size + ')');
  await finish(); await undoClick(); await settle();

  // a turned text: the opposite corner stays in place
  await ev(() => { const l = PTD.core.getLayer('l1'); l.rot = 30; PTD.core.renderStage(); PTD.core.save(); });
  await settle();
  await setSel(['l1']);
  F = await pt('l1', 0, 0);
  await scale('l1', 1, 1, 50, 30);
  await finish();
  F1 = await pt('l1', 0, 0);
  ok(near(F1.x, F.x) && near(F1.y, F.y), 'a turned text keeps the opposite corner in place (' + F.x.toFixed(1) + ',' + F.y.toFixed(1) + ' to ' + F1.x.toFixed(1) + ',' + F1.y.toFixed(1) + ')');
  ok((await lay('l1')).size > 100, 'the turned text became bigger');
  await undoClick();
  await ev(() => { const l = PTD.core.getLayer('l1'); l.rot = 0; PTD.core.renderStage(); PTD.core.save(); });

  // snapping: a guide near the edge catches it, Alt does not
  await settle();
  await ev(() => { PTD.core.cfg().snap = true; });
  await setSel(['l1']);
  const L0 = await pt('l1', 0, 0.5), R2 = await pt('l1', 1, 0.5);
  const targetX = L0.x - 40;
  await ev((x) => { PTD.guides.add('x', x); }, targetX);
  await setSel(['l1']);
  await scale('l1', 0, 0.5, -38 * zz, 0);
  ok(await ev((x) => { const s = PTD.core.ui.snapLines; return !!(s && s.x && s.x.some(v => Math.abs(v - x) < 0.01)); }, targetX), 'a handle drag snaps to a guide');
  await finish();
  ok(near((await pt('l1', 0, 0.5)).x, targetX, 0.8), 'the dragged edge lands on the guide');
  await undoClick(); await settle();
  await setSel(['l1']);
  await scale('l1', 0, 0.5, -38 * zz, 0);
  await p.keyboard.down('Alt'); await p.waitForTimeout(60);
  ok(await ev(() => { const s = PTD.core.ui.snapLines; return !s || !(s.x && s.x.length); }), 'Alt during a handle drag switches snapping off');
  await p.keyboard.up('Alt');
  await finish(); await undoClick();
  await ev(() => { PTD.core.state().guides.slice().forEach(g => PTD.guides.remove(g.id)); PTD.core.cfg().snap = false; });

  // hovering a handle shows the hint before anything is pressed
  await setSel(['l1']);
  const hc = await toClient(await pt('l1', 1, 0));
  await p.mouse.move(hc.x + 100, hc.y + 100); await p.mouse.move(hc.x, hc.y);
  ok((await hint()).op === 'text-scale', 'the pointer on a handle shows the hint');
  await p.mouse.move(hc.x + 200, hc.y + 150);
  ok((await hint()).op === '', 'the hint goes when the pointer leaves the handle');

  // ---- REQ-019: the F key
  await ev(() => { PTD.core.cfg().snap = true; });
  const e1 = await stageEmpty(); await p.mouse.click(e1.x, e1.y);
  await p.keyboard.press('f');
  ok(/No text selected/.test(await msg()), 'F with nothing selected says that no text is selected');
  await setSel(['band']);
  await p.keyboard.press('f');
  ok(/No text selected/.test(await msg()), 'F with only the lines and cards selected says the same');
  await ev(() => PTD.core.setTool('measure'));
  await p.keyboard.press('f');
  ok(/Select tool/.test(await msg()), 'F in another tool says that it works in the Select tool');
  await ev(() => PTD.core.setTool('select'));
  await ev(() => { const l = PTD.core.getLayer('l1'); l.frozen = { d: 'M0 0L40 0L40 20Z', x0: 0, y0: 0, x1: 40, y1: 20 }; PTD.core.renderStage(); });
  await setSel(['l1']);
  await p.keyboard.press('f');
  ok(/frozen/.test(await msg()), 'F with only a frozen text selected says that it is frozen');
  await ev(() => { PTD.core.getLayer('l1').frozen = null; PTD.core.renderStage(); });

  // the topmost of several selected texts, an other tab, a closed panel
  await setSel(['l1', 'l2', 'l3']);
  const topId = await ev(() => { const ps = Array.from(document.querySelectorAll('.panel.layer.sel')); ps.sort((x, y) => Number(x.style.order) - Number(y.style.order)); return ps[0].getAttribute('data-panel'); });
  await ev(() => { PTD.core.setTab('tables'); });
  await ev(() => { PTD.core.ui.open[PTD.core.state().selected] = false; });
  await p.keyboard.press('f');
  ok(await ev(() => PTD.core.ui.tab) === 'artwork', 'F brings the Artwork tab forward');
  const focusScope = await ev(() => document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.scope : '');
  ok(focusScope === 'layer:' + topId, 'F focuses the font field of the topmost selected text in the list (' + focusScope + ', expected layer:' + topId + ')');
  ok(await ev(() => !document.getElementById('fontMenu').hidden), 'F opens the font list');
  ok(await ev((id) => !!document.querySelector('[data-panel="' + id + '"] [data-fontinput]'), topId), 'a closed panel was opened');
  const orig = await ev(() => ['l1', 'l2', 'l3'].map(i => PTD.core.getLayer(i).font));
  await p.keyboard.press('ArrowDown');
  const now = await ev(() => ['l1', 'l2', 'l3'].map(i => PTD.core.getLayer(i).font));
  ok(now[0] === now[1] && now[1] === now[2] && now[0] !== orig[0], 'the arrows then change all the selected texts');
  await p.keyboard.press('Enter');
  ok(await ev(() => document.activeElement === document.body), 'after Enter the font field has let go of the focus');
  await p.keyboard.press('Control+z');
  ok(JSON.stringify(await ev(() => ['l1', 'l2', 'l3'].map(i => PTD.core.getLayer(i).font))) === JSON.stringify(orig), 'Ctrl+Z undoes the font change at once');
  await p.keyboard.press('f');
  ok(await ev(() => !document.getElementById('fontMenu').hidden), 'F opens the list again');
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Escape');
  ok(await ev(() => document.activeElement === document.body && document.getElementById('fontMenu').hidden), 'Esc closes the list and the field lets go of the focus');
  ok(JSON.stringify(await ev(() => ['l1', 'l2', 'l3'].map(i => PTD.core.getLayer(i).font))) === JSON.stringify(orig), 'Esc put every font back');
  await p.keyboard.press('Escape');
  ok(await ev(() => PTD.core.ui.tool) === 'select', 'a second Esc is the normal Esc again');
  await p.keyboard.press('Control+f');
  ok(await ev(() => document.getElementById('fontMenu').hidden), 'Ctrl+F does not open the font list');
  await p.focus('[data-scope="layer:' + topId + '"][data-key="size"][type="number"]');
  await p.keyboard.press('f');
  ok(await ev(() => document.getElementById('fontMenu').hidden) && await ev(() => document.activeElement.dataset.key) === 'size', 'F in a number field does nothing');
  await p.keyboard.press('Escape'); await p.mouse.click(e1.x, e1.y);

  // ---- REQ-012: no fallback flash while the previewed font is loading
  await setSel(['l1']);
  const start = (await lay('l1')).font;
  await ev((s) => { const orig = PTD.fonts.status; window.__origStatus = orig; PTD.fonts.status = (n) => (n === s ? orig(n) : 'loading'); }, start);
  const cssOf = (font) => ev((f) => { const s = document.createElement('span'); s.style.fontFamily = PTD.core.fontFamilyCss(f); return s.style.fontFamily; }, font);
  const drawn = () => ev(() => { const l = PTD.core.getLayer('l1'); const t = Array.from(document.querySelectorAll('#stage text')).filter(n => n.textContent === l.text)[0]; return t ? t.style.fontFamily : null; });
  const before = await drawn();
  await p.keyboard.press('f');
  await p.keyboard.press('ArrowDown');
  const nameNow = (await lay('l1')).font;
  ok(nameNow !== start, 'the text has the new font name at once');
  ok(await drawn() === before, 'while the new font is loading the stage keeps drawing the old font (no fallback flash)');
  ok(/Loading the font/.test(await ev(() => document.querySelector('[data-fstat="l1"]').textContent)), 'the font status line says that the font is loading');
  await ev(() => { PTD.fonts.status = window.__origStatus; });
  await ev((n) => { PTD.fonts.status = (x) => (x === n ? 'ok' : window.__origStatus(x)); PTD.core.renderStage(); }, nameNow);
  ok(await drawn() === await cssOf(nameNow), 'when the font is ready the stage shows it');
  await p.keyboard.press('ArrowDown');
  await ev((n) => { PTD.fonts.status = (x) => (x === n ? 'ok' : 'loading'); }, (await lay('l1')).font);
  await p.keyboard.press('Escape');
  await ev(() => { PTD.fonts.status = window.__origStatus; PTD.core.renderStage(); });
  ok((await lay('l1')).font === start && await drawn() === before, 'Esc puts the original font back, drawn and in the model');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
