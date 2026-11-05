/* Fetching a font file for the outlines of an export (kept in memory only). The network is simulated with Playwright
 * routes and a small opentype.js mock, so this checks the glue code only: the order of the sources, the memory-only
 * cache, the warning, and that nothing is saved in the project.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-fontfetch.js */
const { chromium } = require('playwright'); const path = require('path');
const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load|404|403/.test(m.text())) errs.push(m.text()); });
  const seen = []; let mode = 'good';
  await ctx.route(/cdn\.jsdelivr\.net|raw\.githubusercontent\.com/, route => {
    const url = route.request().url(); seen.push(url);
    if (mode === 'good' && /google\/fonts@main\/ofl\/alexbrush\/AlexBrush-Regular\.ttf$/.test(url)) return route.fulfill({ status: 200, contentType: 'font/ttf', headers: { 'access-control-allow-origin': '*' }, body: Buffer.alloc(4000, 1) });
    return route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: 'no' });
  });
  await p.addInitScript(() => {
    const Pth = class { constructor() { this.commands = []; } getBoundingBox() { return { x1: 0, y1: -80, x2: 200, y2: 0 }; } toPathData() { return 'M0 0L200 0L200 -80L0 -80Z'; } };
    window.opentype = { Path: Pth, parse() { return { numGlyphs: 10, unitsPerEm: 1000, charToGlyph: () => ({ advanceWidth: 500, getPath: (x, y, s) => ({ commands: [{ type: 'M', x, y }] }) }), getKerningValue: () => 0 }; } };
  });
  await p.goto(PAGE); await p.waitForTimeout(700);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { PTD.core.state().layers.forEach(l => { l.font = 'Alex Brush'; l.weight = 400; l.italic = false; l.frozen = null; }); });

  // ---- the list of sources
  const list = await ev(() => PTD.fonts.fontSources({ font: 'Alex Brush', weight: 400, italic: false }).map(s => s.url));
  ok(/^https:\/\/cdn\.jsdelivr\.net\/npm\/@fontsource\/alex-brush\/files\/alex-brush-latin-400-normal\.woff$/.test(list[0]), 'the first source is the Fontsource WOFF: ' + list[0]);
  ok(list.some(u => /jsdelivr\.net\/gh\/google\/fonts@main\/ofl\/alexbrush\/AlexBrush-Regular\.ttf$/.test(u)) && list.some(u => /raw\.githubusercontent\.com\/google\/fonts\/main\/ofl\/alexbrush\//.test(u)), 'the Google Fonts repository is a source, through jsDelivr and GitHub');
  const bold = await ev(() => PTD.fonts.fontSources({ font: 'Open Sans', weight: 700, italic: true }).map(s => s.url));
  ok(/open-sans-latin-700-italic\.woff$/.test(bold[0]) && bold.some(u => /OpenSans-BoldItalic\.ttf$/.test(u)), 'weight and italic choose the file');

  // ---- a font that is found on the second kind of source
  await p.click('#tabs button[data-tab="export"]');
  const g = await ev(async () => { const r = await PTD.exporter.gather(PTD.core.state().export); return { n: r.items.filter(i => /Molino|Royale/.test(i.name)).length, w: r.warnings.filter(w => /fetched from the internet/.test(w)).length, bad: r.warnings.filter(w => /is not cut/.test(w)).length }; });
  ok(g.n === 2 && g.w >= 1 && g.bad === 0, 'the texts are outlined from a fetched font: ' + JSON.stringify(g));
  ok(seen.length > 1 && /fontsource/.test(seen[0]), 'the sources are tried in order, Fontsource first (' + seen.length + ' requests)');
  const cached = await ev(() => Object.keys(PTD.fonts.fetched));
  ok(cached.length === 1 && /^Alex Brush\|400\|0$/.test(cached[0]), 'the file is kept in memory: ' + cached);
  const before = seen.length;
  await ev(async () => { await PTD.exporter.gather(PTD.core.state().export); });
  ok(seen.length === before, 'a second export does not fetch it again');

  // ---- nothing is saved in the project
  const pj = await ev(() => JSON.stringify(PTD.core.toJSON(true)));
  ok(!/dataBase64/.test(pj) && (await ev(() => PTD.core.state().fonts.length)) === 0, 'the project holds no copy of the fetched font');

  // ---- every source fails: a visible warning and no crash
  mode = 'bad'; await ev(() => { PTD.fonts.fetched = {}; });
  seen.length = 0;
  const dl = p.waitForEvent('download');
  await ev(() => { PTD.exporter.cutExport(); });
  await dl; await p.waitForFunction(() => /Cut file saved|NOT EVERYTHING/.test(document.getElementById('exportMsg').textContent), null, { timeout: 8000 });
  const t = await ev(() => ({ text: document.getElementById('exportMsg').textContent, bad: document.getElementById('exportMsg').classList.contains('bad') }));
  ok(/NOT EVERYTHING WAS CUT/.test(t.text) && /could not be fetched from the internet/.test(t.text) && /Alex Brush/.test(t.text) && t.bad, 'a failed fetch gives a prominent warning that names the font');
  const fontReq = seen.filter(u => /fontsource|google\/fonts/.test(u)); ok(fontReq.length === list.length, 'every source was tried once (' + fontReq.length + ' of ' + list.length + ')');

  // ---- an imported font is used and nothing is fetched
  await ev(() => { PTD.fonts.fetched = {}; PTD.fonts.data['Alex Brush'] = { buf: new ArrayBuffer(4000), fileName: 'x.ttf' }; });
  seen.length = 0;
  const g2 = await ev(async () => { const r = await PTD.exporter.gather(PTD.core.state().export); return r.items.filter(i => /Molino|Royale/.test(i.name)).length; });
  ok(g2 === 2 && seen.length === 0, 'an imported font file is used and nothing is fetched');
  await ev(() => { delete PTD.fonts.data['Alex Brush']; });

  // ---- an imported font whose file is not loaded is not replaced by a fetch
  await ev(() => { PTD.core.state().fonts.push({ family: 'Alex Brush', fileName: 'x.ttf' }); });
  seen.length = 0;
  const g3 = await ev(async () => { const r = await PTD.exporter.gather(PTD.core.state().export); return r.warnings.filter(w => /not loaded/.test(w)).length; });
  ok(g3 >= 1 && seen.length === 0, 'an imported font that is not loaded asks for its file instead of guessing');

  // ---- letter space: the browser adds it after every character, the last one too, and centres the run
  const ls = await ev(() => {
    class P { constructor() { this.commands = []; } getBoundingBox() { let x1 = 1e9, x2 = -1e9; this.commands.forEach(c => { x1 = Math.min(x1, c.x1); x2 = Math.max(x2, c.x2); }); return { x1, y1: -1, x2, y2: 0 }; } toPathData() { return 'M0 0'; } }
    const font = { unitsPerEm: 1000, getKerningValue: () => 0, charToGlyph: () => ({ advanceWidth: 600, getPath: (x, y, s) => ({ commands: [{ x1: x, x2: x + 0.6 * s }] }) }) };
    const mid = l => { const o = PTD.fonts.outline({ Path: P }, font, Object.assign({ text: 'CASINO', size: 34, upper: true, cap: false }, l)); return (o.x0 + o.x1) / 2; };
    return { none: mid({ ls: 0 }), ls11: mid({ ls: 11 }) };
  });
  ok(Math.abs(ls.none) < 1e-6 && Math.abs(ls.ls11 + 5.5) < 1e-6, 'with a letter space the text sits half of it to the left, like the stage: ' + JSON.stringify(ls));

  ok(errs.length === 0, 'no console errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? fails + ' FAILED' : 'all passed'); await b.close(); process.exit(fails ? 1 : 0);
})();
