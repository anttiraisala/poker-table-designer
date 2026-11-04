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

  // ---- card lines are centre lines: the gap is the distance between them whatever the thickness
  for (const th of [4, 12]) {
    const r = await ev((th) => {
      const st = PTD.core.state(); st.band.thick = th; st.band.gap = 100; st.band.show = true; st.band.hidden = false; PTD.core.renderStage();
      const m = { kind: 'near', f1: 'band:0', f2: 'band:1', off: 0 };
      const rr = PTD.measure.resolve(m);
      const rect = [...document.querySelectorAll('#stage g[transform^="translate("] rect')].map(e => e.getAttribute('fill')).length;
      return { v: rr.ok ? rr.val : null, rect };
    }, th);
    ok(r.v !== null && near(r.v, 100, 0.001), 'a 100 mm gap measures 100 mm with ' + th + ' mm lines: ' + r.v);
  }
  const ed = await ev(() => {
    const M = PTD.measure, st = PTD.core.state(), fm = (function () { const o = {}; PTD.measure._features().forEach(f => o[f.id] = f); return o; })();
    const f = fm['band:0'], x = f.rings[0].pts[0][0] + 50, y = f.rings[0].pts[0][1];
    const c = M.candidates({ x: x, y: y + 1.5 }, {}).filter(k => k.a && (k.a.t === 'bedge' || (k.a.t === 'along' && k.a.f === 'band:0'))).map(k => k.kind + ':' + k.y.toFixed(1));
    const a = { kind: 'points', mode: 'v', a: { t: 'bedge', f: 'band:0', w: 'in', s: 0.5 }, b: { t: 'bedge', f: 'band:1', w: 'in', s: 0.5 }, off: 0 };
    return { c: c, inner: M.value(a), th: st.band.thick };
  });
  ok(ed.c.some(k => /^line centre/.test(k)) && ed.c.some(k => /^inner edge/.test(k)) && ed.c.some(k => /^outer edge/.test(k)), 'a thick line offers line centre, inner edge and outer edge: ' + ed.c);
  ok(near(ed.inner, 100 - ed.th, 0.001), 'inner edge to inner edge is the gap minus the thickness: ' + ed.inner);

  // ---- end point on the line centre or an edge, Delete key, colour and arrow size
  await ev(() => {
    const st = PTD.core.state(); st.band.thick = 4; st.band.gap = 100; st.band.show = true; st.band.hidden = false; st.measures.length = 0;
    st.measures.push({ id: 'm1', kind: 'points', mode: 'v', a: { t: 'along', f: 'band:0', s: 0.5 }, b: { t: 'along', f: 'band:1', s: 0.5 }, off: 0, name: '' });
    PTD.core.ui.selMeasure = 'm1'; PTD.core.renderPanels(); PTD.core.renderStage();
  });
  ok(near(await ev(() => PTD.measure.value(PTD.core.state().measures[0])), 100, 0.001), 'centre to centre of the card lines is the gap');
  await p.selectOption('[data-scope="mref:m1:a"][data-key="w"]', 'in');
  ok(await ev(() => PTD.core.state().measures[0].a.t === 'bedge' && PTD.core.state().measures[0].a.w === 'in'), 'the panel can move an end to the inner edge of the line');
  ok(near(await ev(() => PTD.measure.value(PTD.core.state().measures[0])), 98, 0.001), 'inner edge of the upper line to the centre of the lower line is 98 mm: ' + await ev(() => PTD.measure.value(PTD.core.state().measures[0])));
  await p.selectOption('[data-scope="mref:m1:a"][data-key="w"]', 'centre');
  ok(near(await ev(() => PTD.measure.value(PTD.core.state().measures[0])), 100, 0.001), 'and back to the line centre');
  await ev(() => { PTD.core.ui.tool = 'select'; PTD.core.ui.dim = null; });
  // dragging an end point with the mouse attaches it to a new snap point
  const endPos = await ev(() => { const r = PTD.measure.resolve(PTD.core.state().measures[0]); return { A: r.A, B: r.B }; });
  await ev((A) => { const v = PTD.core.ui.view; v.z = 10; v.cx = A[0]; v.cy = A[1]; PTD.core.renderStage(); }, endPos.A);
  let sa = await toScreen({ x: endPos.A[0], y: endPos.A[1] });
  await p.mouse.move(sa.x, sa.y); await p.mouse.down();
  const outerY = endPos.A[1] - 2;   // outer edge of the upper line
  let so = await toScreen({ x: endPos.A[0], y: outerY });
  await p.mouse.move(so.x, so.y - 1, { steps: 4 }); await p.mouse.up();
  const after = await ev(() => PTD.core.state().measures[0].a);
  ok(after.t === 'bedge', 'dragging an end point re-attaches it to another point of the line: ' + JSON.stringify(after));
  const look = await ev(() => { const g = document.querySelector('#stage [data-h="meas:m1"]'); const path = [...document.querySelectorAll('#stage path')].filter(e => e.getAttribute('stroke') === '#3dff7a'); return { n: path.length, sw: path[0] && path[0].getAttribute('stroke-width') }; });
  ok(look.n >= 2 && look.sw === '1', 'measurements are drawn green with one pixel lines and arrow heads: ' + JSON.stringify(look));
  await p.keyboard.press('Delete');
  ok((await ev(() => PTD.core.state().measures.length)) === 0, 'Delete removes the selected measurement');

  // ---- the player-area line: centre and both edges, following the thickness
  const bet = await ev(() => {
    const t = PTD.tables.visible()[0]; t.bet.on = true; t.bet.thick = 10; t.bet.inset = 200; PTD.core.renderStage();
    const st = PTD.core.state(); st.measures.length = 0;
    const id = 't:' + t.id + ':bet', o = 't:' + t.id + ':outline';
    const mk = (w) => ({ kind: 'near', f1: o, f2: id });
    const A = { t: 'along', f: id, s: 0.25 }, I = { t: 'boff', f: id, w: 'in', s: 0.25 }, O = { t: 'boff', f: id, w: 'out', s: 0.25 };
    const m = (a, b) => ({ kind: 'points', mode: 'aligned', a: a, b: b, off: 0 });
    const r = { ci: PTD.measure.value(m(A, I)), co: PTD.measure.value(m(A, O)), io: PTD.measure.value(m(I, O)), ...{} };
    t.bet.thick = 20; PTD.core.renderStage();
    r.io2 = PTD.measure.value(m(I, O));
    const cands = PTD.measure.candidates(PTD.measure.resolve(m(A, A)).A ? { x: PTD.measure.resolve(m(A, A)).A[0], y: PTD.measure.resolve(m(A, A)).A[1] } : { x: 0, y: 0 }, {}).map(c => c.kind);
    r.cands = cands; return r;
  });
  ok(near(bet.ci, 5, 0.01) && near(bet.co, 5, 0.01) && near(bet.io, 10, 0.01), 'inner and outer edge of the player-area line are half the thickness from the centre: ' + JSON.stringify(bet));
  ok(near(bet.io2, 20, 0.01), 'the edge points follow when the thickness changes');
  ok(['line centre', 'inner edge', 'outer edge'].every(k => bet.cands.includes(k)), 'pointing at the player-area line offers centre and both edges: ' + bet.cands);
  const side = await ev(() => {
    const t = PTD.tables.visible()[0], id = 't:' + t.id + ':bet', fm = {}; PTD.measure._features().forEach(f => fm[f.id] = f);
    const o = fm['t:' + t.id + ':outline'];
    const q = (w) => PTD.measure.resolve({ kind: 'points', mode: 'aligned', a: { t: 'along', f: id, s: 0.25 }, b: { t: 'boff', f: id, w: w, s: 0.25 }, off: 0 }).B;
    const d = (pt) => { let b = 1e9; const r = o.rings[0].pts; for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length], dx = c[0] - a[0], dy = c[1] - a[1], L2 = dx * dx + dy * dy, u = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2)); b = Math.min(b, Math.hypot(pt[0] - a[0] - dx * u, pt[1] - a[1] - dy * u)); } return b; };
    return { inD: d(q('in')), outD: d(q('out')) };
  });
  ok(side.outD < side.inD, 'the outer edge is the side nearer the table outline: ' + JSON.stringify(side));
  await ev(() => { PTD.core.ui.tool = 'select'; PTD.core.ui.dim = null; PTD.core.state().measures.length = 0; });

  // ---- ray and shortest distance to the centre or an edge of a thick line (the end point of the ray is not an anchor)
  const ray2 = await ev(() => {
    const t = PTD.tables.visible()[0], st = PTD.core.state(); t.bet.on = true; t.bet.thick = 10; PTD.core.renderStage();
    const id = 't:' + t.id + ':bet', base = { kind: 'ray', a: { t: 'centre' }, dir: { type: 'axis', axis: 'down' }, target: id, off: 0 };
    const v = (r) => PTD.measure.value(Object.assign({}, base, { tref: r }));
    const n = (r) => PTD.measure.value({ kind: 'near', f1: 't:' + t.id + ':outline', f2: id, r2: r, off: 0 });
    st.measures.length = 0; st.measures.push(Object.assign({ id: 'm1', name: '' }, base)); PTD.core.ui.selMeasure = 'm1'; PTD.core.renderPanels(); PTD.core.renderStage();
    return { c: v('centre'), i: v('in'), o: v('out'), nc: n('centre'), ni: n('in'), no: n('out') };
  });
  ok(near(ray2.c - ray2.i, 5, 0.01) && near(ray2.o - ray2.c, 5, 0.01), 'a ray to the player-area line measures to its centre or either edge: ' + JSON.stringify(ray2));
  ok(Math.abs(ray2.i - ray2.o) > 9.9 && Math.abs(ray2.i - ray2.o) < 10.1, 'the two edges are the thickness apart along the ray');
  ok(ray2.no < ray2.nc && ray2.nc < ray2.ni, 'shortest distance from the outline: outer edge nearest, inner edge farthest: ' + [ray2.no, ray2.nc, ray2.ni]);
  await p.selectOption('[data-scope="mref:m1:tref"][data-key="w"]', 'out');
  ok((await ev(() => PTD.core.state().measures[0].tref)) === 'out', 'the panel chooses the edge of the target line');
  await ev(() => { PTD.core.state().measures[0].tref = 'centre'; PTD.core.ui.tool = 'select'; PTD.core.ui.dim = null; PTD.core.renderStage(); });
  const endB = await ev(() => { const r = PTD.measure.resolve(PTD.core.state().measures[0]); const v = PTD.core.ui.view; v.z = 10; v.cx = r.B[0]; v.cy = r.B[1]; PTD.core.renderStage(); return r.B; });
  const sb = await toScreen({ x: endB[0], y: endB[1] });
  await p.mouse.move(sb.x, sb.y); await p.mouse.down();
  const sb2 = await toScreen({ x: endB[0], y: endB[1] - 5 });   // towards the outer edge (up is the table edge for this ray's side) or the inner
  await p.mouse.move(sb2.x, sb2.y, { steps: 4 }); await p.mouse.up();
  ok(['in', 'out'].includes(await ev(() => PTD.core.state().measures[0].tref)), 'dragging the end of a ray over a thick line moves it to an edge: ' + await ev(() => PTD.core.state().measures[0].tref));
  await ev(() => { PTD.core.state().measures.length = 0; PTD.core.ui.selMeasure = null; PTD.core.renderStage(); });

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
