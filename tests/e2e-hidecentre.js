/* Browser checks for V109: H / Shift+H hide and show (REQ-040) and exact centring of a text under letter space (REQ-041).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-hidecentre.js */
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
  // --- centring
  const c = await ev(() => {
    const l = PTD.core.state().layers[0]; l.x = 0; l.text = 'CASINO'; const out = {};
    out.isNew = l.exact === true;
    for (const ls of [0, 40]) { l.ls = ls; PTD.core.renderStage(); const t = PTD.core.ui.tbox[l.id]; out['c' + ls] = t.x + t.w / 2; out['w' + ls] = t.w; }
    l.exact = false; l.ls = 40; PTD.core.renderStage(); const t = PTD.core.ui.tbox[l.id]; out.legacy = t.x + t.w / 2;
    return out;
  });
  ok(c.isNew, 'a new text starts with exact centring');
  ok(Math.abs(c.c0) < 1.5 && Math.abs(c.c40) < 1.5, 'the box stays centred on Centre X when the letter space grows (' + c.c0.toFixed(1) + ', ' + c.c40.toFixed(1) + ')');
  ok(c.w40 > c.w0 + 100, 'and it widens');
  ok(c.legacy < -15, 'a text without the flag keeps the old drift (' + c.legacy.toFixed(1) + ')');
  // --- hide and show
  await ev(() => { const s = PTD.core.state(); s.layers.forEach((l, i) => { l.hidden = i === 2; }); PTD.core.renderPanels && PTD.core.renderPanels(); PTD.core.renderStage(); });
  await ev(() => { document.activeElement && document.activeElement.blur(); PTD.core.state().selected = 'l1'; PTD.core.ui.extra = { l2: 1, l3: 1 }; }); await wait();
  const hid = () => ev(() => PTD.core.state().layers.map(l => !!l.hidden));
  await p.keyboard.press('h'); await wait();
  ok(JSON.stringify(await hid()) === '[true,true,true]', 'H: the first selected is visible, so everything is hidden');
  await p.keyboard.press('h'); await wait();
  ok(JSON.stringify(await hid()) === '[false,false,false]', 'H again shows them all');
  await ev(() => { PTD.core.state().layers.forEach((l, i) => l.hidden = i !== 0); PTD.core.renderStage(); });
  await p.keyboard.press('Shift+H'); await wait();
  ok(JSON.stringify(await hid()) === '[false,false,false]', 'Shift+H shows everything that is hidden');
  ok(await ev(() => { PTD.core.state().layers[1].hidden = true; PTD.core.renderStage(); PTD.core.save('prep' + Date.now()); return true; }), 'prepare');
  await ev(() => { PTD.core.state().selected = 'l1'; PTD.core.ui.extra = {}; }); await wait(); await p.keyboard.press('h'); await wait();
  ok(JSON.stringify(await hid()) === '[true,true,false]', 'H on one thing hides only that');
  await p.keyboard.press('Control+z'); await wait();
  const hu = JSON.stringify(await hid()); ok(hu === '[false,true,false]', 'undo brings it back ' + hu);
  // + Add text lands in the middle of the view, centred exactly, even when copied from an old text
  await ev(() => { const c = PTD.core, s = c.state(); s.layers[0].exact = false; s.selected = 'l1'; c.ui.extra = {}; c.ui.view.cx += 300; c.ui.view.cy -= 120; c.renderStage(); });
  await p.click('#addText'); await wait(400);
  const at = await ev(() => { const c = PTD.core, s = c.state(), l = s.layers[s.layers.length - 1], t = c.ui.tbox[l.id], AO = c.artOrigin(); return { exact: l.exact, dx: (t.x + t.w / 2) - (c.ui.view.cx - AO.x), dy: (t.y + t.h / 2) - (c.ui.view.cy - AO.y) }; });
  ok(at.exact === true && Math.abs(at.dx) < 2 && Math.abs(at.dy) < 2, 'a new text lands with its box centre in the view centre (' + at.dx.toFixed(1) + ', ' + at.dy.toFixed(1) + ')');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
