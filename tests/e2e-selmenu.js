/* Browser checks for the drop-down lists with arrow-key preview (REQ-056, V129).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-selmenu.js */
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
  // a text weight
  await ev(() => { const s = PTD.core.state(); const L0 = s.layers.filter(l => !l.pattern && !l.glyph)[0]; s.selected = L0.id; PTD.core.ui.open[L0.id] = true; PTD.core.renderPanels(); });
  const wsel = 'select[data-key="weight"]';
  ok(await ev((q) => PTD.selmenu.eligible(document.querySelector(q)), wsel), 'the weight list is a preview list');
  ok(await ev(() => !PTD.selmenu.eligible(document.querySelector('select[data-scope="cfg"][data-key="units"]'))), 'the units list of the settings stays native');
  const w0 = await ev((q) => { const el = document.querySelector(q); el.scrollIntoView({ block: 'center' }); const l = PTD.core.state().layers.filter(l => !l.pattern && !l.glyph)[0]; return { w: l.weight, hist: PTD.core.state() && 0 }; }, wsel);
  const box = await ev((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, wsel);
  const undoLen = () => ev(() => document.getElementById('undoBtn') ? !document.getElementById('undoBtn').disabled : null);
  await p.mouse.click(box.x, box.y); await wait(200);
  ok(await ev(() => !document.getElementById('selMenu').hidden), 'a click opens the list');
  const rowsN = await ev(() => document.querySelectorAll('#selMenu .opt').length);
  ok(rowsN >= 3, 'the list shows the choices (' + rowsN + ')');
  await p.keyboard.press('ArrowDown'); await wait(150);
  const w1 = await ev(() => PTD.core.state().layers.filter(l => !l.pattern && !l.glyph)[0].weight);
  ok(w1 !== w0.w, 'an arrow key shows the next choice on the text at once (' + w0.w + ' to ' + w1 + ')');
  await p.keyboard.press('Escape'); await wait(150);
  const w2 = await ev(() => PTD.core.state().layers.filter(l => !l.pattern && !l.glyph)[0].weight);
  ok(w2 === w0.w && await ev(() => document.getElementById('selMenu').hidden), 'Esc puts the old value back and closes the list');
  await p.mouse.click(box.x, box.y); await wait(200);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await wait(150);
  await p.keyboard.press('Enter'); await wait(250);
  const w3 = await ev(() => PTD.core.state().layers.filter(l => !l.pattern && !l.glyph)[0].weight);
  ok(w3 !== w0.w && await ev(() => document.getElementById('selMenu').hidden), 'Enter keeps the choice (' + w3 + ')');
  await ev(() => { document.getElementById('undoBtn').click(); }); await wait(250);
  const w4 = await ev(() => PTD.core.state().layers.filter(l => !l.pattern && !l.glyph)[0].weight);
  ok(w4 === w0.w, 'one Undo takes back the whole arrow session (' + w4 + ')');
  // a click elsewhere keeps the shown choice
  await p.mouse.click(box.x, box.y); await wait(200);
  await p.keyboard.press('ArrowDown'); await wait(150);
  await p.mouse.click(5, 5); await wait(250);
  ok(await ev((x) => PTD.core.state().layers.filter(l => !l.pattern && !l.glyph)[0].weight !== x, w0.w), 'a click elsewhere keeps the shown choice');
  // the graph editor
  await ev(() => { const g = PTD.core.state().graph, c = PTD.graph.addNode(g, 'circle', 0, 0), n = PTD.graph.addNode(g, 'fringe', 300, 0); PTD.graph.connect(g, c.id, n.id, 'in'); PTD.pathsui.openEditor(); PTD.pathsui.editor.sel = n.id; PTD.core.renderPanels(); window.__fid = n.id; });
  const fsel = 'select[data-gp$="|form"]';
  const fb = await ev((q) => { const el = document.querySelector(q); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, fsel);
  await p.mouse.click(fb.x, fb.y); await wait(200);
  await p.keyboard.press('ArrowDown'); await wait(200);
  ok(await ev(() => PTD.graph.node(PTD.core.state().graph, window.__fid).p.form === 'curl'), 'a graph node choice previews with the arrows');
  await p.keyboard.press('Escape'); await wait(250);
  ok(await ev(() => PTD.graph.node(PTD.core.state().graph, window.__fid).p.form === 'straight'), 'Esc restores the graph node choice');
  await p.mouse.click(fb.x, fb.y); await wait(200);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(300);
  ok(await ev(() => PTD.graph.node(PTD.core.state().graph, window.__fid).p.form === 'lightning'), 'Enter keeps the graph node choice');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
