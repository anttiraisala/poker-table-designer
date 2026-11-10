/* Browser checks for the Ornament node, the Fringe glyph form and the glyph library (V148).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-ornament.js */
const { chromium } = require('playwright');
const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const root = path.resolve(__dirname, '..');
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const ev = (f, a) => p.evaluate(f, a); const wait = (ms) => p.waitForTimeout(ms || 250);
  const url = 'file://' + path.join(root, 'index.html');
  await p.goto(url); await ev(() => { localStorage.clear(); }); await p.goto(url); await wait(600);
  await p.click('[data-pa="pattern"]'); await wait(600);
  // an ornament node between a polygon and the output
  const r = await ev(() => {
    const g = PTD.core.state().graph, G = PTD.graph, o = g.nodes.filter(n => n.type === 'output')[0];
    const pg = G.addNode(g, 'polygon', 0, 0); pg.p = G.normParams('polygon', { sides: 4, r: 400, rot: 45 });
    const on = G.addNode(g, 'ornament', 300, 0);
    g.wires = g.wires.filter(w => w.to !== o.id);
    G.connect(g, pg.id, on.id, 'in'); G.connect(g, on.id, o.id, 'in');
    PTD.pathsui.editor.sel = on.id; PTD.core.renderPanels(); PTD.core.renderStage();
    const res = G.evaluate(g, o.id, PTD.pathsui.makeEnv ? PTD.pathsui.makeEnv({}) : {});
    return { kind: res.kind, n: res.paths ? res.paths.length : 0, fields: document.querySelectorAll('.gxfcol [data-gp]').length };
  });
  ok(r.kind === 'shape' && r.n > 4, 'the Ornament node makes a shape in the corners of a square ' + JSON.stringify(r));
  ok(r.fields > 10, 'the Ornament node panel shows its adjustments');
  // glyph library: save a glyph, list it in Settings, use it in a Fringe node
  await ev(() => PTD.core.addGlyph && PTD.core.addGlyph(PTD.glyph.fromShape('heart', 1).shape, 'Heart')); await wait(400);
  const lid = await ev(() => { const l = PTD.core.state().layers.filter(x => x.glyph && !x.pattern)[0]; return l && l.id; });
  ok(!!lid, 'a heart glyph exists');
  await ev((id) => { PTD.core.setTab && PTD.core.setTab('artwork'); PTD.core.renderPanels(); }, lid); await wait(300);
  const btn = await p.$('[data-act="glibsave"][data-id="' + lid + '"]');
  ok(!!btn, 'the glyph panel has Save to library');
  if (btn) { await btn.click(); await wait(300); }
  const lib = await ev(() => PTD.core.config().glyphs.length);
  ok(lib === 1, 'the glyph went into the library ' + lib);
  const fr = await ev(() => {
    const g = PTD.core.state().graph, G = PTD.graph, c = g.nodes.filter(n => n.type === 'circle')[0] || G.addNode(g, 'circle', 0, 300);
    const n = G.addNode(g, 'fringe', 300, 300); G.connect(g, c.id, n.id, 'in'); n.p.form = 'glyph'; PTD.pathsui.editor.sel = n.id; PTD.core.renderPanels();
    const sel = document.querySelector('#glsrc-' + n.id), add = document.querySelector('[data-pa="ggladd"]');
    return { id: n.id, opts: sel ? sel.options.length : 0, add: !!add };
  });
  ok(fr.opts >= 2 && fr.add, 'the Fringe glyph form lists project and library glyphs ' + JSON.stringify(fr));
  await ev(() => document.querySelector('[data-pa="ggladd"]').click()); await wait(300);
  const cnt = await ev((id) => (PTD.core.state().graph.nodes.filter(n => n.id === id)[0].p.glyphs || []).length, fr.id);
  ok(cnt === 1, 'Add glyph puts a copy into the node');
  await ev(() => document.querySelector('[data-pa="ggldel"]').click()); await wait(300);
  ok((await ev((id) => (PTD.core.state().graph.nodes.filter(n => n.id === id)[0].p.glyphs || []).length, fr.id)) === 0, 'the glyph can be removed from the node');
  // the library survives in the settings JSON
  const js = await ev(() => JSON.stringify(PTD.core.toPartJSON ? PTD.core.config() : {}));
  ok(js.indexOf('"glyphs"') >= 0, 'the library is part of the settings');
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
