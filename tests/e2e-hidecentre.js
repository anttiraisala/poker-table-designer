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
  // changing size or letter space keeps the middle of the box where it is (also when turned)
  for (const rot of [0, 30]) {
    await ev((rot) => { const c = PTD.core, s = c.state(), l = s.layers[s.layers.length - 1]; l.rot = rot; l.x = 200; l.y = 100; c.renderStage(); }, rot);
    const mid = () => ev(() => { const c = PTD.core, s = c.state(), l = s.layers[s.layers.length - 1], t = c.ui.tbox[l.id], P = c.pivotOf(l), cx = t.x + t.w / 2, cy = t.y + t.h / 2, a = l.rot * Math.PI / 180, dx = cx - P.x, dy = cy - P.y; return [P.x + dx * Math.cos(a) - dy * Math.sin(a), P.y + dx * Math.sin(a) + dy * Math.cos(a), Math.hypot(dx, dy)]; });
    const m0 = await mid();
    const set = async (key, v) => { await ev(([k, v]) => { const i = [...document.querySelectorAll('[data-key="' + k + '"]')].filter(e => e.type === 'range' || e.type === 'number')[0]; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, [key, v]); await wait(300); };
    await set('size', 90); const m1 = await mid(); await set('ls', 25); const m2 = await mid(); await set('size', 220); const m3 = await mid();
    const dist = Math.max(...[m1, m2, m3].map(q => Math.hypot(q[0] - m0[0], q[1] - m0[1])));
    ok(m0[2] < 1 && dist < 3, 'the turning point is the middle of the box, and size and letter space leave the middle of the box in place at rotation ' + rot + ' (max shift ' + dist.toFixed(1) + ' mm)');
  }
  // turning (the Turn field) is about the middle of the box
  const tb0 = await ev(() => { const c = PTD.core, s = c.state(), l = s.layers[s.layers.length - 1]; l.rot = 0; l.x = 120; l.y = 80; c.renderStage(); const b = c.ui.bounds[l.id]; return [b.x + b.w / 2, b.y + b.h / 2]; });
  await ev(() => { const i = [...document.querySelectorAll('[data-key="rot"]')].filter(e => e.type === 'number')[0]; i.value = 45; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(300);
  const tb1 = await ev(() => { const c = PTD.core, s = c.state(), l = s.layers[s.layers.length - 1], b = c.ui.bounds[l.id]; return { m: [b.x + b.w / 2, b.y + b.h / 2], rot: l.rot }; });
  ok(tb1.rot === 45 && Math.hypot(tb1.m[0] - tb0[0], tb1.m[1] - tb0[1]) < 1.5, 'turning a text keeps the middle of its box in place (' + tb0.map(v => v.toFixed(1)) + ' -> ' + tb1.m.map(v => v.toFixed(1)) + ')');
  // stack order: bring to front, forward, backward, to back (the right-click menu items call these)
  const ord = () => ev(() => PTD.core.stackIds().filter(i => i !== 'band').join());
  await ev(() => { const c = PTD.core; c.state().selected = 'l1'; c.ui.extra = {}; });
  const o0 = await ord();
  await ev(() => PTD.core.actStack('front')); const o1 = await ord();
  ok(o1.split(',').pop() === 'l1' && o1 !== o0, 'Bring to front puts the selected text on top (' + o0 + ' -> ' + o1 + ')');
  await ev(() => PTD.core.actStack('down')); const o2 = await ord();
  ok(o2.split(',').indexOf('l1') === o1.split(',').indexOf('l1') - 1, 'Send backward moves it one step down (' + o2 + ')');
  await ev(() => PTD.core.actStack('up')); ok((await ord()) === o1, 'Bring forward moves it one step up again');
  await ev(() => PTD.core.actStack('back')); ok((await ord()).split(',')[0] === 'l1', 'Send to back puts it at the bottom (' + await ord() + ')');
  await ev(() => { const c = PTD.core; c.state().selected = 'l2'; c.ui.extra = { l3: 1 }; c.actStack('front'); });
  const o4 = (await ord()).split(','); ok(o4.slice(-2).join() === 'l2,l3', 'two selected texts keep their order when brought to the front (' + o4 + ')');
  // the right-click menu has the four items
  const menu = await ev(() => { const t = document.querySelector('#stage [data-id="l1"]') || document.querySelector('[data-id]'); const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.click(menu.x, menu.y, { button: 'right' }); await wait(300);
  const items = await ev(() => [...document.querySelectorAll('#ctxMenu .it')].map(n => n.textContent.replace(/\s+/g, ' ').trim()));
  ok(['Bring to front', 'Bring forward', 'Send backward', 'Send to back'].every(w => items.some(i => i.indexOf(w) === 0)), 'the right-click menu offers the four order items (' + items.join(' | ') + ')');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
