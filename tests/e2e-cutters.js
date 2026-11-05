/* Browser checks for the Cutters tab, calibration entry, JSON window part "cutters", and the cut export that uses them
 * (scale, calibration correction, blade offset, filters, EPS, jobs).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-cutters.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t = 1e-3) => Math.abs(a - b) <= t;
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(1000);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { window.near = (a, b, t = 1e-3) => Math.abs(a - b) <= t; });
  const typeIn = (sel, v) => ev(([s, v]) => { const i = document.querySelector(s); i.focus(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); }, [sel, String(v)]);
  const click = (sel) => ev(s => document.querySelector(s).click(), sel);

  // ---- the tab and the list
  await ev(() => PTD.core.setTab('cutters'));
  ok(await ev(() => document.querySelector('#cuttersBtn') !== null && document.querySelector('#tabs [data-tab="cutters"]') === null && document.querySelector('#tabs [data-tab="settings"]') === null && document.getElementById('cuttersPane').textContent.includes('Calibration')), 'the Cutters and Settings buttons are in the toolbar, not in the tab row');
  ok(await ev(() => PTD.cutters.list().length === 1 && PTD.cutters.list()[0].widthMm === 500 && PTD.cutters.list()[0].thinMm === 0), 'one default cutter, 500 mm wide, thinnest detail 0 (no check)');
  ok(await ev(() => !/Calibration images/.test(document.getElementById('settingsPane').innerText) && /Cutters button/.test(document.getElementById('settingsPane').innerText)), 'the Settings pane points to the Cutters button and has no calibration');
  ok(await ev(() => PTD.core.cfg().pressMm === 380), 'the heat press area defaults to 380 mm');
  await click('[data-act="cutadd"]'); await click('[data-act="cutadd"]');
  ok(await ev(() => PTD.cutters.list().length === 3), 'Add cutter adds cutters');
  await ev(() => { const l = PTD.cutters.list(); l[1].name = 'Second'; l[2].name = 'Third'; PTD.core.renderPanels(); });
  await ev(() => document.querySelector('[data-act="cutdown"][data-id="' + PTD.cutters.list()[0].id + '"]').click());
  ok(await ev(() => PTD.cutters.list().map(c => c.name).join() === 'Second,Cutter 1,Third'), 'Move down changes the order');
  await ev(() => document.querySelector('[data-act="cutup"][data-id="' + PTD.cutters.list()[2].id + '"]').click());
  ok(await ev(() => PTD.cutters.list().map(c => c.name).join() === 'Second,Third,Cutter 1'), 'Move up changes the order');
  await ev(() => document.querySelector('[data-act="cutdup"][data-id="' + PTD.cutters.list()[0].id + '"]').click());
  ok(await ev(() => PTD.cutters.list().length === 4 && PTD.cutters.list()[1].name === 'Second copy'), 'Duplicate makes a copy next to the original');
  const delSel = () => '[data-act="cutdel"][data-id="' + PTD_ID + '"]'; let PTD_ID = await ev(() => PTD.cutters.list()[1].id);
  await click(delSel());
  ok(await ev(() => PTD.cutters.list().length === 4), 'the first click on delete only arms it (no dialog)');
  await click(delSel());
  ok(await ev(() => PTD.cutters.list().length === 3 && !PTD.cutters.list().some(c => c.name === 'Second copy')), 'the second click deletes');
  await typeIn('[data-scope^="cutter:"][data-key="name"]', 'Roland');
  ok(await ev(() => PTD.cutters.list().some(c => c.name === 'Roland')), 'the name field edits the selected cutter');
  await typeIn('[data-scope^="cutter:"][data-key="widthMm"]', '600');
  ok(await ev(() => PTD.cutters.list().some(c => c.widthMm === 600)), 'the width field edits the cutter');

  // ---- JSON window part and kind detection
  const kinds = await ev(() => ({ a: PTD.core.kindOf(PTD.cutters.toJSON()), b: PTD.core.kindOf({ name: 'X', widthMm: 400 }), c: PTD.core.kindOf(PTD.core.toPartJSON('settings')) }));
  ok(kinds.a === 'cutters' && kinds.b === 'cutters' && kinds.c === 'settings', 'kindOf finds cutters from the keys and keeps settings apart: ' + JSON.stringify(kinds));
  await ev(() => PTD.jsonbox.open('cutters'));
  const txt = await ev(() => document.getElementById('jsonText').value);
  ok(/poker-table-designer-cutters/.test(txt) && JSON.parse(txt).cutters.length === 3, 'the JSON window shows the cutter list');
  const pasted = JSON.parse(txt); pasted.cutters = pasted.cutters.slice(0, 2); pasted.cutters[0].name = 'Pasted one';
  await ev(t => { document.getElementById('jsonText').value = t; document.querySelector('#jsonDlg [data-j="apply"]').click(); }, JSON.stringify(pasted));
  ok(await ev(() => PTD.cutters.list().length === 2 && PTD.cutters.list()[0].name === 'Pasted one'), 'Apply in the cutters window replaces the list (round trip)');
  await ev(() => { document.getElementById('jsonText').value = JSON.stringify({ name: 'Single', widthMm: 420, maxLengthMm: 1500 }); document.querySelector('#jsonDlg [data-j="ok"]').click(); });
  ok(await ev(() => PTD.cutters.list().length === 3 && PTD.cutters.list().some(c => c.name === 'Single' && c.widthMm === 420)), 'a single cutter pasted is added');
  ok(await ev(() => { const r = PTD.core.loadText(JSON.stringify(PTD.cutters.toJSON())); return r.ok; }), 'a cutter list pasted in the general paste place is loaded as cutters');
  ok(await ev(() => { PTD.jsonbox.open('cutters'); const o = PTD.jsonbox.apply(); PTD.jsonbox.close(); return o; }), 'Apply of the unchanged text is accepted');
  await ev(() => { const c = PTD.cutters.list(); const a = c.filter(x => x.name === 'Pasted one')[0]; PTD.core.cfg().cutters = [a]; PTD.core.renderPanels(); });
  ok(await ev(() => PTD.cutters.list().length === 1), 'back to one cutter');

  // ---- calibration entry: detailed method
  const c0 = () => ev(() => PTD.cutters.list()[0].id);
  await ev(() => { PTD.cutters.list()[0].widthMm = 500; PTD.core.renderPanels(); });
  ok(await ev(() => document.querySelectorAll('[data-tbl="x"] tbody tr').length === 3 && document.querySelectorAll('[data-tbl="y"] tbody tr').length === 3), 'three strips by default in each direction');
  ok(await ev(() => JSON.stringify(PTD.cutters.list()[0].calib.x.lengths) === '[100,250,480]' && JSON.stringify(PTD.cutters.list()[0].calib.y.lengths) === '[100,250,480]'), 'default lengths 100, 250, 480');
  let eff = await ev(() => PTD.cutters.effective());
  ok(eff.fx === 1 && eff.fy === 1 && eff.kerf === 0, 'no measurements: no correction (factor 1, kerf 0)');
  // a cutter that cuts 0.2 % small with a blade offset of 0.1 mm per edge: outer = a*L + 2d, span = a*S, block = 10a + 2d, gap = 10a - 2d
  const a = 0.998, d = 0.1;
  const rowsFor = (lens) => lens.map(L => { const S = 20 * Math.floor((L - 10) / 20); return { outer: a * L + 2 * d, span: a * S, block: a * 10 + 2 * d, gap: a * 10 - 2 * d }; });
  for (const dir of ['x', 'y']) {
    const rows = rowsFor([100, 250, 480]);
    for (let i = 0; i < 3; i++) for (const f of ['outer', 'span', 'block', 'gap']) await typeIn(`[data-cr="${dir}:${i}:${f}"]`, rows[i][f].toFixed(4));
  }
  eff = await ev(() => PTD.cutters.effective());
  ok(near(eff.fx, 1 / a, 2e-4) && near(eff.fy, 1 / a, 2e-4), 'the factor is worked out from the numbers: ' + eff.fx.toFixed(5));
  ok(near(eff.kerf, d, 2e-3), 'the blade offset is worked out: ' + eff.kerf.toFixed(4));
  ok(await ev(() => /Used by the exports: X factor 1\.002/.test(document.querySelector('[data-ro="sum"]').textContent)), 'the summary line shows the numbers used');
  ok(await ev(() => document.querySelector('[data-re="x:2:outer"]').textContent.includes('mm')), 'the error of each number is shown');
  // the three forms of the factor
  await typeIn('[data-cf="x:percent"]', '0.5');
  eff = await ev(() => PTD.cutters.effective());
  ok(near(eff.fx, 1.005, 1e-9) && eff.manualX, 'typing percent sets the factor by hand');
  ok(await ev(() => near(Number(document.querySelector('[data-cf="x:factor"]').value), 1.005, 1e-6) && near(Number(document.querySelector('[data-cf="x:mm"]').value), 2.4, 0.01) ? true : false), 'factor, percent and millimetres (over the longest strip) agree');
  await typeIn('[data-cf="x:mm"]', '-0.96');
  eff = await ev(() => PTD.cutters.effective());
  ok(near(eff.fx, 1 - 0.96 / 480, 1e-9), 'typing millimetres over the longest strip sets the factor');
  await typeIn('[data-cf="kerf"]', '0.25');
  ok(near((await ev(() => PTD.cutters.effective())).kerf, 0.25), 'the blade offset can be typed');
  await click('[data-act="calauto"]');
  eff = await ev(() => PTD.cutters.effective());
  ok(near(eff.fx, 1 / a, 2e-4) && !eff.manualX && near(eff.kerf, d, 2e-3), '“Use the measurements” drops the typed values');
  // simple method
  await ev(() => { const c = PTD.cutters.list()[0]; c.calib.x.mode = 'simple'; c.calib.x.use = 2; PTD.core.saveConfig(); PTD.core.renderPanels(); });
  ok(await ev(() => document.querySelectorAll('[data-tbl="x"] thead th').length === 4), 'simple method shows one measurement column plus a Use column');
  eff = await ev(() => PTD.cutters.effective());
  ok(near(eff.fitX.a, (a * 480 + 2 * d) / 480, 1e-9) && eff.fitX.d === 0, 'simple method: only the chosen overall length, no blade offset');
  await click('[data-act="calreset"]');
  eff = await ev(() => PTD.cutters.effective());
  ok(eff.fx === 1 && eff.fy === 1 && eff.kerf === 0, 'Clear all measurements gives back factor 1');
  // number of strips
  await ev(() => { const s = document.querySelector('[data-cm="count"]'); s.value = '5'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  ok(await ev(() => PTD.cutters.list()[0].calib.x.lengths.length === 5 && document.querySelectorAll('[data-tbl="y"] tbody tr').length === 5), 'the number of strips is shared by both directions');
  // lengths are limited
  await typeIn('[data-cr="x:0:len"]', '900');
  ok(await ev(() => document.getElementById('cutMsg').textContent.includes('between')), 'a strip longer than the cutting width gives a message');

  // ---- strips in the zip files
  const files = await ev(async () => { const f = await PTD.calibration.build(PTD.cutters.list()[0]); return f.map(x => x.name); });
  ok(files.length === 14, 'the calibration zip still has 14 files');
  const geom = await ev(() => { const c = JSON.parse(JSON.stringify(PTD.cutters.list()[0])); c.calib.x.lengths = [100, 250, 400, 450, 480]; c.calib.y.lengths = [100, 250, 400, 450, 480]; const K = PTD.calibration, h = K.combine('horizontal', [100, 250, 480]), v = K.combine('vertical', [100, 250, 480]); return { h: [h.w, h.h], v: [v.w, v.h] }; });
  ok(geom.h[0] === 480 && geom.h[1] === 3 * 20 + 2 * 20, 'horizontal strips are stacked with a 20 mm gap: ' + geom.h);
  ok(geom.v[1] === 480 && geom.v[0] === 3 * 20 + 2 * 20, 'vertical strips stand side by side: ' + geom.v);

  // ---- guide window and PDF
  await click('[data-act="calguide"]');
  ok(await ev(() => !document.getElementById('modal').hidden && document.querySelector('#modalBody svg text') !== null && document.querySelectorAll('#modalBody [data-tbl]').length === 2 && /Not to scale/.test(document.getElementById('modalBody').innerText)), 'the measuring guide window shows the drawing and both tables');
  ok(await ev(() => document.querySelectorAll('#modalBody svg text').length >= 4), 'the drawing has the numbered arrows');
  await typeIn('#modalBody [data-cr="x:0:outer"]', '100.5');
  ok(await ev(() => document.querySelector('#cuttersPane [data-cr="x:0:outer"]').value === '100.5'), 'a number typed in the window reaches the tab');
  await ev(() => document.querySelector('#modal [data-sheet="close"]').click());
  const pdf = await ev(() => PTD.cutters.pdf(PTD.cutters.list()[0]));
  ok(/^%PDF-1\.4/.test(pdf) && /%%EOF\s*$/.test(pdf) && /Not to scale|NOT TO SCALE/.test(pdf), 'the measuring guide PDF is made');
  await click('[data-act="calreset"]');

  // ---- project reference and copy
  await ev(() => { PTD.core.state().export.cutter = 'Pasted one'; PTD.core.save(); });
  const pj = await ev(() => PTD.core.toJSON(true));
  ok(pj.cutter === undefined && pj.export.cutter === 'Pasted one', 'the project names its cutter and does not carry a copy');
  const notAdopted = await ev(() => { const o = JSON.parse(JSON.stringify(PTD.core.toJSON(true))); o.cutter = { name: 'Brand new', widthMm: 333 }; o.export.cutter = 'Brand new'; PTD.core.loadText(JSON.stringify(o)); return !PTD.cutters.list().some(c => c.name === 'Brand new') && PTD.cutters.current() === PTD.cutters.list()[0]; });
  ok(notAdopted, 'a project naming an unknown cutter does not add it; the first cutter is used');
  await ev(() => { PTD.core.renderPanels(); });
  ok(await ev(() => /not in the list/.test(document.querySelector('[data-scope="xp"][data-key="cutter"]').innerHTML)), 'the Export tab says the named cutter is not in the list');
  // toolbar buttons toggle and go back
  await p.click('#tabs button[data-tab="tables"]'); await p.click('#cuttersBtn');
  ok(await ev(() => PTD.core.ui.tab === 'cutters' && document.getElementById('cuttersBtn').classList.contains('on')), 'the Cutters button opens the cutter pane');
  await p.click('#cuttersBtn');
  ok(await ev(() => PTD.core.ui.tab === 'tables' && !document.getElementById('cuttersBtn').classList.contains('on')), 'a second click goes back to the tab before');

  // ---- export: base numbers (Paper.js is not available offline, so booleans are not exercised)
  await ev(() => { const st = PTD.core.state(); st.export.cutter = ''; PTD.core.save(); });
  const flat = async (extra) => ev(async (e) => { const o = Object.assign({}, PTD.core.state().export, e || {}); const r = await PTD.exporter.buildCut(o); return { w: r.total.w, h: r.total.h, strips: r.strips.length, warn: r.warnings, n: Object.values(r.strips[0].colours).reduce((s, rr) => s + rr.length, 0), minY: Math.min(...Object.values(r.strips[0].colours).flat().flat().map(p => p[1])) }; }, extra);
  let r0 = await flat();
  ok(near(r0.w, 380 + 6 - 0, 0.01) || r0.w > 380, 'the plain cut is the two card lines with their outline: ' + r0.w.toFixed(2) + ' × ' + r0.h.toFixed(2));
  const W0 = r0.w, H0 = r0.h;
  let r1 = await flat({ scaleX: 0.5, scaleY: 0.5 });
  ok(near(r1.w, W0 * 0.5, 0.02) && near(r1.h, H0 * 0.5, 0.02), 'scale 50 %: ' + r1.w.toFixed(2) + ' × ' + r1.h.toFixed(2));
  let r2 = await flat({ scaleX: 0.5, scaleY: 1 });
  ok(near(r2.w, W0 * 0.5, 0.02) && near(r2.h, H0, 0.02), 'X and Y scale separately');
  // calibration correction: fx 1.01 by hand through the cutter
  await ev(() => { const c = PTD.cutters.list()[0]; c.calib.x.override = 1.01; c.calib.y.override = 0.99; PTD.core.saveConfig(); });
  let r3 = await flat();
  ok(near(r3.w, W0 * 1.01, 0.02) && near(r3.h, H0 * 0.99, 0.02), 'the calibration correction scales X and Y: ' + r3.w.toFixed(2) + ' × ' + r3.h.toFixed(2));
  let r4 = await flat({ useCalib: false });
  ok(near(r4.w, W0, 0.02), 'the correction can be switched off in the export');
  let r5 = await flat({ useCalib: true, rotate: 90 });
  ok(near(r5.w, H0 * 1.01, 0.02) && near(r5.h, W0 * 0.99, 0.02), 'the correction follows the cutter axes after rotating: ' + r5.w.toFixed(2));
  await ev(() => { const c = PTD.cutters.list()[0]; c.calib.x.override = null; c.calib.y.override = null; PTD.core.saveConfig(); });

  // ---- filters
  ok((await flat()).n === 2, 'default: two card lines are output');
  ok((await flat({ upper: false })).n === 1, 'upper line off: one line');
  let nothing = await ev(async () => { try { await PTD.exporter.buildCut(Object.assign({}, PTD.core.state().export, { upper: false, lower: false })); return ''; } catch (e) { return e.message; } });
  ok(/nothing to cut/i.test(nothing), 'everything filtered out: a clear message');
  const k0 = await flat({ upper: false }), k1 = await flat({ upper: false, keepPos: true });
  ok(near(k1.minY - k0.minY, 100, 0.5), 'keep position: the lower line keeps its place relative to the whole design (' + k0.minY.toFixed(1) + ' vs ' + k1.minY.toFixed(1) + ')');
  await ev(() => { const st = PTD.core.state(); st.selected = 'l1'; });
  nothing = await ev(async () => { try { await PTD.exporter.buildCut(Object.assign({}, PTD.core.state().export, { sel: true })); return ''; } catch (e) { return e.message; } });
  ok(/nothing to cut/i.test(nothing), 'only selected: a text is selected, the lines are not output');
  await ev(() => { PTD.core.state().selected = 'band'; });
  ok((await flat({ sel: true })).n === 2, 'only selected: the card lines are selected and output');

  // ---- warnings: width, length, thin details
  await ev(() => { PTD.cutters.list()[0].widthMm = 300; PTD.cutters.list()[0].maxLengthMm = 50; });
  let w1 = await flat();
  ok(w1.warn.some(x => /wider than the cutting width/.test(x)) && w1.warn.some(x => /longer than the longest cut/.test(x)), 'warnings for a design wider and longer than the cutter');
  await ev(() => { PTD.cutters.list()[0].widthMm = 500; PTD.cutters.list()[0].maxLengthMm = 0; });
  ok(!(await flat({ scaleX: 0.2, scaleY: 0.2 })).warn.some(x => /thinner than the thinnest detail/.test(x)), 'thinnest detail 0: no thin-detail warning');
  await typeIn('[data-scope^="cutter:"][data-key="thinMm"]', '-3');
  ok(await ev(() => PTD.cutters.list()[0].thinMm === 0), 'the thinnest detail never goes below zero');
  await ev(() => { PTD.cutters.list()[0].thinMm = 1; });
  let w2 = await flat({ scaleX: 0.2, scaleY: 0.2 });
  ok(w2.warn.some(x => /thinner than the thinnest detail/.test(x)), 'warning for lines that become thinner than the thinnest detail');
  ok(!(await flat({ scaleX: 0.9, scaleY: 0.9 })).warn.some(x => /thinner than the thinnest/.test(x)), 'no warning at 90 %');

  // ---- scale fields and fit buttons
  await ev(() => { const e = PTD.core.state().export; e.scaleX = 1; e.scaleY = 1; e.scaleLock = true; PTD.core.save(); PTD.core.setTab('export'); PTD.core.renderPanels(); });
  await p.waitForFunction(() => !/Measuring/.test(document.querySelector('[data-xi="info"]').textContent), null, { timeout: 5000 });
  ok(await ev(() => /Output about/.test(document.querySelector('[data-xi="info"]').textContent)), 'the size line shows the output size');
  ok(await ev(() => Number(document.querySelector('[data-xs="x:mm"]').value) > 300), 'the width field shows millimetres');
  await typeIn('[data-xs="x:percent"]', '50');
  ok(await ev(() => { const e = PTD.core.state().export; return near(e.scaleX, 0.5, 1e-9) && near(e.scaleY, 0.5, 1e-9); }), 'locked: typing X percent sets Y too');
  await ev(() => { const c = document.querySelector('[data-scope="xp"][data-key="scaleLock"]'); c.click(); });
  await typeIn('[data-xs="y:factor"]', '0.8');
  ok(await ev(() => { const e = PTD.core.state().export; return near(e.scaleX, 0.5, 1e-9) && near(e.scaleY, 0.8, 1e-9) && e.scaleLock === false; }), 'unlocked: Y alone changes');
  await ev(() => document.querySelector('[data-scope="xp"][data-key="scaleLock"]').click());
  const refW = await ev(() => PTD.exporter.refBox().then(r => r.w));
  await typeIn('[data-xs="x:mm"]', '100');
  ok(await ev(w => near(PTD.core.state().export.scaleX, 100 / w, 1e-6), refW), 'typing the width in millimetres sets the factor');
  await click('[data-act="xfitroll"]');
  ok(await ev(w => near(PTD.core.state().export.scaleX * w, 500, 0.01), refW), 'Fit to roll width makes the output as wide as the cutting width');
  await click('[data-act="xfitpress"]');
  ok(await ev(w => { const e = PTD.core.state().export; return near(e.scaleX * w, 380, 0.01) || e.scaleX * w < 380; }, refW), 'Fit to the heat press fits inside 380 mm');
  await click('[data-act="xscale1"]');
  ok(await ev(() => PTD.core.state().export.scaleX === 1), 'Back to 100 %');
  ok(await ev(() => { const j = JSON.parse(JSON.stringify(PTD.core.toJSON(true))); return j.export.scaleLock === true && 'scaleX' in j.export; }), 'the scale is saved in the project');

  // ---- blade offset of rings
  const off = await ev(() => {
    const sq = (x, y, s) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]], hole = (x, y, s) => sq(x, y, s).reverse();
    const area = r => { let a = 0; for (let i = 0; i < r.length; i++) { const q = r[(i + 1) % r.length]; a += r[i][0] * q[1] - q[0] * r[i][1]; } return Math.abs(a / 2); };
    const out = PTD.exporter.offsetRings([sq(0, 0, 100), hole(40, 40, 20)], 1);
    const out2 = PTD.exporter.offsetRings([sq(0, 0, 100), hole(40, 40, 20)], -1);
    const gone = PTD.exporter.offsetRings([sq(0, 0, 1.5)], 1);
    return { a: out.map(area), b: out2.map(area), gone: gone.length, same: PTD.exporter.offsetRings([sq(0, 0, 10)], 0).length };
  });
  ok(near(off.a[0], 98 * 98, 0.01) && near(off.a[1], 22 * 22, 0.01), 'a positive blade offset shrinks outer rings and grows holes: ' + off.a);
  ok(near(off.b[0], 102 * 102, 0.01) && near(off.b[1], 18 * 18, 0.01), 'a negative offset does the opposite');
  ok(off.gone === 0 && off.same === 1, 'a ring that disappears is dropped; zero offset changes nothing');

  // ---- EPS and file names (downloads are captured)
  await ev(() => { window.__dl = []; const d = PTD.core.download; PTD.core.download = (n, data, m) => { window.__dl.push({ name: n, type: m, blob: data instanceof Blob }); }; window.__dlOrig = d; });
  await ev(() => { const e = PTD.core.state().export; e.format = 'eps'; e.scaleX = 0.5; e.scaleY = 0.5; e.upper = true; e.lower = true; PTD.core.save(); });
  await ev(() => PTD.exporter.cutExport('')); await p.waitForFunction(() => window.__dl.length >= 1, null, { timeout: 20000 });
  let dl = await ev(() => window.__dl.slice());
  ok(dl.length === 1 && /-50pct\.eps$/.test(dl[0].name), 'a single colour gives a single .eps file with the scale in its name: ' + (dl[0] && dl[0].name));
  await ev(() => { const e = PTD.core.state().export; e.format = 'svg'; e.scaleX = 0.5; e.scaleY = 0.8; PTD.core.save(); window.__dl = []; });
  await ev(() => PTD.exporter.cutExport('')); await p.waitForFunction(() => window.__dl.length >= 1, null, { timeout: 20000 });
  dl = await ev(() => window.__dl.slice());
  ok(dl.length === 1 && /-x50pct-y80pct\.svg$/.test(dl[0].name), 'different X and Y scales are named: ' + (dl[0] && dl[0].name));
  const eps = await ev(async () => { const e = Object.assign({}, PTD.core.state().export, { scaleX: 1, scaleY: 1, format: 'eps' }); const r = await PTD.exporter.buildCut(e); const out = PTD.exporter.cutEPS(r, ''); return { n: out.files.length, text: out.files[0] && out.files[0].text }; });
  ok(eps.n === 1 && /^%!PS-Adobe-3\.0 EPSF-3\.0/.test(eps.text) && /\n0 0 m\nS Q/.test(eps.text), 'the EPS text follows the CutStudio template');
  // two colours share one frame
  const reg = await ev(async () => {
    const st = PTD.core.state(); const b = st.band; const save = [b.color, b.outline]; b.outline = false;
    const l = st.layers[0]; const lc = l.color; l.color = 'felt'; // keep text out (no outlines offline)
    b.color = 'gold'; const o0 = Object.assign({}, st.export, { format: 'eps', scaleX: 1, scaleY: 1, texts: false });
    const r = await PTD.exporter.buildCut(o0);
    // move one line to another colour by editing the result: two colours, different bounding boxes
    const s = r.strips[0]; const rings = s.colours[b.color]; s.colours = { gold: [rings[0]], felt: [rings[1]] };
    const out = PTD.exporter.cutEPS(r, '');
    b.color = save[0]; b.outline = save[1]; l.color = lc;
    return out.files.map(f => f.text.match(/%%BoundingBox.*/)[0]).concat(out.files.map(f => { const m = f.text.split('\n').filter(x => / m$/.test(x) && x !== '0 0 m'); return m[0]; }));
  });
  ok(reg.length === 4 && reg[0] === reg[1], 'every colour file uses the same frame');
  ok(reg[2] !== reg[3], 'the two colours start at different points inside it (registered, not each moved to the corner): ' + reg.slice(2));
  await ev(() => { PTD.core.download = window.__dlOrig; });

  // ---- jobs
  await ev(() => { const e = PTD.core.state().export; e.format = 'svg'; e.scaleX = 1; e.scaleY = 1; e.upper = true; e.lower = false; e.jobName = 'Upper only'; PTD.core.save(); PTD.core.renderPanels(); });
  await click('[data-act="jobsave"]');
  ok(await ev(() => PTD.core.state().export.jobs.length === 1 && PTD.core.state().export.jobs[0].name === 'Upper only' && PTD.core.state().export.jobs[0].lower === false), 'Save the filters as a job');
  await ev(() => { const e = PTD.core.state().export; e.upper = true; e.lower = true; PTD.core.save(); PTD.core.renderPanels(); });
  await click('[data-act="jobuse"]');
  ok(await ev(() => !PTD.core.state().export.lower && PTD.core.state().export.upper), 'Use loads the filters of the job');
  await ev(() => { window.__dl = []; PTD.core.download = (n) => { window.__dl.push(n); }; });
  await click('[data-act="jobexp"]'); await p.waitForTimeout(600);
  ok(await ev(() => window.__dl.length === 1 && /\.svg$/.test(window.__dl[0])), 'Export runs the job');
  await ev(() => { PTD.core.download = window.__dlOrig; });
  await click('[data-act="jobdone"]');
  ok(await ev(() => PTD.core.state().export.jobs[0].done === true && /✓/.test(document.getElementById('exportPane').innerText)), 'Done marks the job');
  await click('[data-act="jobdel"]');
  ok(await ev(() => PTD.core.state().export.jobs.length === 0), 'Delete removes the job');

  // ---- settings migration from the old shape
  const mig = await ev(() => { const cfg = JSON.parse(JSON.stringify(PTD.core.toPartJSON('settings'))); delete cfg.cutters; delete cfg.pressMm; cfg.cutter = { name: 'Old cutter', widthMm: 610, maxLengthMm: 0 }; cfg.calib = { lengthMm: 480, marginMm: 7 }; const r = PTD.core.loadText(JSON.stringify(cfg)); const c = PTD.cutters.list()[0]; return { r: r.ok, name: c.name, w: c.widthMm, m: c.calib.margin, press: PTD.core.cfg().pressMm, has: 'cutter' in PTD.core.cfg() }; });
  ok(mig.r && mig.name === 'Old cutter' && mig.w === 610 && mig.m === 7 && mig.press === 380 && !mig.has, 'old settings with one cutter become a cutter list');
  ok(await ev(() => 'cutters' in PTD.core.toPartJSON('settings') && PTD.core.toPartJSON('settings').pressMm === 380), 'the settings file carries the cutters and the press size');

  // ---- Paper.js: the second source is used when the first fails
  {
    const p2 = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
    const hits = [];
    await p2.route(/cdnjs\.cloudflare\.com.*paper/, r => { hits.push('cdnjs'); r.abort(); });
    await p2.route(/cdn\.jsdelivr\.net.*paper/, r => { hits.push('jsdelivr'); r.fulfill({ contentType: 'application/javascript', body: 'window.paper = { Path: function(){}, setup: function(){} };' }); });
    await p2.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p2.waitForTimeout(800);
    const got = await p2.evaluate(() => PTD.exporter.loadPaper().then(P => !!P.Path, () => false));
    ok(got && hits.join() === 'cdnjs,jsdelivr', 'Paper.js: cdnjs fails, jsdelivr is tried next and used: ' + hits.join());
    const p3 = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
    await p3.route(/paper/, r => r.abort());
    await p3.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p3.waitForTimeout(800);
    ok(await p3.evaluate(() => PTD.exporter.loadPaper().then(() => false, e => /Could not load Paper/.test(e.message))), 'Paper.js: when both sources fail the export gets a clear error and goes on without it');
  }

  // ---- Export again: repeats the last export button, from anywhere
  await p.click('#tabs button[data-tab="export"]');
  const pf = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  await pf.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await pf.waitForTimeout(700);
  await pf.click('#tabs button[data-tab="export"]');
  ok(await pf.evaluate(() => document.getElementById('exportAgainBtn').hidden), 'Export again is hidden before the first export');
  await pf.hover('[data-act="cutsvg"][data-col=""]'); await pf.waitForTimeout(150);
  ok(await pf.evaluate(() => document.getElementById('exportAgainPop').hidden), 'the hover button does not show before the first export');
  await pf.close();
  const d1 = p.waitForEvent('download'); await p.click('[data-act="cutsvg"][data-col]:not([data-col=""])'); const f1 = (await d1).suggestedFilename();
  ok(/\.svg$/.test(f1) && await ev(() => !document.getElementById('exportAgainBtn').hidden), 'after an export the toolbar button appears: ' + f1);
  ok(await ev(() => /Cut file, one colour/.test(PTD.exporter.lastExport().label) && /Export again/.test(document.getElementById('exportAgainBtn').title)), 'it remembers which button was used and says so in its tooltip');
  await p.hover('[data-act="cutsvg"][data-col=""]'); await p.waitForTimeout(150);
  ok(await ev(() => document.getElementById('exportAgainPop').hidden), 'hovering another export button does not show Export again');
  await p.hover('[data-act="cutsvg"][data-col]:not([data-col=""])'); await p.waitForTimeout(150);
  const geo = await ev(() => { const a = document.querySelector('[data-act="cutsvg"][data-col]:not([data-col=""])').getBoundingClientRect(), b = document.getElementById('exportAgainPop'); const r = b.getBoundingClientRect(); return { shown: !b.hidden, right: r.left >= a.right, below: r.top > a.top, title: b.title }; });
  ok(geo.shown && geo.right && geo.below && /Export again/.test(geo.title), 'hovering the button that was pressed last shows Export again to the right and a little below, with a tooltip');
  const d2 = p.waitForEvent('download'); await p.click('#exportAgainPop'); const f2 = (await d2).suggestedFilename();
  ok(f2 === f1, 'the hover button repeats the last button: ' + f2);
  await p.click('#tabs button[data-tab="artwork"]');
  const d3 = p.waitForEvent('download'); await p.click('#exportAgainBtn'); const f3 = (await d3).suggestedFilename();
  ok(f3 === f1, 'the toolbar button repeats it from a tab that has no export button');
  const d4 = p.waitForEvent('download'); await p.click('#tabs button[data-tab="export"]'); await p.click('[data-act="pngexport"]'); const f4 = (await d4).suggestedFilename();
  await p.click('#tabs button[data-tab="artwork"]');
  const d5 = p.waitForEvent('download'); await p.click('#exportAgainBtn'); const f5 = (await d5).suggestedFilename();
  ok(/png$/i.test(f4) && f5 === f4, 'a different export button is remembered too: ' + f4);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
