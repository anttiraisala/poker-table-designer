/* Browser checks for control points: points that hang on a parent and follow it.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-cpoints.js */
const { chromium } = require('playwright');
const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t = 0.02) => Math.abs(a - b) <= t;
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(600);
  const ev = (f, a) => p.evaluate(f, a);
  /* the randomizer's shipped defaults change many things; these tests start from a neutral set */
  await ev(() => { const o = PTD.random.opts; Object.keys(o).forEach(k => { if (/(Vary|Set)$/.test(k)) o[k] = false; }); o.shape = false; });
  const toClient = (w) => ev((w) => { const r = document.getElementById('stage').getBoundingClientRect(), v = PTD.core.ui.view; return { x: r.left + r.width / 2 + (w.x - v.cx) * v.z, y: r.top + r.height / 2 + (w.y - v.cy) * v.z }; }, w);
  const pos = (id) => ev((id) => PTD.cpoints.pos(id), id);
  const cpOf = (id) => ev((id) => JSON.parse(JSON.stringify(PTD.cpoints.get(id) || null)), id);
  const anchorOf = (uid) => ev((uid) => { const s = PTD.core.state(), l = s.layers.filter(l => l.uid === uid)[0]; return { x: s.origin.x + l.x, y: s.origin.y + l.y }; }, uid);

  // ---- nothing yet, and the tool exists
  ok(await ev(() => Array.isArray(PTD.core.state().cpoints) && PTD.core.state().cpoints.length === 0), 'a new project has no control points');
  ok(await p.locator('[data-tool="cpoint"]').count() === 1, 'the toolbar has the Point tool');
  await p.click('#tabs button[data-tab="guides"]');
  ok(/Control points/.test(await p.textContent('#guidesPane')), 'the Guides and measurements tab has a Control points section');

  // ---- the Point tool: a click on a text hangs the point on that text
  await p.click('[data-tool="cpoint"]');
  const tb = await ev(() => { const n = document.querySelector('#stage [data-id="l1"]'); const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.click(tb.x, tb.y);
  let c1 = await cpOf('cp1');
  const uid1 = await ev(() => PTD.core.getLayer('l1').uid);
  ok(c1 && c1.parent.kind === 'text' && c1.parent.id === uid1, 'a click on a text hangs the new point on that text');
  ok(await ev(() => PTD.core.ui.tool === 'cpoint'), 'the Point tool stays on for more points');
  // ---- a click on an empty place hangs on the artwork origin
  const empty = await toClient({ x: -1300, y: 700 });
  const box = await ev(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  ok(empty.x > box.l && empty.x < box.r && empty.y > box.t && empty.y < box.b, 'the empty test place is on the stage');
  await p.mouse.click(empty.x, empty.y);
  const c2 = await cpOf('cp2');
  ok(c2 && c2.parent.kind === 'origin', 'a click on an empty place hangs the point on the artwork origin');
  await p.keyboard.press('Escape');
  ok(await ev(() => PTD.core.ui.tool === 'select'), 'Esc ends the Point tool');

  // ---- the parent moves, the point follows
  const before = await pos('cp1');
  await ev(() => { PTD.core.getLayer('l1').x += 100; PTD.core.renderStage(); });
  let after = await pos('cp1');
  ok(near(after.x - before.x, 100) && near(after.y, before.y), 'moving the text moves its point with it');
  await ev(() => { PTD.core.getLayer('l1').x -= 100; PTD.core.renderStage(); });

  // ---- rotation: the offset turns around the text position
  const a1 = await anchorOf(uid1), p0 = await pos('cp1');
  await ev(() => { PTD.core.getLayer('l1').rot = 90; PTD.core.renderStage(); });
  let pr = await pos('cp1');
  const vx = p0.x - a1.x, vy = p0.y - a1.y;
  ok(near(pr.x, a1.x - vy, 0.05) && near(pr.y, a1.y + vx, 0.05), 'turning the text 90 degrees turns the offset around the text position');
  await ev(() => { PTD.core.getLayer('l1').rot = 0; PTD.core.renderStage(); });

  // ---- scaling: the offset grows with the letter size
  await ev(() => { const l = PTD.core.getLayer('l1'); l.size = l.size * 2; PTD.core.renderStage(); });
  let ps = await pos('cp1');
  ok(near(ps.x - a1.x, 2 * vx, 0.05) && near(ps.y - a1.y, 2 * vy, 0.05), 'doubling the letter size doubles the offset');
  await ev(() => { const l = PTD.core.getLayer('l1'); l.size = l.size / 2; PTD.core.renderStage(); });

  // ---- the switches keep the point where it is when they change
  await p.click('#tabs button[data-tab="guides"]');
  await p.uncheck('[data-scope="cp:cp1"][data-key="followScale"]');
  ok(near((await pos('cp1')).x, p0.x, 0.05), 'switching off "follows scaling" keeps the point in place');
  await ev(() => { const l = PTD.core.getLayer('l1'); l.size = l.size * 2; PTD.core.renderStage(); });
  ok(near((await pos('cp1')).x, p0.x, 0.05), 'without "follows scaling" a new letter size does not move the point');
  await ev(() => { const l = PTD.core.getLayer('l1'); l.size = l.size / 2; PTD.core.renderStage(); });
  await p.check('[data-scope="cp:cp1"][data-key="followScale"]');
  await p.uncheck('[data-scope="cp:cp1"][data-key="followRot"]');
  await ev(() => { PTD.core.getLayer('l1').rot = 45; PTD.core.renderStage(); });
  ok(near((await pos('cp1')).x, p0.x, 0.05) && near((await pos('cp1')).y, p0.y, 0.05), 'without "follows rotation" turning the text does not move the point');
  await ev(() => { PTD.core.getLayer('l1').rot = 0; PTD.core.renderStage(); });
  await p.check('[data-scope="cp:cp1"][data-key="followRot"]');

  // ---- dragging a point changes its offset, not its parent
  await ev(() => { PTD.core.cfg().snap = false; });
  const m1 = await toClient(await pos('cp1'));
  const parent0 = (await cpOf('cp1')).parent;
  const z = await ev(() => PTD.core.ui.view.z);
  await p.mouse.move(m1.x, m1.y); await p.mouse.down(); await p.mouse.move(m1.x + 30, m1.y + 12, { steps: 4 }); await p.mouse.up();
  const dragged = await pos('cp1');
  ok(near(dragged.x - p0.x, 30 / z, 1.5) && near(dragged.y - p0.y, 12 / z, 1.5), 'dragging a point moves it by the pointer distance');
  const cd = await cpOf('cp1');
  ok(JSON.stringify(cd.parent) === JSON.stringify(parent0), 'dragging a point keeps its parent');
  ok(await ev(() => PTD.core.ui.selCp === 'cp1'), 'a pressed point is selected');
  await ev(() => { PTD.core.cfg().snap = true; });

  // ---- dropping a point on another one hangs it there; a cycle is refused
  const target = await pos('cp2');
  const m2 = await toClient(await pos('cp1')), t2 = await toClient(target);
  await p.mouse.move(m2.x, m2.y); await p.mouse.down(); await p.mouse.move((m2.x + t2.x) / 2, (m2.y + t2.y) / 2, { steps: 3 }); await p.mouse.move(t2.x + 2, t2.y + 1, { steps: 3 }); await p.mouse.up();
  const hung = await cpOf('cp1');
  ok(hung.parent.kind === 'point' && hung.parent.id === 'cp2', 'dropping a point on another control point hangs it on that point');
  ok(near(hung.dx, 0) && near(hung.dy, 0), 'a point that hangs on a point by snapping has offset 0');
  const m3 = await toClient(await pos('cp2')), t3 = await toClient(await pos('cp1'));
  await p.mouse.move(m3.x, m3.y); await p.mouse.down(); await p.mouse.move(t3.x + 6, t3.y + 6, { steps: 4 }); await p.mouse.move(t3.x + 1, t3.y + 1, { steps: 2 }); await p.mouse.up();
  ok((await cpOf('cp2')).parent.kind === 'origin', 'a point cannot be dropped on its own child (no cycle)');
  ok(/Circular/.test(await ev(() => document.getElementById('toolMsg').textContent)), 'the program warns about the circular dependency');
  await ev(() => PTD.core.renderPanels());
  await ev(() => { PTD.scopes.cpparent('cp2').sel = 'point|cp1'; });
  ok((await cpOf('cp2')).parent.kind === 'origin', 'choosing a child as the parent is refused');
  ok(await p.locator('[data-scope="cpparent:cp2"] option[value="point|cp1"]').count() === 0, 'the parent list does not even offer a child of the point');

  // ---- choosing another parent in the panel keeps the point where it is
  const keep = await pos('cp1');
  await p.selectOption('[data-scope="cpparent:cp1"]', 'text|' + uid1);
  const kp = await pos('cp1');
  ok(near(kp.x, keep.x, 0.05) && near(kp.y, keep.y, 0.05) && (await cpOf('cp1')).parent.kind === 'text', 'choosing another parent keeps the place of the point');

  // ---- panel fields
  const nm = '[data-scope="cp:cp1"][data-key="name"]';
  await p.fill(nm, 'Corner'); await p.dispatchEvent(nm, 'input');
  ok((await cpOf('cp1')).name === 'Corner', 'the name can be edited');
  const dx0 = (await cpOf('cp1')).dx;
  await p.fill('[data-scope="cp:cp1"][data-key="dx"]', String(dx0 + 20)); await p.dispatchEvent('[data-scope="cp:cp1"][data-key="dx"]', 'input');
  ok(near((await pos('cp1')).x - kp.x, 20, 0.05), 'the offset field moves the point');

  // ---- a table as the parent: size and turn
  await ev(() => { const cp = PTD.cpoints.make({ kind: 'table', id: 't1' }, 300, 100); PTD.core.renderPanels(); PTD.core.renderStage(); return cp.id; });
  const tp0 = await pos('cp3');
  await ev(() => { const t = PTD.core.state().tables[0]; t.preset.w *= 2; PTD.tables.regen(t); PTD.core.renderStage(); });
  const tp1 = await pos('cp3');
  ok(near(tp1.x, tp0.x * 2, 1) && near(tp1.y, tp0.y, 1), 'a point on a table follows its width (and not its height)');
  await ev(() => { const t = PTD.core.state().tables[0]; t.preset.w /= 2; PTD.tables.regen(t); PTD.core.renderStage(); });
  await ev(() => { PTD.core.state().tables[0].rot = 90; PTD.core.renderStage(); });
  const tp2 = await pos('cp3');
  ok(near(tp2.x, -tp0.y, 0.1) && near(tp2.y, tp0.x, 0.1), 'turning the table turns the point around its centre');
  await ev(() => { PTD.core.state().tables[0].rot = 0; PTD.core.renderStage(); });

  // ---- snapping: things snap to control points
  const sp = await pos('cp3');
  const sn = await ev((q) => PTD.core.snapXY({ x: q.x + 3, y: q.y - 2 }, {}), sp);
  ok(near(sn.x, sp.x, 0.01) && near(sn.y, sp.y, 0.01), 'snapping pulls a point to a control point');
  const mc = await ev((q) => PTD.measure.candidates({ x: q.x + 1, y: q.y }, {}).filter(c => c.a && c.a.t === 'cpt').length, sp);
  ok(mc >= 1, 'measurements can attach to a control point');
  await ev(() => { PTD.core.state().cpoints.filter(c => c.id === 'cp3')[0].visible = false; });
  ok(await ev((q) => PTD.cpoints.snapPoints(null).every(s => s.id !== 'cp3'), sp), 'a hidden control point is not a snap point');
  ok(await ev(() => PTD.cpoints.pos('cp3') !== null), 'a hidden control point still has a place (measurements keep working)');
  await ev(() => { PTD.core.state().cpoints.filter(c => c.id === 'cp3')[0].visible = true; });

  // ---- a measurement attached to a point follows it
  await ev(() => { PTD.cpoints.make({ kind: 'world' }, 0, 0); });   // cp4 at the cloth centre
  const mAdd = await ev(() => { const m = PTD.measure.normalize([{ kind: 'points', mode: 'aligned', a: { t: 'cpt', id: 'cp4' }, b: { t: 'cpt', id: 'cp3' } }]); PTD.core.state().measures = m; PTD.core.renderStage(); return PTD.measure.resolve(m[0]); });
  ok(mAdd && mAdd.ok === true && mAdd.val > 0, 'a measurement between two control points has a value: ' + (mAdd && mAdd.val));
  await ev(() => { PTD.core.state().measures = []; });

  // ---- hidden text hides its points
  await ev(() => { PTD.core.getLayer('l1').hidden = true; PTD.core.renderStage(); });
  ok(await ev(() => PTD.cpoints.snapPoints(null).every(s => s.id !== 'cp1')), 'a point on a hidden text is hidden with it');
  await ev(() => { PTD.core.getLayer('l1').hidden = false; PTD.core.renderStage(); });
  ok(await ev(() => PTD.cpoints.snapPoints(null).some(s => s.id === 'cp1')), 'and comes back with the text');

  // ---- save, load, undo
  const saved = await ev(() => JSON.stringify(PTD.core.toJSON(true)));
  const posBefore = await ev(() => { const o = {}; PTD.core.state().cpoints.forEach(c => { o[c.id] = PTD.cpoints.pos(c.id); }); return o; });
  await ev((t) => { PTD.core.loadText(t); }, saved);
  const posAfter = await ev(() => { const o = {}; PTD.core.state().cpoints.forEach(c => { o[c.id] = PTD.cpoints.pos(c.id); }); return o; });
  ok(Object.keys(posBefore).length >= 4 && Object.keys(posBefore).every(k => posAfter[k] && near(posAfter[k].x, posBefore[k].x, 0.01) && near(posAfter[k].y, posBefore[k].y, 0.01)), 'control points survive save and load in the same places');
  ok(/"cpoints":\[/.test(saved), 'the project file has a cpoints list');

  // ---- deleting the parent: the points stay where they are
  const uidNow = await ev(() => PTD.core.getLayer('l1').uid);
  const hangOnL1 = await ev((u) => PTD.core.state().cpoints.filter(c => c.parent.kind === 'text' && c.parent.id === u).map(c => c.id), uidNow);
  const hp = {}; for (const id of hangOnL1) hp[id] = await pos(id);
  ok(hangOnL1.length >= 1, 'a point hangs on the first text before it is deleted');
  await ev(() => { document.querySelector('[data-act="del"][data-id="l1"]').click(); });
  let stay = true; for (const id of hangOnL1) { const q = await pos(id), c = await cpOf(id); stay = stay && c.parent.kind === 'world' && near(q.x, hp[id].x, 0.05) && near(q.y, hp[id].y, 0.05); }
  ok(stay, 'when its text is deleted a point stays where it was and hangs on the cloth centre');
  await p.mouse.click(5, 5);   // focus the page, not a field
  await p.keyboard.press('Control+z');
  ok(await ev((a) => { const c = PTD.cpoints.get(a.id), l = PTD.core.state().layers.filter(l => l.uid === a.uid)[0]; return !!l && !!c && c.parent.kind === 'text'; }, { id: hangOnL1[0], uid: uidNow }), 'Undo brings the text back and the point hangs on it again');

  // ---- deleting a point: its children stay where they are
  await ev(() => { PTD.cpoints.make({ kind: 'point', id: 'cp4' }, 400, 200); });   // child of cp4
  const childId = await ev(() => PTD.core.state().cpoints.slice(-1)[0].id);
  const childPos = await pos(childId);
  await ev(() => { PTD.cpoints.remove('cp4'); });
  const childAfter = await cpOf(childId);
  ok(childAfter.parent.kind === 'world' && near((await pos(childId)).x, childPos.x, 0.05), 'deleting a point hands its children over to the cloth centre and they stay in place');

  // ---- the keyboard
  await p.click('#tabs button[data-tab="guides"]');
  await p.click('[data-act="cpsel"][data-id="cp3"]');
  ok(await ev(() => PTD.core.ui.selCp === 'cp3'), 'the select button in the panel selects the point');
  const k0 = await pos('cp3');
  await p.mouse.click(5, 5); await p.keyboard.press('ArrowRight');
  ok(near((await pos('cp3')).x - k0.x, 1, 0.01), 'an arrow key nudges the selected point by 1 mm');
  await p.keyboard.press('Shift+ArrowDown');
  ok(near((await pos('cp3')).y - k0.y, 10, 0.01), 'Shift with an arrow key nudges it by 10 mm');
  await p.keyboard.press('Alt+ArrowLeft');
  ok(near((await pos('cp3')).x - k0.x, 0.9, 0.01), 'Alt with an arrow key nudges it by 0.1 mm');
  await p.keyboard.press('Delete');
  ok(await ev(() => !PTD.cpoints.get('cp3')), 'Delete removes the selected point');

  // ---- the layout sheet lists the control points
  const sheetHtml = await ev(() => PTD.sheet.build().html);
  ok(/Control point: Corner/.test(sheetHtml) && /hangs on/.test(sheetHtml), 'the layout sheet lists the control points with their parent and offset');

  // ---- normalising damaged data
  const bad = await ev(() => {
    const o = JSON.parse(JSON.stringify(PTD.core.toJSON(true)));
    o.cpoints = [{ id: 'a', parent: { kind: 'point', id: 'b' }, dx: 1, dy: 2 }, { id: 'b', parent: { kind: 'point', id: 'a' } }, { id: 'c', parent: { kind: 'text', id: 'nope' }, dx: 5 }, { id: 'd', parent: { kind: 'table', id: 'zz' } }, { id: 'e', parent: { kind: 'point', id: 'e' } }, 7];
    PTD.core.loadText(JSON.stringify(o));
    const list = PTD.core.state().cpoints, byId = {}; list.forEach(c => { byId[c.id] = c; });
    const chainEnds = list.every(c => { let cur = c, n = 0; while (cur.parent.kind === 'point' && n++ < 20) cur = byId[cur.parent.id]; return n < 20; });
    return { n: list.length, chainEnds, c: byId.c.parent.kind, d: byId.d.parent.kind, e: byId.e.parent.kind };
  });
  ok(bad.n === 5 && bad.chainEnds && bad.c === 'world' && bad.d === 'world' && bad.e === 'world', 'damaged data is repaired: cycles broken, unknown parents become the world: ' + JSON.stringify(bad));

  // ---- the randomizer replaces texts and takes their points with it
  await ev(() => {
    PTD.core.loadText(JSON.stringify(PTD.core.toJSON(true)));
    const o = JSON.parse(JSON.stringify(PTD.core.toJSON(true))); o.cpoints = []; PTD.core.loadText(JSON.stringify(o));
    const uid = PTD.core.getLayer('l1').uid; PTD.cpoints.make({ kind: 'text', id: uid }, 0, 0); PTD.cpoints.make({ kind: 'origin' }, 50, 50); PTD.core.save();
  });
  await ev(() => { PTD.random.create(); });
  await p.waitForTimeout(3600);
  const left = await ev(() => PTD.core.state().cpoints.map(c => c.parent.kind));
  ok(left.length === 1 && left[0] === 'origin', 'Create casino removes the points of the replaced texts and keeps the others: ' + JSON.stringify(left));

  // ---- tooltips on every control of the panel
  await p.click('#tabs button[data-tab="guides"]');
  await ev(() => { PTD.cpoints.make({ kind: 'origin' }, 10, 10); PTD.core.renderPanels(); PTD.help.applyTips(); });
  const untitled = await ev(() => PTD.help.untitled());
  ok(untitled.length === 0, 'every button and field of the control point panel has a tooltip: ' + untitled.slice(0, 5).join(', '));

  ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
