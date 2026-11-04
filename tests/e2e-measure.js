/* Browser checks for lasting measurements (Guides and measurements tab).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-measure.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, e = 0.05) => Math.abs(a - b) <= e;
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(800);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const o = PTD.random.opts; Object.keys(o).forEach(k => { if (/(Vary|Set)$/.test(k)) o[k] = false; }); o.shape = false; });

  await p.click('#tabs button[data-tab="guides"]');
  ok((await p.textContent('#tabs button[data-tab="guides"]')) === 'Guides and measurements', 'the tab is called Guides and measurements');
  ok(await p.isVisible('[data-act="madd"][data-k="points"]'), 'the Add buttons are in the panel');
  ok(await ev(() => (PTD.core.state().measures || []).length === 0), 'a new project has no measurements');

  // ---- permanent text ids
  const uids = await ev(() => PTD.core.state().layers.map(l => l.uid));
  ok(uids.length >= 2 && uids.every(Boolean) && new Set(uids).size === uids.length, 'every text has a unique permanent uid: ' + uids);

  // ---- point to point with a ghost, using the real pointer path
  const geo = await ev(() => { const t = PTD.tables.visible()[0]; return { n: PTD.tables.worldNodes(t), id: t.id }; });
  const n0 = geo.n[0];
  await p.click('[data-act="madd"][data-k="points"]');
  ok(await ev(() => PTD.core.ui.tool === 'dim'), 'choosing a kind starts the measuring tool');
  const toScreen = (w) => ev((w) => { const r = document.getElementById('stage').getBoundingClientRect(), v = PTD.core.ui.view; return { x: r.left + r.width / 2 + (w.x - v.cx) * v.z, y: r.top + r.height / 2 + (w.y - v.cy) * v.z }; }, w);
  let s = await toScreen({ x: 0, y: 0 });
  await p.mouse.move(s.x, s.y); await p.mouse.click(s.x, s.y);
  s = await toScreen({ x: n0.x, y: n0.y });
  await p.mouse.move(s.x - 2, s.y + 1);
  const ghost = await ev(() => { const d = PTD.core.ui.dim; return d && d.prev ? { v: d.prev.val, kind: d.hover.kind } : null; });
  ok(ghost && ghost.kind === 'node' && near(ghost.v, Math.hypot(n0.x, n0.y), 0.01), 'a ghost shows the value and names the snap kind while pointing: ' + JSON.stringify(ghost));
  ok((await ev(() => document.querySelector('#stage').innerHTML)).includes('stroke-dasharray="5 4"'), 'the ghost is drawn dashed');
  ok((await ev(() => (PTD.core.state().measures || []).length)) === 0, 'nothing is added before the second click');
  await p.mouse.click(s.x - 2, s.y + 1);
  let m = await ev(() => PTD.core.state().measures);
  ok(m.length === 1 && m[0].kind === 'points' && m[0].a.t === 'centre' && m[0].b.t === 'tnode', 'two clicks add a point-to-point measurement attached to the cloth centre and a table node: ' + JSON.stringify(m));
  ok(near(await ev(() => PTD.measure.value(PTD.core.state().measures[0])), Math.hypot(n0.x, n0.y), 0.01), 'its value is the distance');
  ok(await ev(() => PTD.core.state().measures[0].id) === 'm1', 'it gets id m1');

  // ---- it follows the object
  await ev(() => { const t = PTD.tables.visible()[0]; t.x += 100; PTD.core.save(); PTD.core.renderStage(); });
  const nn = await ev(() => { const t = PTD.tables.visible()[0]; return PTD.tables.worldNodes(t)[0]; });
  ok(near(await ev(() => PTD.measure.value(PTD.core.state().measures[0])), Math.hypot(nn.x, nn.y), 0.01), 'the measurement follows when the table moves');
  await ev(() => { const t = PTD.tables.visible()[0]; t.x -= 100; PTD.core.save(); PTD.core.renderStage(); });
  ok((await ev(() => document.querySelectorAll('#stage [data-h^="meas:"]').length)) > 0, 'it is drawn on the stage and can be grabbed');

  // ---- toolbar switch
  await p.uncheck('[data-key="showMeasures"]');
  ok((await ev(() => document.querySelectorAll('#stage [data-h^="meas:"]').length)) === 0, 'the toolbar switch hides measurements');
  await p.check('[data-key="showMeasures"]');

  // ---- ray towards the table centre, to the outline on the far side
  const ray = await ev((id) => {
    const M = PTD.measure, t = PTD.tables.visible()[0], wn = PTD.tables.worldNodes(t);
    const m = { kind: 'ray', a: { t: 'tnode', table: t.id, i: 0 }, dir: { type: 'centre', table: t.id }, target: 't:' + id + ':outline', off: 0 };
    const r = M.resolve(m); return { ok: r.ok, val: r.ok ? r.val : 0, B: r.B, A: r.A, t: { x: t.x, y: t.y } };
  }, geo.id);
  ok(ray.ok && ray.val > Math.hypot(ray.A[0] - ray.t.x, ray.A[1] - ray.t.y) * 1.0, 'a ray from a node through the table centre reaches the far side of the outline: ' + JSON.stringify(ray));

  // ---- ray along an axis to a guide
  const rg = await ev(() => {
    PTD.guides.add('x', 500);
    const g = PTD.core.state().guides.slice(-1)[0];
    const m = { kind: 'ray', a: { t: 'centre' }, dir: { type: 'axis', axis: 'right' }, target: 'g:' + g.id, off: 0 };
    const r = PTD.measure.resolve(m); return r.ok ? r.val : null;
  });
  ok(near(rg, 500, 0.01), 'a ray along an axis measures to a guide: ' + rg);

  // ---- shortest distance and span along a guide
  const nr = await ev(() => {
    const M = PTD.measure, t = PTD.tables.visible()[0];
    PTD.tables.visible()[0].bet.on = true; PTD.core.renderStage();
    const m = { kind: 'near', f1: 't:' + t.id + ':outline', f2: 't:' + t.id + ':bet' };
    const r = M.resolve(m); return r.ok ? r.val : null;
  });
  const betMm = await ev(() => PTD.tables.visible()[0].bet.inset);
  ok(nr !== null && nr > 0 && nr < 400, 'shortest distance between the outline and the player-area line resolves: ' + nr + ' (inset ' + betMm + ')');
  const span = await ev(() => {
    const t = PTD.tables.visible()[0], g = PTD.core.state().guides.slice(-1)[0];
    PTD.guides.add('x', 0);
    const gx = PTD.core.state().guides.slice(-1)[0];
    const fm = {};
    const cr = PTD.measure.candidates({ x: 0, y: 0 }, { only: 'g:' + gx.id });
    const m = { kind: 'span', guide: gx.id, a: { t: 'cross', f1: 'g:' + gx.id, f2: 't:' + t.id + ':outline', x: 0, y: -1000 }, b: { t: 'cross', f1: 'g:' + gx.id, f2: 't:' + t.id + ':outline', x: 0, y: 1000 }, off: 0 };
    const r = PTD.measure.resolve(m); const h = PTD.tables.visible()[0].h;
    return { v: r.ok ? r.val : null, h: h };
  });
  ok(span.v !== null && span.v > 100, 'distance along a guide between its two crossings with the outline: ' + JSON.stringify(span));

  // ---- text edges
  const tx = await ev(() => {
    const l = PTD.core.state().layers[0];
    const m = { kind: 'points', mode: 'h', a: { t: 'ext', f: 'x:' + l.uid, w: 'left' }, b: { t: 'ext', f: 'x:' + l.uid, w: 'right' }, off: 0 };
    const r = PTD.measure.resolve(m); return { ok: r.ok, v: r.ok ? r.val : null, box: l.box };
  });
  ok(tx.ok && tx.v > 50, 'the width of a text (traced or from its box) can be measured: ' + JSON.stringify(tx));
  const uidKeep = await ev(() => {
    const st = PTD.core.state(); const keep = st.layers[1].uid;
    return keep;
  });
  await ev(() => { const st = PTD.core.state(); st.layers.splice(0, 1); PTD.core.save(); });
  ok((await ev(() => PTD.core.state().layers[0].uid)) === uidKeep, 'a text keeps its uid when an earlier text is deleted');

  // ---- panel: list, rename, offset, delete
  await ev(() => { PTD.core.state().measures.length = 1; PTD.core.renderPanels(); });
  await p.fill('[data-scope="meas:m1"][data-key="name"]', 'centre to node');
  ok((await ev(() => PTD.core.state().measures[0].name)) === 'centre to node', 'a measurement can be named in the panel');
  await p.fill('[data-scope="meas:m1"][data-key="off"]', '25');
  ok((await ev(() => PTD.core.state().measures[0].off)) === 25, 'the dimension line offset can be set in the panel');

  // ---- saved with the project, undo is a normal step, not cut
  const j = await ev(() => JSON.parse(JSON.stringify(PTD.core.toJSON(false))));
  ok(Array.isArray(j.measures) && j.measures.length === 1 && j.measures[0].name === 'centre to node', 'measurements are saved in the project');
  const norm = await ev(() => PTD.measure.normalize([{ kind: 'bogus' }, { kind: 'points', a: { t: 'centre' }, b: { t: 'centre' } }]).length);
  ok(norm === 1, 'damaged entries are dropped when loading');
  await p.click('[data-act="mdel"][data-id="m1"]');
  ok((await ev(() => PTD.core.state().measures.length)) === 0, 'Delete removes it');
  await ev(() => document.getElementById('undoBtn').click());
  ok((await ev(() => PTD.core.state().measures.length)) === 1, 'Undo brings it back');

  // ---- broken reference stays in the list
  await ev(() => { const st = PTD.core.state(); st.measures[0].b = { t: 'tnode', table: 'nope', i: 0 }; PTD.core.renderPanels(); });
  ok(/broken/.test(await p.textContent('#guidesPane')), 'a measurement with a missing object is listed as broken');

  // ---- Escape cancels the tool
  await p.click('[data-act="madd"][data-k="near"]');
  await p.keyboard.press('Escape');
  ok(await ev(() => PTD.core.ui.tool === 'select' && !PTD.core.ui.dim), 'Esc cancels the tool');

  // ---- setting for the trace precision lives in the settings
  ok(await ev(() => PTD.core.cfg().traceRes === 10), 'the text precision defaults to 10 pixels per mm');
  ok(await ev(() => !('measures' in PTD.core.toPartJSON('settings'))), 'the settings file holds no measurements');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? fails + ' FAILED' : 'all passed'); await b.close(); process.exit(fails ? 1 : 0);
})();
