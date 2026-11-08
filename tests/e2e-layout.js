/* Browser checks for panes and splitters (REQ-054). Run: NODE_PATH=$(npm root -g) node tests/e2e-layout.js */
const { chromium } = require('playwright');
const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const root = path.resolve(__dirname, '..');
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a); const wait = (ms) => p.waitForTimeout(ms || 250);
  const url = 'file://' + path.join(root, 'index.html');
  await p.goto(url); await ev(() => { localStorage.clear(); }); await p.goto(url); await wait(600);
  const sz = () => ev(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { stage: r('stageWrap').width, side: r('controls').width, sh: r('stageWrap').height, dock: document.getElementById('graphDock').hidden ? 0 : r('graphDock').height }; });
  const d0 = await sz();
  ok(Math.abs(d0.side - 430) < 8, 'the default side panel is as wide as before (' + d0.side.toFixed(0) + ')');
  // drag the splitter left: the panel grows and the stage shrinks
  const vb = await ev(() => { const r = document.getElementById('vSplit').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 200 }; });
  await p.mouse.move(vb.x, vb.y); await p.mouse.down(); await p.mouse.move(vb.x - 120, vb.y, { steps: 5 });
  const mid = await sz(); ok(mid.side > d0.side + 100 && mid.stage < d0.stage - 100, 'dragging the splitter widens the panel (' + mid.side.toFixed(0) + ')');
  await p.keyboard.press('Escape'); await wait();
  const esc = await sz(); ok(Math.abs(esc.side - d0.side) < 3, 'Esc during the drag puts it back');
  await p.mouse.up();
  await p.mouse.move(vb.x, vb.y); await p.mouse.down(); await p.mouse.move(vb.x - 120, vb.y, { steps: 5 }); await p.mouse.up(); await wait();
  const d1 = await sz(); ok(d1.side > d0.side + 100, 'a drag to the end keeps the new width');
  ok(await ev(() => PTD.core.cfg().layout.sideW > 500), 'the width is in the settings');
  // stage refits: the svg viewBox follows its size
  ok(await ev(() => { const s = document.getElementById('stageWrap').getBoundingClientRect(); const v = document.getElementById('stage').viewBox.baseVal; return v.width > 0 && Math.abs(v.width / v.height - s.width / s.height) < 0.05; }), 'the stage view follows its new size');
  // keyboard
  await ev(() => document.getElementById('vSplit').focus()); await p.keyboard.press('ArrowRight'); await wait(100);
  const d2 = await sz(); ok(d2.side < d1.side - 15, 'ArrowRight makes the panel narrower');
  await p.keyboard.press('Enter'); await wait(100);
  const d3 = await sz(); ok(Math.abs(d3.side - 430) < 8, 'Enter resets the width');
  // fold
  await p.click('#sideToggle'); await wait(300);
  ok((await sz()).side < 5, 'the fold button hides the side panel'); await p.click('#sideToggle'); await wait(300);
  ok((await sz()).side > 300, 'and brings it back');
  // dock
  await ev(() => { PTD.layout.dock.want = () => window.__want === true; });
  await ev(() => { window.__want = true; PTD.core.renderPanels(); }); await wait(300);
  const dk = await sz(); ok(dk.dock > 250 && dk.sh < d0.sh - 200, 'the dock opens under the stage when it is wanted (' + dk.dock.toFixed(0) + ')');
  const hb = await ev(() => { const r = document.getElementById('hSplit').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(hb.x, hb.y); await p.mouse.down(); await p.mouse.move(hb.x, hb.y - 80, { steps: 4 }); await p.mouse.up(); await wait(200);
  ok((await sz()).dock > dk.dock + 60, 'dragging the horizontal splitter up makes the dock taller');
  await p.click('#dockMax'); await wait(250); ok(await ev(() => document.getElementById('stageWrap').getBoundingClientRect().height === 0), 'maximise gives the whole area to the dock');
  await p.click('#dockMax'); await wait(250);
  await p.click('#dockClose'); await wait(250); ok((await sz()).dock === 0, 'the close button closes it');
  await ev(() => PTD.core.renderPanels()); await wait(150); ok((await sz()).dock === 0, 'it stays closed while the want does not change');
  await ev(() => { window.__want = false; PTD.core.renderPanels(); window.__want = true; PTD.core.renderPanels(); }); await wait(250);
  ok((await sz()).dock > 100, 'it opens again after the want went away and came back');
  await ev(() => { window.__want = false; PTD.core.renderPanels(); }); await wait(250); ok((await sz()).dock === 0, 'it closes when it is no longer wanted');
  // reset and persistence
  await ev(() => document.querySelector('[data-lay=reset]').click()); await wait(200); ok(Math.abs((await sz()).side - 430) < 8, 'Reset layout restores the sizes');
  await ev(() => { PTD.core.cfg().layout.sideW = 600; PTD.core.saveConfig(); }); await wait(500); await p.reload(); await wait(700);
  ok(Math.abs((await sz()).side - 600) < 8, 'the layout survives a reload');
  ok(await ev(() => JSON.parse(JSON.stringify(PTD.core.cfg())).layout.sideW === 600), 'it is a key of the settings');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
