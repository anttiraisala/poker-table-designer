/* Browser checks for editing a text: the font preview with the arrow keys (REQ-010) and the steps of the text size (REQ-011).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-textedit.js */
const { chromium } = require('playwright');
const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(600);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const o = PTD.random.opts; Object.keys(o).forEach(k => { if (/(Vary|Set)$/.test(k)) o[k] = false; }); o.shape = false; });
  const setSel = (ids) => ev((ids) => { const s = PTD.core.state(), u = PTD.core.ui; s.selected = ids[0] || null; u.extra = {}; ids.slice(1).forEach(k => { u.extra[k] = true; }); ids.forEach(k => { u.open[k] = true; }); PTD.core.setTab('artwork'); PTD.core.renderPanels(); PTD.core.renderStage(); }, ids);
  const fontOf = (id) => ev((id) => PTD.core.getLayer(id).font, id);
  const sizeOf = (id) => ev((id) => PTD.core.getLayer(id).size, id);
  const menuOpen = () => ev(() => !document.getElementById('fontMenu').hidden);
  const actFont = () => ev(() => { const a = document.querySelector('#fontMenu .opt.act'); return a ? a.dataset.font : null; });
  const undoOff = () => ev(() => document.getElementById('undoBtn').disabled);
  const FONT = (id) => '[data-scope="layer:' + id + '"][data-key="font"]';
  const SIZE = (id) => '[data-scope="layer:' + id + '"][data-key="size"][type="number"]';
  const RANGE = (id) => '[data-scope="layer:' + id + '"][data-key="size"][type="range"]';
  const settle = () => p.waitForTimeout(1300);   /* saves with the same tag within 1.2 s merge into one undo step */

  // ---- REQ-010: font preview
  await ev(() => { const L = PTD.core.state().layers; L[0].font = 'Playfair Display'; L[1].font = 'Cinzel'; L[2].font = 'Cormorant Garamond'; PTD.core.renderStage(); PTD.core.save(); });
  await setSel(['l1']);
  const orig = await fontOf('l1');
  const undo0 = await undoOff();
  await p.click(FONT('l1'));
  ok(await menuOpen(), 'a click on the font field opens the list');
  ok(await ev(() => document.querySelectorAll('#fontMenu .hint').length === 1 && /Esc/.test(document.querySelector('#fontMenu .hint').textContent) && /arrow/i.test(document.querySelector('#fontMenu .hint').textContent)), 'the list shows the hint about the arrows, Enter and Esc');
  ok(/arrow/i.test(await ev(() => document.querySelector('[data-scope="layer:l1"][data-key="font"]').title)), 'the font field tooltip mentions the arrows');
  await p.hover('#fontMenu .opt:nth-child(6)');
  ok(await fontOf('l1') === orig, 'pointing at a row (hover) changes nothing');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  const shown = await actFont();
  ok(shown && shown !== orig && await fontOf('l1') === shown, 'the arrow keys put the highlighted font on the text at once');
  ok(await ev(() => document.querySelector('[data-scope="layer:l1"][data-key="font"]').value) === shown, 'the field shows the name of the previewed font');
  ok(await undoOff() === undo0, 'previewing adds no undo step');
  await p.keyboard.press('ArrowUp');
  ok(await fontOf('l1') === await actFont() && await fontOf('l1') !== shown, 'ArrowUp moves the preview back one row');
  await p.keyboard.press('Escape');
  ok(await fontOf('l1') === orig, 'Esc puts the original font back');
  ok(!(await menuOpen()), 'Esc closes the list (and with it the hint)');
  ok(await ev(() => document.querySelector('[data-scope="layer:l1"][data-key="font"]').value) === orig, 'the field shows the original name again');
  ok(await undoOff() === undo0, 'Esc leaves no undo step');

  // Enter keeps the font as one undo step
  await settle();
  await p.click(FONT('l1'));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  const chosen = await actFont();
  await p.keyboard.press('Enter');
  ok(await fontOf('l1') === chosen && chosen !== orig, 'Enter keeps the shown font');
  ok(!(await menuOpen()), 'Enter closes the list');
  await p.keyboard.press('Escape');
  ok(await fontOf('l1') === chosen, 'Esc after Enter changes nothing');
  await p.click('#undoBtn');
  ok(await fontOf('l1') === orig, 'one Undo brings back the font from before the whole preview');

  // a click somewhere else keeps the font, and the undo step belongs to the texts that were selected
  await settle();
  await p.click(FONT('l1'));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  const chosen2 = await actFont();
  await p.mouse.click(5, 5);
  ok(await fontOf('l1') === chosen2 && !(await menuOpen()), 'a click elsewhere keeps the shown font and closes the list');
  await p.click('#undoBtn');
  ok(await fontOf('l1') === orig, 'Undo takes back a font that a click elsewhere took into use');

  // a click on the stage (another place, which changes the selection) commits to the text that was selected
  await settle();
  await setSel(['l1']);
  await p.click(FONT('l1'));
  await p.keyboard.press('ArrowDown');
  const chosen3 = await actFont();
  const r = await ev(() => { const q = document.getElementById('stage').getBoundingClientRect(); return { x: q.left + 15, y: q.top + 15 }; });
  await p.mouse.click(r.x, r.y);
  ok(await fontOf('l1') === chosen3, 'a click on the stage keeps the font on the text that was selected');
  ok(await fontOf('l2') === 'Cinzel' && await fontOf('l3') === 'Cormorant Garamond', 'other texts keep their fonts');
  await p.click('#undoBtn');

  // several things selected: only the texts change, each goes back to its own font on Esc
  await settle();
  await ev(() => { const L = PTD.core.state().layers; L[0].font = 'Playfair Display'; L[1].font = 'Cinzel'; PTD.core.renderStage(); PTD.core.save(); });
  await setSel(['l1', 'l2', 'band']);
  const bandBefore = await ev(() => JSON.stringify(PTD.core.state().band));
  await p.click(FONT('l1'));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  const multi = await actFont();
  ok(await fontOf('l1') === multi && await fontOf('l2') === multi, 'with several texts selected the preview changes all of them');
  ok(await fontOf('l3') === 'Cormorant Garamond', 'a text that is not selected is not changed');
  ok(await ev(() => JSON.stringify(PTD.core.state().band)) === bandBefore, 'the selected lines and cards are not changed');
  await p.keyboard.press('Escape');
  ok(await fontOf('l1') === 'Playfair Display' && await fontOf('l2') === 'Cinzel', 'Esc gives every text its own font back');
  await p.mouse.click(5, 5);

  // typing a filter and then the arrows
  await settle();
  await setSel(['l1']);
  await p.click(FONT('l1'));
  await p.fill(FONT('l1'), 'ro');
  const filtered = await ev(() => Array.from(document.querySelectorAll('#fontMenu .opt')).map(o => o.dataset.font));
  ok(filtered.length > 0 && filtered.every(n => /ro/i.test(n)), 'typing filters the list');
  await p.keyboard.press('ArrowDown');
  ok(/ro/i.test(await fontOf('l1')) && await fontOf('l1') === await actFont(), 'the arrows preview the filtered fonts');
  await p.keyboard.press('Escape');
  ok(await fontOf('l1') === 'Playfair Display', 'Esc brings the original back after a filter too');
  await p.mouse.click(5, 5);

  // the second Esc is the normal Esc again (it ends a tool)
  await p.click(FONT('l1'));
  await p.keyboard.press('Escape');
  await ev(() => PTD.core.setTool('measure'));
  await p.focus(FONT('l1')); await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  ok(await ev(() => PTD.core.ui.tool) !== 'measure', 'after the list is closed Esc works as before and ends the tool');
  await p.mouse.click(5, 5);

  // ---- REQ-011: steps of the text size
  await setSel(['l1']);
  await ev(() => { PTD.core.getLayer('l1').size = 100; PTD.core.renderPanels(); PTD.core.renderStage(); });
  ok(await p.getAttribute(SIZE('l1'), 'step') === '0.5' && await p.getAttribute(SIZE('l1'), 'data-scrub') === '1' && await p.getAttribute(RANGE('l1'), 'step') === '1', 'size: arrows 0.5, drag 1, slider 1');
  await p.focus(SIZE('l1'));
  await p.keyboard.press('ArrowUp');
  ok(await sizeOf('l1') === 100.5, 'the arrow up of the number field adds 0.5 mm');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  ok(await sizeOf('l1') === 99.5, 'the arrow down takes 0.5 mm off');
  await p.fill(RANGE('l1'), '60');
  ok(await sizeOf('l1') === 60, 'the slider sets whole millimetres');
  await ev(() => { PTD.core.getLayer('l1').size = 100; PTD.core.renderPanels(); });
  let box = await p.locator(SIZE('l1')).boundingBox();
  await p.mouse.move(box.x + 10, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + 22, box.y + box.height / 2, { steps: 4 }); await p.mouse.up();
  ok(await sizeOf('l1') === 112, 'dragging sideways over the number changes it 1 mm per pixel (12 px, 12 mm)');
  await ev(() => { PTD.core.getLayer('l1').size = 100.5; PTD.core.renderPanels(); });
  box = await p.locator(SIZE('l1')).boundingBox();
  await p.mouse.move(box.x + 10, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + 17, box.y + box.height / 2, { steps: 3 }); await p.mouse.up();
  ok(await sizeOf('l1') === 107.5, 'a drag from a size with half a millimetre keeps the half (100.5 plus 7 is 107.5)');
  ok(/0\.5/.test(await ev(() => document.querySelector('[data-scope="layer:l1"][data-key="size"]').title)), 'the size tooltip names the steps' + ' (size now ' + await sizeOf('l1') + ')');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
