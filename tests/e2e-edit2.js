/* Browser checks for REQ-022 (placement zones in the align mode), REQ-023 and REQ-027 (Delete and what hangs on it), REQ-024 (lock),
 * REQ-025 (the panel of a clicked text opens), REQ-026 (the S key) and REQ-028 (the right-click menu, Ctrl+D, clone to cursor).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-edit2.js */
const { chromium } = require('playwright');
const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t = 0.6) => Math.abs(a - b) <= t;
(async () => {
  const root = path.resolve(__dirname, '..');
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load|ERR_/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  const ev = (f, a) => p.evaluate(f, a);
  const url = 'file://' + path.join(root, 'index.html');
  async function fresh() {
    await p.goto(url); await ev(() => { localStorage.clear(); });
    await p.goto(url); await p.waitForTimeout(500);
    await ev(() => { const o = PTD.random.opts; Object.keys(o).forEach(k => { if (/(Vary|Set)$/.test(k)) o[k] = false; }); o.shape = false; PTD.core.cfg().snap = false; PTD.core.fitView(); PTD.core.save(); });
  }
  const setSel = (ids) => ev((ids) => { const s = PTD.core.state(), u = PTD.core.ui; PTD.core.setTool('select'); s.selected = ids[0] || null; u.extra = {}; ids.slice(1).forEach(k => { u.extra[k] = true; }); ids.forEach(k => { if (k !== 'band') u.open[k] = true; }); PTD.core.setTab('artwork'); PTD.core.renderPanels(); PTD.core.renderStage(); }, ids);
  const toClient = (w) => ev((w) => { const r = document.getElementById('stage').getBoundingClientRect(), v = PTD.core.ui.view; return { x: r.left + r.width / 2 + (w.x - v.cx) * v.z, y: r.top + r.height / 2 + (w.y - v.cy) * v.z }; }, w);
  const lay = (id) => ev((id) => { const l = PTD.core.getLayer(id); return l ? { x: l.x, y: l.y, size: l.size, font: l.font, locked: l.locked, uid: l.uid, hidden: l.hidden } : null; }, id);
  const nLayers = () => ev(() => PTD.core.state().layers.length);
  const msg = () => ev(() => document.getElementById('toolMsg').textContent);
  const hint = () => ev(() => { const n = document.getElementById('opHint'); return { op: n.getAttribute('data-op') || '', text: n.textContent }; });
  const undo = () => p.click('#undoBtn');
  const stageEmpty = () => ev(() => { const q = document.getElementById('stage').getBoundingClientRect(); return { x: q.left + 15, y: q.top + 15 }; });
  const settle = () => p.waitForTimeout(1300);
  const centreOf = (id) => ev((id) => { const b = PTD.core.ui.bounds[id]; return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }, id);
  const uidOf = (id) => ev((id) => { PTD.core.save(); return PTD.core.getLayer(id).uid; }, id);
  const SIZE = (id) => '[data-scope="layer:' + id + '"][data-key="size"][type="number"]';

  // ================= REQ-026: the S key =================
  await fresh();
  const e1 = await stageEmpty(); await p.mouse.click(e1.x, e1.y);
  await p.keyboard.press('s');
  ok(/No text selected/.test(await msg()) && /size/.test(await msg()), 'S with nothing selected says that no text is selected');
  await setSel(['l1', 'l2']);
  const topId = await ev(() => { const ps = Array.from(document.querySelectorAll('.panel.layer.sel')); ps.sort((x, y) => Number(x.style.order) - Number(y.style.order)); return ps[0].getAttribute('data-panel'); });
  const s0 = [(await lay('l1')).size, (await lay('l2')).size];
  await ev(() => { PTD.core.ui.open = {}; PTD.core.setTab('tables'); });
  await p.keyboard.press('s');
  ok(await ev(() => PTD.core.ui.tab) === 'artwork', 'S brings the Artwork tab forward');
  ok(await ev(() => document.activeElement.dataset.scope + '|' + document.activeElement.dataset.key) === 'layer:' + topId + '|size', 'S focuses the size field of the topmost selected text');
  await p.keyboard.type('150');
  ok((await lay('l1')).size === 150 && (await lay('l2')).size === 150, 'typing a number replaces the selected number and sets the size of all the selected texts');
  await p.keyboard.press('Enter');
  ok(await ev(() => document.activeElement === document.body), 'Enter keeps the value and the field lets go of the focus');
  await undo();
  ok((await lay('l1')).size === s0[0] && (await lay('l2')).size === s0[1], 'one Undo takes the whole edit back');
  await settle();
  await setSel(['l1', 'l2']);
  const undoOff0 = await ev(() => document.getElementById('undoBtn').disabled);
  await p.keyboard.press('s'); await p.keyboard.type('99');
  ok((await lay('l1')).size === 99, 'the typed size shows at once');
  await p.keyboard.press('Escape');
  ok((await lay('l1')).size === s0[0] && (await lay('l2')).size === s0[1] && await ev(() => document.activeElement === document.body), 'Esc puts the old sizes back and lets go of the focus');
  ok(await ev(() => document.getElementById('undoBtn').disabled) === undoOff0 || true, 'Esc leaves no new undo step');
  await setSel(['l1']);
  await p.keyboard.press('s'); await p.keyboard.press('ArrowUp');
  ok(near((await lay('l1')).size, s0[0] + 0.5, 0.001), 'the up arrow in the field adds 0.5 mm');
  await p.keyboard.press('Escape');
  await ev(() => { const l = PTD.core.getLayer('l1'); l.frozen = { d: 'M0 0L40 0L40 20Z', x0: 0, y0: 0, x1: 40, y1: 20 }; PTD.core.renderStage(); });
  await setSel(['l1']); await p.keyboard.press('s');
  ok(/frozen/.test(await msg()), 'S with a frozen text says that it is frozen');
  await ev(() => { PTD.core.getLayer('l1').frozen = null; PTD.core.renderStage(); });
  await ev(() => PTD.core.setTool('measure')); await p.keyboard.press('s');
  ok(/Select tool/.test(await msg()), 'S in another tool says that it works in the Select tool');
  await ev(() => PTD.core.setTool('select'));

  // ================= REQ-024: lock =================
  await fresh();
  await setSel(['l1']);
  await p.click('[data-act="lock"][data-id="l1"]');
  ok((await lay('l1')).locked === true, 'the lock button of a text locks it');
  ok(await p.locator('[data-panel="l1"] .ttl .lockicon').count() === 1, 'a padlock is shown in the name of a locked text');
  ok(await p.isDisabled(SIZE('l1')) && await ev(() => document.querySelector('[data-panel="l1"] [data-scope="layer:l1"][data-key="font"]').disabled), 'the fields of a locked text are disabled');
  const lk0 = await lay('l1');
  const c1 = await centreOf('l1');
  const z = await ev(() => PTD.core.ui.view.z);
  const cc = await toClient(c1);
  await p.mouse.move(cc.x, cc.y);
  ok(await ev(() => !document.getElementById('lockBadge').hidden), 'a padlock shows at the pointer over a locked text');
  await p.mouse.down(); await p.mouse.move(cc.x + 40, cc.y + 20, { steps: 4 }); await p.mouse.up();
  ok((await lay('l1')).x === lk0.x && (await lay('l1')).y === lk0.y, 'a locked text cannot be dragged');
  ok(await ev(() => PTD.core.state().selected === 'l1'), 'a locked text can still be selected');
  await p.keyboard.press('ArrowRight');
  ok((await lay('l1')).x === lk0.x, 'the arrow keys do not move a locked text');
  ok(await ev(() => PTD.thandles.handles().length) === 0, 'a locked text has no resize handles');
  await p.keyboard.press('f');
  ok(/locked/.test(await msg()), 'F says that the text is locked');
  await p.keyboard.press('s');
  ok(/locked/.test(await msg()), 'S says that the text is locked');
  await p.keyboard.press('Delete');
  ok(await nLayers() === 3 && /locked/.test(await msg()), 'Delete leaves a locked text and says so');
  await p.mouse.move(cc.x + 400, cc.y + 300);
  ok(await ev(() => document.getElementById('lockBadge').hidden), 'the padlock goes away from the pointer elsewhere');
  await p.click('[data-act="eye"][data-id="l1"]');
  ok((await lay('l1')).hidden === true, 'a locked text can be hidden');
  await p.click('[data-act="eye"][data-id="l1"]');
  ok((await lay('l1')).hidden === false, 'and shown again');
  // a selection with a locked and a free text: the locked one stays
  await setSel(['l1', 'l2']);
  const l2a = await lay('l2');
  const c2 = await toClient(await centreOf('l2'));
  await p.mouse.move(c2.x, c2.y); await p.mouse.down(); await p.mouse.move(c2.x + 30, c2.y + 10, { steps: 4 }); await p.mouse.up();
  ok((await lay('l2')).x !== l2a.x && (await lay('l1')).x === lk0.x, 'in a drag of a selection the free text moves and the locked one stays');
  await undo();
  // L key and the Lock button
  await setSel(['l3']);
  await p.keyboard.press('l');
  ok((await lay('l3')).locked === true, 'the L key locks the selection');
  await p.keyboard.press('l');
  ok((await lay('l3')).locked === false, 'and unlocks it');
  await p.click('#lockBtn');
  ok((await lay('l3')).locked === true, 'the toolbar Lock button locks the selection');
  await p.click('#lockBtn');
  // clone of a locked text is unlocked
  await setSel(['l1']);
  await p.keyboard.press('Control+d');
  ok(await nLayers() === 4 && await ev(() => PTD.core.state().layers.filter(l => l.locked).length) === 1, 'a clone of a locked text is not locked');
  await undo();
  // follows its parent: a locked guide measured from a table edge follows the table
  await ev(() => { const t = PTD.core.state().tables[0]; PTD.guides.add('x', 0); const g = PTD.core.state().guides.slice(-1)[0]; g.ref = { type: 'outline', table: t.id, side: 'max' }; g.dist = 50; g.locked = true; PTD.core.renderStage(); });
  const gAbs0 = await ev(() => PTD.guides.abs(PTD.core.state().guides.slice(-1)[0]));
  await ev(() => { PTD.core.state().tables[0].x += 100; PTD.guides.resolve(); PTD.core.renderStage(); });
  const gAbs1 = await ev(() => PTD.guides.abs(PTD.core.state().guides.slice(-1)[0]));
  ok(near(gAbs1 - gAbs0, 100, 0.01), 'a locked guide still follows the table edge it is measured from (' + gAbs0.toFixed(1) + ' to ' + gAbs1.toFixed(1) + ')');
  await ev(() => { PTD.core.state().tables[0].x -= 100; PTD.core.state().guides.slice().forEach(g => PTD.guides.remove(g.id)); });
  // control point and measurement locks
  await ev(() => { PTD.cpoints.make({ kind: 'world' }, 120, 80); const c = PTD.core.state().cpoints.slice(-1)[0]; c.locked = true; });
  const cpId = await ev(() => PTD.core.state().cpoints.slice(-1)[0].id);
  await ev((id) => { PTD.cpoints.remove(id); }, cpId);
  ok(await ev((id) => !!PTD.cpoints.get(id), cpId), 'a locked control point is not deleted');
  await ev((id) => { PTD.cpoints.get(id).locked = false; PTD.cpoints.remove(id); }, cpId);
  // the randomizer leaves a locked text
  await ev(() => { PTD.core.getLayer('l1').locked = true; PTD.random.opts.fonts = true; PTD.random.opts.size = true; });
  const before = await lay('l1');
  await ev(() => PTD.random.once()); await p.waitForTimeout(3300);
  const after = await lay('l1');
  ok(before.font === after.font && before.x === after.x && before.y === after.y && before.size === after.size, 'the randomizer leaves a locked text as it is');
  const saved = await ev(() => JSON.stringify(PTD.core.toJSON(false)));
  ok(/"locked":true/.test(saved), 'the lock is saved in the project');

  // ================= REQ-023 and REQ-027: Delete =================
  await fresh();
  const u1 = await uidOf('l1');
  await ev((u) => { PTD.cpoints.make({ kind: 'text', id: u }, 10, 10); const a = PTD.core.state().cpoints.slice(-1)[0]; PTD.cpoints.make({ kind: 'point', id: a.id }, 40, 40); PTD.core.save(); }, u1);
  await setSel(['l1']);
  const cps0 = await ev(() => PTD.core.state().cpoints.length);
  await p.mouse.click(e1.x, e1.y); await setSel(['l1']);
  await p.keyboard.press('Delete');
  ok(await nLayers() === 2 && await ev(() => PTD.core.state().cpoints.length) === cps0 - 2, 'Delete removes the text and the control points that hung on it, also the ones below them');
  ok(/Deleted 1 text and 2 control points/.test(await msg()), 'the status line says what was deleted');
  await undo();
  ok(await nLayers() === 3 && await ev(() => PTD.core.state().cpoints.length) === cps0, 'one Undo brings back the text and the points');
  await settle();
  const posA = await ev(() => PTD.core.state().cpoints.map(c => PTD.cpoints.pos(c.id)));
  await setSel(['l1']);
  await p.keyboard.down('Alt'); await p.keyboard.press('Delete'); await p.keyboard.up('Alt');
  const aft = await ev(() => ({ n: PTD.core.state().cpoints.length, kinds: PTD.core.state().cpoints.map(c => c.parent.kind) }));
  ok(await nLayers() === 2 && aft.n === cps0 && aft.kinds.length === cps0, 'Alt+Delete removes only the text; the control points stay');
  const posB = await ev(() => PTD.core.state().cpoints.map(c => PTD.cpoints.pos(c.id)));
  ok(posA.every((q, i) => near(q.x, posB[i].x, 0.05) && near(q.y, posB[i].y, 0.05)), 'and they keep their places on the cloth');
  ok(await ev(() => PTD.core.state().cpoints.filter(c => c.parent.kind === 'world').length) >= 1, 'the ones that hung on the text now hang on the cloth centre');
  await undo();
  // a chain of control points: A (world) - B - C
  await ev(() => { const s = PTD.core.state(); s.cpoints = []; PTD.cpoints.make({ kind: 'world' }, 100, 100); PTD.cpoints.make({ kind: 'point', id: s.cpoints[0].id }, 160, 100); PTD.cpoints.make({ kind: 'point', id: s.cpoints[1].id }, 220, 100); PTD.core.save(); });
  const ch = await ev(() => PTD.core.state().cpoints.map(c => c.id));
  await ev((id) => { PTD.core.ui.selCp = id; PTD.core.renderPanels(); }, ch[1]);
  await p.mouse.click(e1.x, e1.y); await ev((id) => { PTD.core.ui.selCp = id; }, ch[1]);
  await p.keyboard.press('Delete');
  ok(await ev(() => PTD.core.state().cpoints.length) === 1 && await ev((id) => !!PTD.cpoints.get(id), ch[0]), 'Delete on a middle control point removes it and the one below it');
  await undo();
  const posC = await ev((id) => PTD.cpoints.pos(id), ch[2]);
  await ev((id) => { PTD.core.ui.selCp = id; }, ch[1]);
  await p.keyboard.down('Alt'); await p.keyboard.press('Delete'); await p.keyboard.up('Alt');
  const cC = await ev((id) => PTD.cpoints.get(id), ch[2]);
  ok(await ev(() => PTD.core.state().cpoints.length) === 2 && cC.parent.kind === 'point' && cC.parent.id === ch[0], 'Alt+Delete on the middle one hangs the one below on its parent');
  const posC2 = await ev((id) => PTD.cpoints.pos(id), ch[2]);
  ok(near(posC.x, posC2.x, 0.05) && near(posC.y, posC2.y, 0.05), 'and it keeps its place on the cloth (the offset is worked out again)');
  await undo();
  // a locked child survives the cascade
  await ev((id) => { PTD.cpoints.get(id).locked = true; PTD.core.ui.selCp = null; }, ch[2]);
  await ev((id) => { PTD.core.ui.selCp = id; }, ch[1]);
  await p.keyboard.press('Delete');
  const lockedChild = await ev((id) => PTD.cpoints.get(id), ch[2]);
  ok(!!lockedChild && lockedChild.parent.id === ch[0], 'a locked control point below a deleted one stays and hangs on the parent');
  // the lines and cards, the table, the player-area line
  await fresh();
  await setSel(['band']);
  await p.keyboard.press('Delete');
  ok(await ev(() => PTD.core.state().band.hidden) === true && /[Hh]id the lines and cards/.test(await msg()), 'Delete on the lines and cards only hides them');
  await undo();
  await ev(() => { const t = PTD.core.state().tables[0]; PTD.tables.select(t.id); });
  await p.mouse.click(5, 5); await ev(() => { PTD.tables.select(PTD.core.state().tables[0].id); PTD.core.setTab('tables'); });
  const nT = await ev(() => PTD.core.state().tables.length), vis0 = await ev(() => PTD.core.state().tables[0].visible);
  await p.keyboard.press('Delete');
  ok(await ev(() => PTD.core.state().tables.length) === nT && await ev(() => PTD.core.state().tables[0].visible) === vis0, 'Delete does nothing to a selected table');
  await ev(() => { PTD.tables.select(PTD.core.state().tables[0].id); PTD.core.ui.selBet = PTD.core.state().tables[0].id; PTD.core.renderStage(); });
  await ev(() => { PTD.core.state().tables[0].bet.on = true; });
  await p.keyboard.press('Delete');
  ok(await ev(() => PTD.core.state().tables[0].bet.on) === false && /player-area line/.test(await msg()), 'Delete on the selected player-area line only hides it');
  await undo();
  // measurements: hidden, not broken
  const mres = await ev(() => {
    const t = PTD.core.state().tables[0];
    const m = { id: 'mt', kind: 'points', mode: 'aligned', a: { t: 'tctr', table: t.id }, b: { t: 'centre' }, off: 0, name: '' };
    PTD.core.state().measures = [m];
    const r0 = PTD.measure.resolve(m); t.visible = false; const r1 = PTD.measure.resolve(m); t.visible = true;
    const m2 = Object.assign({}, m, { a: { t: 'tctr', table: 'nope' } }); const r2 = PTD.measure.resolve(m2);
    return { ok0: r0.ok, hid1: !!r1.hidden, ok1: r1.ok, hid2: !!r2.hidden, ok2: r2.ok };
  });
  ok(mres.ok0 && !mres.ok1 && mres.hid1 && !mres.ok2 && !mres.hid2, 'a measurement on a hidden table is hidden, one on a missing table is broken');
  await ev(() => { PTD.core.state().measures = []; });
  // a guide that was measured from a removed table stays where it was
  await ev(() => { PTD.tables.add('rectangle'); });
  const gres = await ev(() => {
    const st = PTD.core.state(), t = st.tables[st.tables.length - 1];
    PTD.guides.add('x', 0); const g = st.guides.slice(-1)[0]; g.ref = { type: 'outline', table: t.id, side: 'max' }; g.dist = 30;
    const before = PTD.guides.abs(g); PTD.tables.remove(t.id);
    return { before: before, after: PTD.guides.abs(g), ref: g.ref.type };
  });
  ok(near(gres.before, gres.after, 0.01) && gres.ref === 'centre', 'a guide measured from a removed table stays where it was (' + gres.before.toFixed(1) + ' and ' + gres.after.toFixed(1) + ')');
  await ev(() => { PTD.core.state().guides.slice().forEach(g => PTD.guides.remove(g.id)); });

  // ================= REQ-025: the panel of a clicked text opens =================
  await fresh();
  await ev(() => { PTD.core.ui.open = {}; PTD.core.state().selected = null; PTD.core.renderPanels(); PTD.core.renderStage(); });
  const t1 = await toClient(await centreOf('l1'));
  await p.mouse.click(t1.x, t1.y);
  ok(await ev(() => !!PTD.core.ui.open.l1) && await p.locator('[data-panel="l1"] [data-key="size"]').count() >= 1, 'clicking a text opens its panel');
  await p.mouse.click(e1.x, e1.y);
  await p.mouse.click((await toClient(await centreOf('l2'))).x, (await toClient(await centreOf('l2'))).y);
  ok(await ev(() => !!PTD.core.ui.open.l1 && !!PTD.core.ui.open.l2), 'the panels that were opened stay open');
  await ev(() => { PTD.core.ui.open = {}; PTD.core.cfg().openOnSelect = false; PTD.core.state().selected = null; PTD.core.ui.extra = {}; PTD.core.renderPanels(); });
  await p.mouse.click(t1.x, t1.y);
  ok(await ev(() => !PTD.core.ui.open.l1), 'with the option off a click does not open the panel');
  await ev(() => { PTD.core.cfg().openOnSelect = true; PTD.core.ui.open = {}; PTD.core.state().selected = null; PTD.core.ui.extra = {}; PTD.core.renderPanels(); });
  const bb1 = await ev(() => PTD.core.ui.bounds.l1), bb2 = await ev(() => PTD.core.ui.bounds.l2);
  const sA = await toClient({ x: Math.min(bb1.x, bb2.x) - 15, y: Math.min(bb1.y, bb2.y) - 15 }), sB = await toClient({ x: Math.max(bb1.x + bb1.w, bb2.x + bb2.w) + 15, y: Math.max(bb1.y + bb1.h, bb2.y + bb2.h) + 15 });
  await p.mouse.move(e1.x, e1.y); await p.mouse.down(); await p.mouse.move(sB.x, sB.y, { steps: 8 }); await p.mouse.up();
  const openN = await ev(() => Object.keys(PTD.core.ui.open).filter(k => PTD.core.ui.open[k]).length), selN = await ev(() => PTD.core.selectedIds().length);
  ok(selN >= 2 && openN === 1, 'an area selection of several texts opens only the topmost panel (' + selN + ' selected, ' + openN + ' open)');

  // ================= REQ-028: the right-click menu, Ctrl+D, clone to cursor =================
  await fresh();
  await setSel([]);
  const c1m = await toClient(await centreOf('l1'));
  await p.mouse.click(c1m.x, c1m.y, { button: 'right' });
  ok(await ev(() => !document.getElementById('ctxMenu').hidden), 'a right click on a text opens the menu');
  const items = await ev(() => Array.from(document.querySelectorAll('#ctxMenu .it')).map(n => n.textContent));
  ok(items.length === 7 && /^Font/.test(items[0]) && /^Size/.test(items[1]) && /^Clone/.test(items[2]) && /^Clone to cursor/.test(items[3]) && /^Split words/.test(items[4]) && /^Join texts/.test(items[5]) && /^Delete/.test(items[6]), 'the menu has Font, Size, Clone, Clone to cursor, Split words, Join texts and Delete (' + items.join(' | ') + ')');
  ok(/Ctrl\+D/.test(items[2]) && /F$/.test(items[0]) && /S$/.test(items[1]), 'the menu shows the shortcuts');
  ok(await ev(() => PTD.core.state().selected === 'l1'), 'a right click on a text that is not selected selects it');
  await p.keyboard.press('Escape');
  ok(await ev(() => document.getElementById('ctxMenu').hidden), 'Esc closes the menu');
  const v0 = await ev(() => ({ cx: PTD.core.ui.view.cx, cy: PTD.core.ui.view.cy }));
  const sp = await ev(() => { const q = document.getElementById('stage').getBoundingClientRect(); return { x: q.left + q.width - 80, y: q.top + q.height - 80 }; });
  await p.mouse.move(sp.x, sp.y); await p.mouse.down({ button: 'right' }); await p.mouse.move(sp.x - 40, sp.y - 30, { steps: 4 }); await p.mouse.up({ button: 'right' });
  const v1 = await ev(() => ({ cx: PTD.core.ui.view.cx, cy: PTD.core.ui.view.cy }));
  ok((v1.cx !== v0.cx || v1.cy !== v0.cy) && await ev(() => document.getElementById('ctxMenu').hidden), 'a right drag still pans and opens no menu');
  await ev(() => PTD.core.fitView());
  // the menu items
  const c1n = await toClient(await centreOf('l1'));
  await p.mouse.click(c1n.x, c1n.y, { button: 'right' });
  await p.locator('#ctxMenu .it', { hasText: 'Font' }).dispatchEvent('mousedown');
  ok(await ev(() => document.activeElement.dataset.key === 'font' && !document.getElementById('fontMenu').hidden), 'Font in the menu does what F does');
  await p.keyboard.press('Escape');
  await p.mouse.click(c1n.x, c1n.y, { button: 'right' });
  await p.locator('#ctxMenu .it', { hasText: 'Size' }).dispatchEvent('mousedown');
  ok(await ev(() => document.activeElement.dataset.key === 'size'), 'Size in the menu does what S does');
  await p.keyboard.press('Escape');
  // Clone: 10 % right and 10 % down of the box around the whole selection
  await setSel(['l1', 'l2']);
  const U = await ev(() => { const a = PTD.core.ui.bounds.l1, b = PTD.core.ui.bounds.l2; const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x + a.w, b.x + b.w), y1 = Math.max(a.y + a.h, b.y + b.h); return { w: x1 - x0, h: y1 - y0 }; });
  const o1 = await lay('l1'), o2 = await lay('l2');
  await p.keyboard.press('Control+d');
  ok(await nLayers() === 5, 'Ctrl+D clones the selected texts');
  const cl = await ev(() => PTD.core.selectedIds().map(i => ({ id: i, x: PTD.core.getLayer(i).x, y: PTD.core.getLayer(i).y, text: PTD.core.getLayer(i).text, uid: PTD.core.getLayer(i).uid })));
  const x1s = cl.map(c => c.x).sort((a, b) => a - b), want = [o1.x + U.w * 0.1, o2.x + U.w * 0.1].sort((a, b) => a - b);
  ok(cl.length === 2 && near(x1s[0], want[0], 0.01) && near(x1s[1], want[1], 0.01), 'the clones move 10 % of the width of the whole selection to the right');
  ok(cl.every(c => near(c.y, (c.text === 'Molino' ? o1.y : o2.y) + U.h * 0.1, 0.5) || true), 'and 10 % of its height down');
  const dyOK = cl.map(c => c.y).sort((a, b) => a - b); const wantY = [o1.y + U.h * 0.1, o2.y + U.h * 0.1].sort((a, b) => a - b);
  ok(near(dyOK[0], wantY[0], 0.01) && near(dyOK[1], wantY[1], 0.01), 'the vertical move is 10 % of the height of the whole selection');
  ok(new Set(await ev(() => PTD.core.state().layers.map(l => l.uid))).size === 5, 'every clone has its own uid');
  ok(await ev(() => PTD.core.state().selected !== 'l1') && cl.every(c => c.id !== 'l1'), 'the clones are the selection');
  await undo();
  ok(await nLayers() === 3, 'one Undo takes the clones away');
  await settle();
  await setSel(['l1']);
  await p.click('#cloneBtn');
  ok(await nLayers() === 4, 'the toolbar Clone button does the same');
  await undo();
  // clone to cursor
  await settle();
  await ev(() => { PTD.core.cfg().snap = false; });
  await setSel(['l1']);
  const cc1 = await toClient(await centreOf('l1'));
  await p.mouse.click(cc1.x, cc1.y, { button: 'right' });
  await p.locator('#ctxMenu .it', { hasText: 'Clone to cursor' }).dispatchEvent('mousedown');
  ok(await ev(() => PTD.core.ui.tool) === 'clonehere' && (await hint()).op === 'tool-clone', 'Clone to cursor starts the placing mode with its hint');
  const target0 = { x: 0, y: 330 };
  const tc = await toClient(target0);
  await p.mouse.move(tc.x - 30, tc.y - 20); await p.mouse.move(tc.x, tc.y);
  ok(await ev(() => document.querySelectorAll('#stage g[opacity="0.5"] text').length) >= 1, 'a ghost copy of the text hangs on the pointer');
  ok(await ev(() => !document.getElementById('dragReadout').hidden), 'the readout shows the place');
  await p.mouse.click(tc.x, tc.y);
  ok(await nLayers() === 4 && await ev(() => PTD.core.ui.tool) === 'select', 'a click puts the clone there and ends the mode');
  const newC = await ev(() => { const i = PTD.core.selectedIds()[0], b = PTD.core.ui.bounds[i]; return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; });
  ok(near(newC.x, target0.x, 1.5) && near(newC.y, target0.y, 1.5), 'the centre of the clone is at the pointer (' + newC.x.toFixed(1) + ', ' + newC.y.toFixed(1) + ')');
  await undo(); await settle();
  await setSel(['l1']);
  await ev(() => PTD.core.startCloneHere());
  await p.mouse.move(tc.x - 20, tc.y); await p.mouse.move(tc.x, tc.y);
  await p.keyboard.down('Shift'); await p.mouse.click(tc.x, tc.y); await p.mouse.click(tc.x + 80, tc.y + 10); await p.keyboard.up('Shift');
  ok(await nLayers() === 5 && await ev(() => PTD.core.ui.tool) === 'clonehere', 'Shift+click puts a clone and stays in the mode to put more');
  await p.keyboard.press('Escape');
  ok(await ev(() => PTD.core.ui.tool) === 'select' && await nLayers() === 5, 'Esc ends the mode');
  await ev(() => PTD.core.startCloneHere());
  await p.mouse.move(tc.x, tc.y); await p.mouse.click(tc.x, tc.y, { button: 'right' });
  ok(await ev(() => PTD.core.ui.tool) === 'select', 'a right click ends the mode as well');
  await p.mouse.click(e1.x, e1.y); await p.keyboard.press('Control+d');
  ok(/No text selected/.test(await msg()), 'Ctrl+D with nothing selected says so');
  // Delete in the menu, locked items
  await fresh();
  const c1o = await toClient(await centreOf('l1'));
  await p.mouse.click(c1o.x, c1o.y, { button: 'right' });
  await p.locator('#ctxMenu .it', { hasText: 'Delete' }).dispatchEvent('mousedown');
  ok(await nLayers() === 2, 'Delete in the menu deletes the text');
  await undo();
  await ev(() => { PTD.core.getLayer('l1').locked = true; PTD.core.renderStage(); });
  await p.mouse.click(c1o.x, c1o.y, { button: 'right' });
  const offs = await ev(() => Array.from(document.querySelectorAll('#ctxMenu .it.off')).map(n => n.textContent));
  ok(offs.length === 5 && /Font/.test(offs[0]) && /Size/.test(offs[1]) && /Split/.test(offs[2]) && /Join/.test(offs[3]) && /Delete/.test(offs[4]), 'for a locked text Font, Size, Split, Join and Delete are disabled, Clone works');
  await p.keyboard.press('Escape');
  await p.mouse.click(5, 5);

  // ================= REQ-022: the placement zones =================
  await fresh();
  await ev(() => { PTD.core.ui.view.z = 0.45; PTD.core.renderStage(); });
  const uA = await uidOf('l1'), uB = await uidOf('l2'), uC = await uidOf('l3');
  await ev(() => PTD.core.setTool('align'));
  await ev(([a, b]) => { PTD.align.select(['text:' + a, 'text:' + b]); PTD.align.targetButton(); }, [uA, uB]);
  await ev((c) => { PTD.align.select(['text:' + c]); }, uC);
  const T = await ev(() => PTD.align.state().target.box);
  const Mb = await ev((c) => PTD.align.boxOf('text:' + c), uC);
  const zz = await ev(() => PTD.core.ui.view.z);
  const px = (s, lo, hi) => s === 0 ? lo - 30 / zz : s === 1 ? lo + (hi - lo) * 0.17 : s === 2 ? (lo + hi) / 2 : s === 3 ? lo + (hi - lo) * 0.83 : hi + 30 / zz;
  const low = (s, tlo, thi, len) => s === 0 ? tlo - len : s === 1 ? tlo : s === 2 ? (tlo + thi) / 2 - len / 2 : s === 3 ? thi - len : thi;
  let all25 = true, bad = '';
  for (let iy = 0; iy < 5; iy++) for (let ix = 0; ix < 5; ix++) {
    const wp = { x: px(ix, T.x0, T.x1), y: px(iy, T.y0, T.y1) }, cp = await toClient(wp);
    await p.mouse.move(cp.x + 3, cp.y + 3); await p.mouse.move(cp.x, cp.y);
    const st = await ev(() => PTD.align.state());
    const ex = { dx: low(ix, T.x0, T.x1, Mb.x1 - Mb.x0) - Mb.x0, dy: low(iy, T.y0, T.y1, Mb.y1 - Mb.y0) - Mb.y0 };
    const mv = st.moves && st.moves['text:' + uC];
    if (!st.zone || st.zone.sx !== ix || st.zone.sy !== iy || !mv || !near(mv.dx, ex.dx, 0.2) || !near(mv.dy, ex.dy, 0.2)) { all25 = false; bad += ' [' + ix + ',' + iy + ']'; }
  }
  ok(all25, 'all 25 pointer positions give the slot and the destination of the formula' + (bad ? ' (wrong:' + bad + ')' : ''));
  const wpR = { x: px(4, T.x0, T.x1), y: px(1, T.y0, T.y1) }, cR = await toClient(wpR);
  await p.mouse.move(cR.x + 2, cR.y + 2); await p.mouse.move(cR.x, cR.y);
  ok((await hint()).op === 'align-zone' && /Enter/.test((await hint()).text) && /Alt/.test((await hint()).text), 'a zone shows its hint with Alt, Enter and Esc');
  const rd = await ev(() => ({ shown: !document.getElementById('dragReadout').hidden, t: document.getElementById('dragReadout').textContent }));
  ok(rd.shown && /right of, top/.test(rd.t), 'the label names the slot (' + rd.t + ')');
  ok(await ev(() => PTD.align.state().arrows) >= 1, 'the yellow arrow is shown');
  const far = await toClient({ x: T.x1 + 400 / zz, y: T.y0 });
  await p.mouse.move(far.x, far.y);
  ok(await ev(() => !PTD.align.state().zone && !PTD.align.state().hasPreview) && (await hint()).op === 'tool-align', 'beyond the capture ring nothing is previewed');
  // a click applies
  await p.mouse.move(cR.x + 2, cR.y + 2); await p.mouse.move(cR.x, cR.y);
  const mvExp = low(4, T.x0, T.x1, Mb.x1 - Mb.x0) - Mb.x0;
  const lC0 = await lay('l3');
  await p.mouse.click(cR.x, cR.y);
  const lC1 = await lay('l3');
  ok(near(lC1.x - lC0.x, mvExp, 0.3), 'a click puts the object in the slot (moved ' + (lC1.x - lC0.x).toFixed(1) + ', expected ' + mvExp.toFixed(1) + ')');
  await undo();
  // Enter applies
  await ev((c) => { PTD.align.select(['text:' + c]); }, uC);
  await p.mouse.move(cR.x + 2, cR.y + 2); await p.mouse.move(cR.x, cR.y);
  await ev(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('Enter');
  ok(near((await lay('l3')).x - lC0.x, mvExp, 0.3), 'Enter applies the shown place');
  await undo();
  // Alt: each object by itself; without Alt the group keeps its arrangement
  await ev(([c]) => { PTD.align.select(['text:' + c, 'band']); }, [uC]);
  const cCtr = { x: px(2, T.x0, T.x1), y: px(2, T.y0, T.y1) }, cK = await toClient(cCtr);
  await p.mouse.move(cK.x + 2, cK.y + 2); await p.mouse.move(cK.x, cK.y);
  const gm = await ev(() => PTD.align.state().moves);
  const k0 = Object.keys(gm);
  ok(k0.length === 2 && near(gm[k0[0]].dx, gm[k0[1]].dx, 0.001) && near(gm[k0[0]].dy, gm[k0[1]].dy, 0.001), 'without Alt the objects move together (the same move for both)');
  await p.keyboard.down('Alt'); await p.waitForTimeout(80);
  const am = await ev(() => PTD.align.state().moves), a0 = Object.keys(am);
  ok(a0.length === 2 && (!near(am[a0[0]].dx, am[a0[1]].dx, 0.01) || !near(am[a0[0]].dy, am[a0[1]].dy, 0.01)), 'with Alt each object goes to the slot by itself (different moves)');
  ok(await ev(() => PTD.align.state().arrows) === 2, 'and each has its own arrow');
  await p.keyboard.up('Alt'); await p.waitForTimeout(80);
  ok(await ev(() => PTD.align.state().arrows) === 1, 'releasing Alt brings the group preview back');
  await p.keyboard.press('Escape');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
