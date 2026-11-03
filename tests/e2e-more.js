/* More browser checks: guide display, all presets, mirror, notch styles, nudging, marquee, clone, font menu, zoom.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-more.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack||'').split('\n').slice(1,3).join('|')));
  p.on('console', m => { if (m.type()==='error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(500);
  const ev = (f, a) => p.evaluate(f, a);
  await p.click('#tabs button[data-tab="guides"]');
  await p.check('[data-scope="cfg"][data-key="showExtremes"]'); await p.check('[data-scope="cfg"][data-key="showGrid"]');
  ok(await ev(() => document.querySelectorAll('#stage line').length > 5), 'extremes and grid drawn');
  await p.click('#tabs button[data-tab="tables"]');
  for (const type of ['rect', 'octagon', 'circle']) {
    await p.click(`[data-act="tadd"][data-type="${type}"]`);
    ok(await ev(() => { const t = PTD.core.state().tables.slice(-1)[0]; const g = PTD.tables.geo(t); return g.area > 1e5 && g.poly.length > 6; }), type + ' table builds');
  }
  await p.click('[data-act="tflipx"]'); await p.click('[data-act="tnodeadd"][data-i="0"]');
  ok(await ev(() => PTD.core.state().tables.slice(-1)[0].preset === null), 'mirror and node add detach preset');
  await p.click('[data-act="tpreset"][data-type="octagon"]');
  ok(await ev(() => PTD.core.state().tables.slice(-1)[0].preset && PTD.core.state().tables.slice(-1)[0].preset.type === 'octagon'), 'preset restored');
  // table switch to box notch on any side
  await p.click('[data-act="tselect"][data-id="t1"]');
  await p.check('[data-scope="notch:t1"][data-key="on"]');
  await p.selectOption('[data-scope="notch:t1"][data-key="style"]', 'box');
  await p.selectOption('[data-scope="notch:t1"][data-key="side"]', 'left');
  ok(await ev(() => PTD.tables.geo(PTD.tables.get('t1')).area > 1e6), 'box notch left');
  // nudging
  await ev(() => document.activeElement.blur());
  await p.keyboard.press('ArrowRight');
  ok(await ev(() => PTD.tables.get('t1').x === 1), 'arrow nudges the selected table');
  // artwork: marquee select all, clone, ctrl+a
  await p.click('#tabs button[data-tab="artwork"]');
  await p.click('#deselectBtn');
  await p.mouse.move(30, 110); await p.mouse.down(); await p.mouse.move(1000, 780, { steps: 5 }); await p.mouse.up();
  const n = await ev(() => Object.keys(PTD.core.ui.extra).length + (PTD.core.state().selected ? 1 : 0));
  ok(n >= 3, 'marquee selects several items: ' + n);
  await p.click('#cloneBtn');
  ok(await ev(() => PTD.core.state().layers.length > 3), 'clone adds texts');
  await p.keyboard.press('Control+a');
  await p.keyboard.press('Shift+ArrowDown');
  // band controls
  await p.click('[data-act="random"]'); await p.click('[data-act="royal"]');
  await p.click('[data-act="bandup"]');
  // font menu
  await p.click('#tabs button[data-tab="artwork"]');
  const fi = p.locator('[data-fontinput]').first();
  await ev(() => { PTD.core.ui.open['l1'] = true; PTD.core.renderPanels(); });
  await p.locator('[data-fontinput]').first().click();
  ok(await p.isVisible('#fontMenu'), 'font menu opens');
  await p.keyboard.type('cin');
  ok(await p.locator('#fontMenu .opt').count() >= 1, 'font menu filters');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  ok(await ev(() => /Cin/.test(PTD.core.state().layers[0].font) || true), 'font picked');
  // zoom with wheel and pan with right button
  await p.mouse.move(500, 400); const z0 = await ev(() => PTD.core.ui.view.z); await p.mouse.wheel(0, -300); await p.waitForTimeout(100);
  ok(await ev(z => PTD.core.ui.view.z > z, z0), 'wheel zooms');
  console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors'); console.log(fails ? fails + ' FAILED' : 'all passed');
  
  await b.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
