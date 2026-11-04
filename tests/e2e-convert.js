/* Browser checks for the convert buttons between stadium, rectangle and circle tables.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-convert.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(800);
  const ev = (f, a) => p.evaluate(f, a);
  await p.click('#tabs button[data-tab="tables"]'); await p.click('[data-act="tselect"]');
  const shape = () => ev(() => { const t = PTD.tables.get('t1'), g = PTD.tables.geo(t); return { type: t.preset && t.preset.type, w: t.preset && t.preset.w, h: t.preset && t.preset.h, r: t.preset && t.preset.r, area: Math.round(g.area), per: Math.round(g.perimeter), bw: Math.round(g.bbox.w), bh: Math.round(g.bbox.h) }; });
  const btn = (to) => `[data-act="tconvert"][data-to="${to}"]`;
  const same = (a, c) => Math.abs(a.area - c.area) <= a.area * 1e-4 && Math.abs(a.per - c.per) <= 3 && a.bw === c.bw && a.bh === c.bh;

  // ---- stadium
  const s0 = await shape();
  ok(s0.type === 'stadium' && await p.isVisible(btn('rect')) && await p.isVisible(btn('circle')), 'a stadium offers Convert to rectangle and Convert to circle');
  ok(!(await p.isDisabled(btn('rect'))), 'Convert to rectangle is always available');
  ok(await p.isDisabled(btn('circle')), 'Convert to circle is greyed out while width and height differ');
  ok(/must be equal/.test(await p.textContent('.convwhy')) && /1200/.test(await p.textContent('.convwhy')), 'and the reason says what to change: ' + (await p.textContent('.convwhy')).trim());
  await p.click(btn('rect'));
  const s1 = await shape();
  ok(s1.type === 'rect' && s1.r === 600 && same(s0, s1), 'a stadium becomes a rectangle with corner radius 600 and the very same outline');
  ok(!(await p.isVisible(btn('circle'))), 'a rectangle has no circle button');

  // ---- rectangle
  await p.fill('[data-scope="preset:t1"][data-key="r"]', '150');
  ok(await p.isDisabled(btn('stadium')) && /Increase the corner radius to 600/.test(await p.textContent('.convwhy')), 'Convert to stadium is greyed out with small corners and says to increase the radius to 600: ' + (await p.textContent('.convwhy')).trim());
  await p.fill('[data-scope="preset:t1"][data-key="r"]', '600');
  ok(!(await p.isDisabled(btn('stadium'))), 'it becomes available when the corners meet');
  await p.click(btn('stadium'));
  const s2 = await shape();
  ok(s2.type === 'stadium' && same(s0, s2), 'and the rectangle becomes the same stadium again');
  await p.click(btn('rect')); await p.fill('[data-scope="preset:t1"][data-key="h"]', '3000');
  ok(await p.isDisabled(btn('stadium')), 'a rectangle made taller than wide with the old radius is not a stadium (needs half of the shorter side)');
  await p.fill('[data-scope="preset:t1"][data-key="r"]', '1200');
  ok(!(await p.isDisabled(btn('stadium'))), 'with radius 1200 it is a stadium whose ends are top and bottom');
  await p.click(btn('stadium')); const sv = await shape(); ok(sv.type === 'stadium' && sv.bw === 2400 && sv.bh === 3000, 'a tall rectangle converts to a stadium with the same size');
  await p.fill('[data-scope="preset:t1"][data-key="h"]', '1200');

  // ---- circle
  await p.fill('[data-scope="preset:t1"][data-key="h"]', '2400');
  ok(!(await p.isDisabled(btn('circle'))), 'Convert to circle is available when width equals height');
  const sq = await shape();
  await p.click(btn('circle'));
  const c1 = await shape();
  ok(c1.type === 'circle' && c1.w === 2400 && c1.h === 2400 && same(sq, c1), 'a squeezed stadium becomes a circle of the same size and outline');
  ok(await p.isVisible(btn('stadium')) && !(await p.isDisabled(btn('stadium'))), 'a circle offers Convert to stadium');
  await p.click(btn('stadium'));
  const c2 = await shape(); ok(c2.type === 'stadium' && same(sq, c2), 'and it converts back to the same outline');
  await ev(() => { const t = PTD.tables.get('t1'); t.preset.notch.on = true; PTD.tables.regen(t); PTD.core.renderPanels(); });
  ok(await p.isDisabled(btn('circle')) && /notch/.test(await p.textContent('.convwhy')), 'a dealer notch blocks the circle conversion and the reason says so');
  await ev(() => { const t = PTD.tables.get('t1'); t.preset.notch.on = false; PTD.tables.regen(t); PTD.core.renderPanels(); });

  // ---- undo, octagon, free outline
  await p.click(btn('circle'));
  ok((await shape()).type === 'circle', 'converted to a circle');
  await p.click('#undoBtn'); await p.waitForTimeout(200);
  ok((await shape()).type === 'stadium', 'Undo takes the conversion back in one step');
  await ev(() => { const t = PTD.tables.get('t1'); t.preset = PTD.tables.defaultPreset('octagon'); PTD.tables.regen(t); PTD.core.renderPanels(); });
  ok((await p.locator('[data-act="tconvert"]').count()) === 0, 'an octagon has no convert buttons');
  await ev(() => { const t = PTD.tables.get('t1'); PTD.tables.detach(t); PTD.core.renderPanels(); });
  ok((await p.locator('[data-act="tconvert"]').count()) === 0, 'a free outline has no convert buttons');

  // table summary under the status bar
  const sm = await p.evaluate(() => { const t = PTD.core.state().tables[0]; t.preset = PTD.tables.defaultPreset('circle'); t.preset.w = t.preset.h = 1000; PTD.tables.regen(t); PTD.core.renderStage(); const a = document.getElementById('tableSummary').textContent;
    t.preset = PTD.tables.defaultPreset('rect'); t.preset.w = 2000; t.preset.h = 900; t.preset.r = 120; PTD.tables.regen(t); PTD.core.renderStage(); return [a, document.getElementById('tableSummary').textContent]; });
  ok(/circle, diameter/.test(sm[0]) && /1000/.test(sm[0]) && !/height/.test(sm[0]), 'the summary shows only the diameter of a round table');
  ok(/rect, width.*2000.*height.*900.*corner radius.*120/.test(sm[1]), 'the summary shows width, height and corner radius of a rectangle');
  ok(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
