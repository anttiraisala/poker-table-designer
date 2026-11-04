/* Browser checks for the size limits of the randomizer's table shapes.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-shapes.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(800);
  const ev = (f, a) => p.evaluate(f, a);
  /* many random shapes in one go, with the defaults */
  const sample = (n) => ev(n => { const out = []; for (let i = 0; i < n; i++) { PTD.random.shapeTables(); const t = PTD.core.state().tables[0], q = t.preset; out.push({ type: q.type, w: q.w, h: q.h, r: q.r, ch: q.chamfer, notch: q.notch.on ? q.notch.w : 0, bbox: PTD.tables.geo(t).bbox.w }); } return out; }, n);
  const all = await sample(400);
  const types = {}; all.forEach(s => types[s.type] = (types[s.type] || 0) + 1);
  ok(['stadium', 'rect', 'octagon', 'circle'].every(k => types[k] > 0), 'all four table types occur: ' + JSON.stringify(types));
  ok(all.filter(s => s.type === 'circle' || s.type === 'octagon').every(s => s.w === s.h && s.w >= 800 && s.w <= 1200), 'circles and octagons are square-sized between 800 and 1200 mm by default');
  ok(all.filter(s => s.type === 'circle').some(s => s.w < 900) && all.filter(s => s.type === 'circle').some(s => s.w > 1100), 'circle sizes cover the range');
  const rs = all.filter(s => s.type === 'stadium' || s.type === 'rect');
  ok(rs.every(s => s.h >= 600 && s.h <= 1200 && s.h % 50 === 0), 'rectangles and stadiums are 600 to 1200 mm high');
  ok(rs.every(s => s.w / s.h >= 4 / 3 - 0.04 && s.w / s.h <= 2 + 0.04), 'their width is height times a factor between 4/3 and 2 (rounded to 50 mm): min ' + Math.min(...rs.map(s => s.w / s.h)).toFixed(3) + ' max ' + Math.max(...rs.map(s => s.w / s.h)).toFixed(3));
  ok(Math.max(...rs.map(s => s.w / s.h)) > 1.8 && Math.min(...rs.map(s => s.w / s.h)) < 1.5, 'the factor is spread over the whole range');
  ok(all.filter(s => s.notch).length > 20, 'dealer notches still occur');
  ok(all.filter(s => s.notch).every(s => { const st = s.type === 'stadium' ? s.w - s.h : s.type === 'octagon' ? s.w - 2 * s.ch : s.w - 2 * s.r; return s.notch <= st * 0.7 + 10 && s.notch >= 150; }), 'every notch fits on the straight part of its side');

  /* adjustable limits */
  await ev(() => { Object.assign(PTD.random.opts, { sizeMin: 900, sizeMax: 900, heightMin: 700, heightMax: 700, factorMin: 3, factorMax: 3 }); });
  const fixed = await sample(60);
  ok(fixed.filter(s => s.type === 'circle' || s.type === 'octagon').every(s => s.w === 900 && s.h === 900), 'the size limits can be changed');
  ok(fixed.filter(s => s.type === 'stadium' || s.type === 'rect').every(s => s.h === 700 && s.w === 2100), 'the height and factor limits can be changed');
  await ev(() => { Object.assign(PTD.random.opts, { sizeMin: 1200, sizeMax: 600, heightMin: 1200, heightMax: 600, factorMin: 2, factorMax: 4 / 3 }); });
  const swapped = await sample(100);
  ok(swapped.every(s => (s.type === 'circle' || s.type === 'octagon' ? s.w >= 600 && s.w <= 1200 : s.h >= 600 && s.h <= 1200)), 'a min above the max is swapped, not an error');
  await ev(() => { Object.assign(PTD.random.opts, { sizeMin: 800, sizeMax: 1200, heightMin: 600, heightMax: 1200, factorMin: 4 / 3, factorMax: 2 }); });
  /* the user may go below the default minimum */
  await ev(() => { Object.assign(PTD.random.opts, { sizeMin: 600, sizeMax: 600 }); });
  ok((await sample(60)).filter(s => s.type === 'circle' || s.type === 'octagon').every(s => s.w === 600), 'the minimum can be set below the 800 mm default');
  await ev(() => { Object.assign(PTD.random.opts, { sizeMin: 800, sizeMax: 1200 }); });

  /* the fields */
  await p.click('#tabs button[data-tab="random"]');
  for (const k of ['sizeMin', 'sizeMax', 'heightMin', 'heightMax', 'factorMin', 'factorMax']) ok(await p.isVisible(`[data-scope="rand"][data-key="${k}"]`), 'field ' + k + ' is on the Random tab');
  ok(await p.inputValue('[data-scope="rand"][data-key="sizeMin"]') === '800' && Number(await p.inputValue('[data-scope="rand"][data-key="factorMin"]')) > 1.33, 'the fields show the defaults');
  await p.fill('[data-scope="rand"][data-key="heightMax"]', '1000');
  ok(await ev(() => PTD.random.opts.heightMax === 1000), 'typing in a field changes the limit and keeps the focus');
  ok(await ev(() => document.activeElement && document.activeElement.dataset.key === 'heightMax'), 'while typing the field is not rebuilt');

  /* nothing else is touched */
  const before = await ev(() => JSON.stringify([PTD.core.state().origin, PTD.core.state().tables[0].bet, PTD.core.state().cards]));
  await sample(5);
  ok(before === await ev(() => JSON.stringify([PTD.core.state().origin, PTD.core.state().tables[0].bet, PTD.core.state().cards])), 'the shape change leaves the origin, the player-area line and the cards alone');

  ok(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
