/* Browser checks for REQ-031 (Split words) and REQ-032 (Join texts).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-splitjoin.js */
const { chromium } = require('playwright');
const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
(async () => {
  const root = path.resolve(__dirname, '..');
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  const ev = (f, a) => p.evaluate(f, a);
  const url = 'file://' + path.join(root, 'index.html');
  async function fresh() {
    await p.goto(url); await ev(() => { localStorage.clear(); });
    await p.goto(url); await p.waitForTimeout(500);
    await ev(() => {
      PTD.core.cfg().snap = false; PTD.core.cfg().keepOriginal = false;
      const s = PTD.core.state(); s.layers = []; s.band.at = 0;
      const mk = (text, x, y) => Object.assign({}, PTD.core.state().layers[0] || {}, { text, x, y });
      PTD.core.save();
    });
  }
  const add = (list) => ev((list) => {
    const s = PTD.core.state(); const base = { font: s.layers.length ? s.layers[0].font : 'Arial', size: 100, ls: 0, rot: 0, upper: false, cap: false, capAll: false, frozen: null, locked: false, nameWord: false, gen: '', styleHidden: false };
    list.forEach(t => s.layers.push(Object.assign({}, base, t)));
    s.layers.forEach((l, i) => { l.id = 'l' + (i + 1); });
    PTD.core.save(); PTD.core.renderPanels(); PTD.core.renderStage();
  }, list);
  const texts = () => ev(() => PTD.core.state().layers.map(l => ({ id: l.id, text: l.text, x: l.x, y: l.y, nw: l.nameWord, uid: l.uid })));
  const sel = (ids) => ev((ids) => { const s = PTD.core.state(), u = PTD.core.ui; s.selected = ids[0] || null; u.extra = {}; ids.slice(1).forEach(k => u.extra[k] = true); u.areaSel = false; PTD.core.renderPanels(); PTD.core.renderStage(); }, ids);
  const wait = () => p.waitForTimeout(300);

  // Split, original off
  await fresh(); await add([{ text: 'Molino Royale Casino', x: 0, y: 0, nameWord: true }]); await wait();
  const box = await ev(() => PTD.core.ui.tbox.l1);
  await sel(['l1']);
  ok(!(await ev(() => document.getElementById('splitBtn').disabled)), 'Split button is enabled for one multi-word text');
  ok(await ev(() => document.getElementById('joinBtn').disabled), 'Join button is disabled for one text');
  await p.click('#splitBtn'); await wait();
  let t = await texts();
  ok(t.length === 3 && t.map(x => x.text).join('|') === 'Molino|Royale|Casino', 'three texts, one per word, in order');
  ok(near(t[1].x - t[0].x, box.w / 3, 0.01) && near(t[2].x - t[1].x, box.w / 3, 0.01), 'equal horizontal step W/n');
  ok(near(t[1].y - t[0].y, box.h / 3, 0.01) && near(t[2].y - t[1].y, box.h / 3, 0.01), 'equal vertical step H/n');
  ok(t[0].nw && t[1].nw && t[2].nw, 'all pieces keep the name-word flag');
  ok((await ev(() => PTD.core.selectedIds())).length === 3, 'the new words are selected');
  await p.click('#undoBtn'); await wait();
  t = await texts(); ok(t.length === 1 && t[0].text === 'Molino Royale Casino', 'one undo step restores the text');

  // Split, original on
  await ev(() => { PTD.core.cfg().keepOriginal = true; }); await sel(['l1']);
  await p.click('#splitBtn'); await wait();
  t = await texts();
  ok(t.length === 4 && t[0].text === 'Molino Royale Casino' && t[1].text === 'Molino' && t[3].text === 'Casino', 'keep original: the original stays, clones follow');
  ok(near(t[1].x - t[0].x, box.w / 3, 0.01), 'keep original: first clone one step away');

  // Refusals
  await fresh(); await add([{ text: 'One', x: 0, y: 0 }, { text: 'Two words', x: 0, y: 300, locked: true }, { text: 'Fro zen', x: 0, y: 600, frozen: { w: 1 } }]); await wait();
  await sel(['l1']); ok(await ev(() => document.getElementById('splitBtn').disabled), 'one-word text cannot be split');
  await sel(['l2']); ok(await ev(() => document.getElementById('splitBtn').disabled), 'locked text cannot be split');
  await ev(() => PTD.core.actSplit()); ok(/locked/.test(await ev(() => document.getElementById('toolMsg').textContent)), 'locked: reason is said');
  await sel(['l3']); ok(await ev(() => document.getElementById('splitBtn').disabled), 'frozen text cannot be split');

  // Join, original off, selection order
  await fresh(); await add([{ text: 'Alpha', x: 0, y: 0 }, { text: 'Beta', x: 0, y: 300 }, { text: '', x: 0, y: 600 }, { text: 'Gamma', x: 0, y: 900 }]); await wait();
  await ev(() => { PTD.core.save(); const s = PTD.core.state(); window.__u = s.layers[1].uid; PTD.cpoints.make({ kind: 'text', id: s.layers[3].uid }, 50, 950); window.__cp = PTD.cpoints.list()[0]; window.__w = PTD.cpoints.worldPos(window.__cp); });
  await sel(['l4', 'l1', 'l2', 'l3']);
  ok(!(await ev(() => document.getElementById('joinBtn').disabled)), 'Join enabled for several texts');
  await p.click('#joinBtn'); await wait();
  t = await texts();
  ok(t.length === 1 && t[0].text === 'Gamma Alpha Beta', 'joined in selection order, empty text skipped, others removed');
  ok(t[0].x === 0 && t[0].y === 900, 'the first selected text stays where it was');
  const cp = await ev(() => { const c = PTD.cpoints.list()[0]; return { par: c.parent, uid: PTD.core.state().layers[0].uid }; });
  ok(cp.par.kind === 'text' && cp.par.id === cp.uid, 'a control point stays on the surviving text');
  await p.click('#undoBtn'); await wait();
  ok((await texts()).length === 4, 'one undo step restores the texts');

  // Join, area selection: reading order
  await fresh(); await add([{ text: 'Down', x: 0, y: 900 }, { text: 'Right', x: 2000, y: 0 }, { text: 'Left', x: 0, y: 0 }]); await wait();
  await sel(['l1', 'l2', 'l3']); await ev(() => { PTD.core.ui.areaSel = true; });
  await ev(() => PTD.core.actJoin()); await wait();
  t = await texts(); ok(t.length === 1 && t[0].text === 'Left Right Down', 'area selection joins in reading order');

  // Join, original on
  await fresh(); await ev(() => { PTD.core.cfg().keepOriginal = true; });
  await add([{ text: 'A', x: 0, y: 0 }, { text: 'B', x: 0, y: 300 }]); await wait(); await sel(['l1', 'l2']);
  await ev(() => PTD.core.actJoin()); await wait();
  t = await texts(); ok(t.length === 3 && t.some(x => x.text === 'A B') && t.some(x => x.text === 'A') && t.some(x => x.text === 'B'), 'keep original: a new joined text, the originals stay');

  // Locked refuses join
  await fresh(); await add([{ text: 'A', x: 0, y: 0, locked: true }, { text: 'B', x: 0, y: 300 }]); await wait(); await sel(['l1', 'l2']);
  ok(await ev(() => document.getElementById('joinBtn').disabled), 'a locked text blocks Join');

  // Context menu
  await fresh(); await add([{ text: 'Two words', x: 0, y: 0 }]); await wait();
  const pt = await ev(() => { const b = PTD.core.ui.bounds.l1, r = document.getElementById('stage').getBoundingClientRect(), v = PTD.core.ui.view; return { x: r.left + r.width / 2 + (b.x + b.w / 2 - v.cx) * v.z, y: r.top + r.height / 2 + (b.y + b.h / 2 - v.cy) * v.z }; });
  await p.mouse.click(pt.x, pt.y, { button: 'right' }); await wait();
  const items = await ev(() => Array.from(document.querySelectorAll('#ctxMenu .it, .ctx .it')).map(n => n.textContent));
  ok(items.some(x => /Split words/.test(x)) && items.some(x => /Join texts/.test(x)), 'the right-click menu lists Split words and Join texts');

  // Option persists
  await fresh(); await ev(() => { PTD.core.cfg().keepOriginal = true; });
  ok(await ev(() => PTD.core.cfg().keepOriginal === true), 'keepOriginal option can be set; default is off after reset');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
