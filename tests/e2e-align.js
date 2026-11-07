/* Browser checks for alignment: the target, the handles with arrows and ghosts, dragging onto the target, Alt, the quick buttons.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-align.js */
const { chromium } = require('playwright');
const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t = 0.05) => Math.abs(a - b) <= t;
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(600);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const o = PTD.random.opts; Object.keys(o).forEach(k => { if (/(Vary|Set)$/.test(k)) o[k] = false; }); o.shape = false; });
  const bx = (id) => ev((id) => { const q = PTD.core.ui.bounds[id]; return q ? { x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h } : null; }, id);
  const toClient = (w) => ev((w) => { const r = document.getElementById('stage').getBoundingClientRect(), v = PTD.core.ui.view; return { x: r.left + r.width / 2 + (w.x - v.cx) * v.z, y: r.top + r.height / 2 + (w.y - v.cy) * v.z }; }, w);
  const msg = () => ev(() => document.getElementById('toolMsg').textContent);
  const selectNormal = (ids) => ev((ids) => { const s = PTD.core.state(), u = PTD.core.ui; s.selected = ids[0] || null; u.extra = {}; ids.slice(1).forEach(k => { u.extra[k] = true; }); PTD.core.renderStage(); }, ids);
  const menu = async (what, mods) => { await p.click('#alignBtn'); await p.click('[data-align="' + what + '"]', mods ? { modifiers: mods } : undefined); };
  const reset = async () => { await ev(() => { const s = PTD.core.state(); const L = s.layers; L[0].x = -170; L[0].y = -65; L[1].x = 190; L[1].y = -65; L[2].x = 0; L[2].y = 242; L.forEach(l => { l.rot = 0; }); PTD.core.ui.tool === 'align' && PTD.core.setTool('select'); PTD.core.ui.extra = {}; PTD.core.renderStage(); }); };
  await ev(() => { const s = PTD.core.state(); s.layers[2].x = 0; PTD.core.renderStage(); });
  await reset();

  // ---- the menu
  ok(await p.locator('#alignBtn').count() === 1 && await p.locator('#alignMenu [data-align]').count() === 10, 'the toolbar has the Align menu with ten entries');
  await p.click('#alignBtn');
  ok(await ev(() => document.getElementById('alignWrap').classList.contains('open')), 'a click opens the Align menu');
  await p.click('#alignBtn');

  // ---- quick buttons without a target: every object to the box around the selection
  const b0 = [await bx('l1'), await bx('l2'), await bx('l3')];
  await selectNormal(['l1', 'l2', 'l3']);
  await menu('L');
  let a = [await bx('l1'), await bx('l2'), await bx('l3')];
  const minL = Math.min(...b0.map(q => q.x0));
  ok(a.every(q => near(q.x0, minL)), 'Align left puts the left edges on the leftmost one');
  await p.mouse.click(5, 5); await p.keyboard.press('Control+z');
  a = [await bx('l1'), await bx('l2'), await bx('l3')];
  ok(a.every((q, i) => near(q.x0, b0[i].x0)), 'one Undo step brings the objects back');
  await selectNormal(['l1', 'l2', 'l3']); await menu('R');
  a = [await bx('l1'), await bx('l2'), await bx('l3')];
  const maxR = Math.max(...b0.map(q => q.x1));
  ok(a.every(q => near(q.x1, maxR)), 'Align right puts the right edges on the rightmost one');
  await reset(); await selectNormal(['l1', 'l2', 'l3']); await menu('C');
  a = [await bx('l1'), await bx('l2'), await bx('l3')];
  const cMid = (Math.min(...b0.map(q => q.x0)) + Math.max(...b0.map(q => q.x1))) / 2;
  ok(a.every(q => near((q.x0 + q.x1) / 2, cMid)), 'Align centre puts the centres on the middle of the selection box');
  await reset(); await selectNormal(['l1', 'l2', 'l3']); await menu('T');
  a = [await bx('l1'), await bx('l2'), await bx('l3')];
  ok(a.every(q => near(q.y0, Math.min(...b0.map(z => z.y0)))), 'Align top puts the top edges on the highest one');
  await reset(); await selectNormal(['l1', 'l2', 'l3']); await menu('B');
  a = [await bx('l1'), await bx('l2'), await bx('l3')];
  ok(a.every(q => near(q.y1, Math.max(...b0.map(z => z.y1)))), 'Align bottom puts the bottom edges on the lowest one');
  await reset(); await selectNormal(['l1', 'l2', 'l3']); await menu('M');
  a = [await bx('l1'), await bx('l2'), await bx('l3')];
  const mm = (Math.min(...b0.map(q => q.y0)) + Math.max(...b0.map(q => q.y1))) / 2;
  ok(a.every(q => near((q.y0 + q.y1) / 2, mm)), 'Align middle puts the vertical centres on the middle of the selection box');

  // ---- distribute
  await reset();
  await ev(() => { const L = PTD.core.state().layers; L[0].x = -600; L[1].x = -300; L[2].x = 700; PTD.core.renderStage(); });
  await selectNormal(['l1', 'l2', 'l3']); await menu('distx');
  a = [await bx('l1'), await bx('l2'), await bx('l3')];
  const ord = a.slice().sort((p1, p2) => p1.x0 - p2.x0), g1 = ord[1].x0 - ord[0].x1, g2 = ord[2].x0 - ord[1].x1;
  ok(near(g1, g2, 0.1), 'Distribute across makes the gaps equal: ' + g1.toFixed(2) + ' and ' + g2.toFixed(2));
  await reset(); await selectNormal(['l1', 'l2']); await menu('distx');
  ok(/three or more/.test(await msg()), 'Distribute with two objects says it needs three');

  // ---- the target: a box, the handles, the arrow and the ghosts, a click moves
  await reset(); await selectNormal(['l3']); await menu('target');
  let st = await ev(() => PTD.align.state());
  ok(st.tool === 'align' && st.target && st.target.kind === 'box' && st.items.length === 0, 'Set alignment target turns the selected text into a box target and starts the align mode');
  const uid1 = await ev(() => PTD.core.getLayer('l1').uid);
  const c1 = await bx('l1'); const mid1 = await toClient({ x: (c1.x0 + c1.x1) / 2, y: (c1.y0 + c1.y1) / 2 });
  await p.mouse.click(mid1.x, mid1.y);
  st = await ev(() => PTD.align.state());
  ok(st.items.length === 1 && st.items[0] === 'text:' + uid1, 'a click on a text selects it as the object to move');
  ok(await ev(() => PTD.align.handles().length) === 9, 'a large box shows nine handles');
  const hTL = await ev(() => PTD.align.handles().filter(h => h.f[0] === 0 && h.f[1] === 0)[0].p);
  const hc = await toClient(hTL); await p.mouse.move(hc.x, hc.y);
  ok(await ev(() => PTD.align.state().hasPreview), 'the pointer near a handle shows the arrow and the ghosts');
  const t3 = await bx('l3');
  await p.mouse.click(hc.x, hc.y);
  a = await bx('l1');
  ok(near(a.x0, t3.x0, 0.1) && near(a.y0, t3.y0, 0.1), 'a click on the top left handle puts the top left corner on the top left corner of the target');
  ok(await ev(() => !!PTD.align.state().target), 'the target stays after an alignment');

  // ---- dragging a handle onto a line of the target: one axis only
  await reset(); await ev(() => { PTD.core.setTool('align'); }); await selectNormal([]);
  await ev(() => { PTD.align.select(['text:' + PTD.core.getLayer('l3').uid]); });
  await p.click('#alignBtn'); await p.click('[data-align="target"]');
  await ev((u) => { PTD.align.select(['text:' + u]); }, await ev(() => PTD.core.getLayer('l2').uid));
  const T = await bx('l3'), l2b = await bx('l2');
  const hL = await ev(() => PTD.align.handles().filter(h => h.f[0] === 0 && h.f[1] === 0.5)[0].p);
  const from = await toClient(hL), to = await toClient({ x: T.x1, y: T.y0 - 120 });
  await p.mouse.move(from.x, from.y); await p.mouse.down(); await p.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 }); await p.mouse.move(to.x, to.y, { steps: 4 });
  ok(await ev(() => PTD.align.state().hasPreview && PTD.align.state().drag), 'while dragging a handle the arrow and the ghosts follow the pointer');
  await p.mouse.up();
  a = await bx('l2');
  ok(near(a.x0, T.x1, 0.1) && near(a.y0, l2b.y0, 0.1), 'dropping the left middle handle on the right edge line of the target moves the box sideways only');

  // ---- dropping on nothing cancels
  const before = await bx('l2'), h2 = await ev(() => PTD.align.handles().filter(h => h.f[0] === 0.5 && h.f[1] === 0.5)[0].p);
  const f2 = await toClient(h2), nowhere = await toClient({ x: -1500, y: 800 });
  await p.mouse.move(f2.x, f2.y); await p.mouse.down(); await p.mouse.move(nowhere.x, nowhere.y, { steps: 5 }); await p.mouse.up();
  a = await bx('l2');
  ok(near(a.x0, before.x0) && near(a.y0, before.y0) && /cancel/i.test(await msg()), 'releasing on nothing cancels: nothing moves');

  // ---- Alt: every object by itself
  await reset(); await ev(() => { PTD.core.setTool('align'); });
  await ev(() => { PTD.align.select(['text:' + PTD.core.getLayer('l3').uid]); }); await p.click('#alignBtn'); await p.click('[data-align="target"]');
  await ev(() => { PTD.align.select(['text:' + PTD.core.getLayer('l1').uid, 'text:' + PTD.core.getLayer('l2').uid]); });
  const T3 = await bx('l3');
  const gTL = await toClient(await ev(() => PTD.align.handles().filter(h => h.f[0] === 0 && h.f[1] === 0)[0].p));
  await p.mouse.move(gTL.x, gTL.y); await p.keyboard.down('Alt'); await p.mouse.click(gTL.x, gTL.y); await p.keyboard.up('Alt');
  a = [await bx('l1'), await bx('l2')];
  ok(a.every(q => near(q.x0, T3.x0, 0.1) && near(q.y0, T3.y0, 0.1)), 'with Alt every object puts its own top left corner on the target');

  // ---- group mode keeps the objects together
  await reset(); await ev(() => { PTD.core.setTool('align'); });
  await ev(() => { PTD.align.select(['text:' + PTD.core.getLayer('l3').uid]); }); await p.click('#alignBtn'); await p.click('[data-align="target"]');
  await ev(() => { PTD.align.select(['text:' + PTD.core.getLayer('l1').uid, 'text:' + PTD.core.getLayer('l2').uid]); });
  const gb1 = [await bx('l1'), await bx('l2')], sp0 = gb1[1].x0 - gb1[0].x0;
  const gTL2 = await toClient(await ev(() => PTD.align.handles().filter(h => h.f[0] === 0 && h.f[1] === 0)[0].p));
  await p.mouse.move(gTL2.x, gTL2.y); await p.mouse.click(gTL2.x, gTL2.y);
  a = [await bx('l1'), await bx('l2')];
  ok(near(a[1].x0 - a[0].x0, sp0, 0.1), 'as a group the objects keep their distances from each other');
  ok(near(Math.min(a[0].x0, a[1].x0), T3.x0, 0.1) && near(Math.min(a[0].y0, a[1].y0), T3.y0, 0.1), 'and the corner of their common box goes to the corner of the target');

  // ---- a guide as the target: a line; the quick buttons use it
  await reset();
  const gid = await ev(() => { PTD.guides.add('x', 500); return PTD.core.state().guides.slice(-1)[0].id; });
  await ev(() => { PTD.core.setTool('align'); }); await ev((i) => { PTD.align.select(['guide:' + i]); }, gid);
  await p.click('#alignBtn'); await p.click('[data-align="target"]');
  ok(await ev(() => PTD.align.state().target.kind === 'line'), 'a guide becomes a line target');
  await ev(() => { PTD.align.select(['text:' + PTD.core.getLayer('l1').uid, 'text:' + PTD.core.getLayer('l2').uid]); });
  const gs0 = [await bx('l1'), await bx('l2')];
  await menu('R');
  a = [await bx('l1'), await bx('l2')];
  ok(near(Math.max(a[0].x1, a[1].x1), 500, 0.1) && near(a[1].x0 - a[0].x0, gs0[1].x0 - gs0[0].x0, 0.1), 'Align right with a guide target moves the group so that its right edge lies on the guide');
  await ev(() => { PTD.align.select(['text:' + PTD.core.getLayer('l1').uid, 'text:' + PTD.core.getLayer('l2').uid]); });
  await menu('R', ['Alt']);
  a = [await bx('l1'), await bx('l2')];
  ok(a.every(q => near(q.x1, 500, 0.1)), 'with Alt every object puts its own right edge on the guide');
  await menu('T');
  ok(/no vertical extent/.test(await msg()), 'a vertical guide has no vertical extent: top alignment says so');
  // two guides make a point
  const gid2 = await ev(() => { PTD.guides.add('y', 300); return PTD.core.state().guides.slice(-1)[0].id; });
  await ev((i) => { PTD.align.select(['guide:' + i[0], 'guide:' + i[1]]); }, [gid, gid2]);
  await p.click('#alignBtn'); await p.click('[data-align="target"]');
  const tp = await ev(() => PTD.align.state().target);
  ok(tp.kind === 'point' && near(tp.x, 500) && near(tp.y, 300), 'two guides crossing make a point target at their crossing');

  // ---- a control point as the target and as an object to move
  await reset();
  await ev(() => { PTD.cpoints.make({ kind: 'world' }, 300, 200); PTD.cpoints.make({ kind: 'world' }, -400, -300); PTD.core.renderStage(); });
  const cpIds = await ev(() => PTD.core.state().cpoints.map(c => c.id));
  await ev(() => { PTD.core.setTool('align'); }); await ev((i) => { PTD.align.select(['cp:' + i[0]]); }, cpIds);
  await p.click('#alignBtn'); await p.click('[data-align="target"]');
  ok(await ev(() => PTD.align.state().target.kind === 'point'), 'one control point is a point target');
  await ev((i) => { PTD.align.select(['cp:' + i[1]]); }, cpIds);
  await menu('C'); await menu('M');
  const moved = await ev((i) => PTD.cpoints.pos(i[1]), cpIds);
  ok(near(moved.x, 300) && near(moved.y, 200), 'a control point can be moved onto another control point');

  // ---- a table moves; a locked guide refuses
  await ev(() => { PTD.core.setTool('select'); PTD.core.renderStage(); });
  await ev(() => { PTD.core.setTool('align'); PTD.align.select(['cp:' + PTD.core.state().cpoints[0].id]); });
  await p.click('#alignBtn'); await p.click('[data-align="target"]');
  await ev(() => { PTD.align.select(['table:t1']); });
  await menu('C'); await menu('M');
  const tb = await bx('l3'); void tb;
  const tbox = await ev(() => { const t = PTD.core.state().tables[0]; return { x: t.x, y: t.y }; });
  ok(near(tbox.x, 300, 1) && near(tbox.y, 200, 1), 'a table can be moved: its box centre goes on the point');
  await ev((i) => { PTD.core.state().guides.filter(g => g.id === i)[0].locked = true; }, gid);
  await ev((i) => { PTD.align.select(['guide:' + i]); }, gid);
  await p.click('#alignBtn'); await p.click('[data-align="target"]');
  ok(await ev(() => PTD.align.state().target.kind === 'line'), 'a locked guide can still be a target');
  await ev(() => { PTD.align.select(['guide:' + PTD.core.state().guides.slice(-1)[0].id]); });
  await ev((i) => { PTD.core.state().guides.filter(g => g.id === i)[0].locked = false; }, gid);

  // ---- selecting in the align mode: Shift adds, Ctrl removes, an area selects
  await reset(); await ev(() => { PTD.core.setTool('align'); PTD.align.select([]); });
  const u2 = await ev(() => PTD.core.getLayer('l2').uid), l2c = await bx('l2'), l3c = await bx('l3');
  const m2 = await toClient({ x: (l2c.x0 + l2c.x1) / 2, y: (l2c.y0 + l2c.y1) / 2 }), m3 = await toClient({ x: (l3c.x0 + l3c.x1) / 2, y: (l3c.y0 + l3c.y1) / 2 });
  await p.mouse.click(m2.x, m2.y);
  await p.keyboard.down('Shift'); await p.mouse.click(m3.x, m3.y); await p.keyboard.up('Shift');
  ok(await ev(() => PTD.align.state().items.length === 2), 'Shift adds an object to the selection');
  await p.keyboard.down('Control'); await p.mouse.click(m3.x, m3.y); await p.keyboard.up('Control');
  ok(await ev((u) => PTD.align.state().items.join() === 'text:' + u, u2), 'Ctrl removes an object from the selection');
  const sr = await ev(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  const e1 = { x: sr.l + 15, y: sr.t + 15 }, e2 = { x: sr.r - 15, y: sr.b - 15 };
  await p.mouse.move(e1.x, e1.y); await p.mouse.down(); await p.mouse.move(e2.x, e2.y, { steps: 6 }); await p.mouse.up();
  const area = await ev(() => PTD.align.state().items.length);
  ok(area >= 3, 'dragging an area selects the objects in it: ' + area);

  // ---- Esc ends the mode and forgets the target
  await p.keyboard.press('Escape');
  st = await ev(() => PTD.align.state());
  ok(st.tool === 'select' && st.target === null && st.items.length === 0, 'Esc ends the align mode and forgets the target');

  // ---- tooltips and errors
  await ev(() => { PTD.help.applyTips(); });
  const untitled = await ev(() => PTD.help.untitled());
  ok(untitled.length === 0, 'every button and field has a tooltip: ' + untitled.slice(0, 5).join(', '));
  ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
