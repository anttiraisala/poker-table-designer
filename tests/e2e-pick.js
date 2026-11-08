/* Browser checks for the four ways a click finds the item under it (V134, config.hitMode).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-pick.js */
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
  ok(await ev(() => PTD.core.cfg().hitMode === 'shape'), 'the default way is the real shape');
  // a text in the middle, a big ring (a glyph with a hole) above it
  await ev(() => {
    const s = PTD.core.state(); PTD.core.cfg().snap = false; s.layers = []; s.groups = []; s.band.hidden = true; s.band.at = 0;
    PTD.core.addGlyph('heart', {}); const g = s.layers[0]; g.text = 'Ring'; g.x = 0; g.y = 0; g.rot = 0; g.outline = false; g.size = 800;
    g.frozen = { d: 'M-400 0A400 400 0 1 0 400 0A400 400 0 1 0 -400 0Z M-300 0A300 300 0 1 1 300 0A300 300 0 1 1 -300 0Z', x0: -400, y0: -400, x1: 400, y1: 400 };
    s.layers.unshift(Object.assign({}, g, { id: 'txt', text: 'Inside', glyph: false, frozen: null, uid: 'u-txt', size: 120, x: 0, y: 40, font: s.layers[0].font }));
    g.uid = g.uid || 'u-ring'; PTD.core.save(); PTD.core.renderPanels(); PTD.core.renderStage();
  });
  await wait(400);
  const ids = await ev(() => PTD.core.state().layers.map(l => l.id));
  const ringId = ids.filter(i => i !== 'txt')[0];
  const where = (lx, ly) => ev((a) => { const s = PTD.core.state(), O = PTD.core.artOrigin(), v = PTD.core.ui.view, r = document.getElementById('stage') ? document.getElementById('stage').getBoundingClientRect() : document.querySelector('svg#stage, #stage svg').getBoundingClientRect(); return { x: r.left + r.width / 2 + (O.x + a[0] - v.cx) * v.z, y: r.top + r.height / 2 + (O.y + a[1] - v.cy) * v.z }; }, [lx, ly]);
  const sel = () => ev(() => PTD.core.state().selected);
  const clickAt = async (lx, ly) => { await ev(() => { PTD.core.state().selected = null; PTD.core.renderStage(); }); const q = await where(lx, ly); await p.mouse.click(q.x, q.y); await wait(250); return sel(); };
  const setMode = (m) => ev((m) => { PTD.core.cfg().hitMode = m; PTD.core.renderStage(); }, m);
  const t = await ev(() => { const l = PTD.core.ui.tbox['txt']; return l ? { x: l.x + l.w / 2, y: l.y + l.h / 2 } : null; });
  const tx = t ? t.x : 0, ty = t ? t.y : 40;
  for (const m of ['shape', 'geom', 'buffer']) {
    await setMode(m);
    ok(await clickAt(350, 0) === ringId, m + ': a click on the body of the ring selects the ring');
    ok(await clickAt(tx, ty) === 'txt', m + ': a click in the hole of the ring selects the text under it (' + (await sel()) + ')');
  }
  await setMode('box');
  ok(await clickAt(tx, ty) === ringId, 'box (old way): the box of the ring still swallows the click in its hole');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
