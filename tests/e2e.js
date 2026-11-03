/* End-to-end test in headless Chromium (Playwright is not a dependency of the project).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e.js
 * The Google Fonts requests fail offline; that is expected and ignored. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path'), os = require('os');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'ptd-e2e-')) + path.sep;
const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; }
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + ' ' + (e.stack||'').split('\n').slice(1,3).join(' | ')));
  await p.goto(PAGE);
  await p.waitForTimeout(800);
  const ev = (f, a) => p.evaluate(f, a);

  // ---- tabs and tables
  for (const t of ['tables','guides','colours','fonts','export','project','artwork']) {
    await p.click(`#tabs button[data-tab="${t}"]`);
    ok(await p.isVisible(`#tab-${t}`), 'tab ' + t + ' visible');
  }
  await p.click('#tabs button[data-tab="tables"]');
  await p.click('[data-act="tselect"]');
  ok(await ev(() => PTD.core.ui.selTable === 't1'), 'table selected');
  // change preset width via the input (units mm)
  const wsel = '[data-scope="preset:t1"][data-key="w"]';
  await p.fill(wsel, '2600');
  ok(await ev(() => PTD.tables.get('t1').preset.w === 2600), 'preset width applied');
  ok(await ev(() => Math.abs(PTD.tables.geo(PTD.tables.get('t1')).bbox.w - 2600) < 1), 'geometry follows preset');
  // typing keeps focus
  ok(await ev(() => document.activeElement && document.activeElement.dataset.key === 'w'), 'focus kept while typing');
  // notch on
  await p.check('[data-scope="notch:t1"][data-key="on"]');
  ok(await ev(() => PTD.tables.get('t1').preset.notch.on === true), 'notch on');
  const a1 = await ev(() => PTD.tables.geo(PTD.tables.get('t1')).area);
  ok(a1 > 1e6, 'area positive with notch ' + Math.round(a1));
  // bet line
  await p.check('[data-scope="bet:t1"][data-key="on"]');
  await p.check('[data-scope="bet:t1"][data-key="gapOn"]');
  ok(await ev(() => { const g = PTD.tables.geo(PTD.tables.get('t1')); return g.bet && g.bet.closed === false && g.bet.pts.length > 10; }), 'bet line open with gap');
  await p.screenshot({ path: OUT + 's1.png' });

  // drag a node on canvas
  await p.click('#fitBtn');
  const node = await ev(() => { const t = PTD.tables.get('t1'); const w = PTD.tables.worldNodes(t)[0]; const v = PTD.core.ui.view; const r = document.getElementById('stage').getBoundingClientRect(); return { x: r.left + r.width/2 + (w.x - v.cx)*v.z, y: r.top + r.height/2 + (w.y - v.cy)*v.z, wx: w.x, wy: w.y, n: t.nodes.length }; });
  await p.mouse.move(node.x, node.y); await p.mouse.down(); await p.mouse.move(node.x + 40, node.y + 30, { steps: 4 }); await p.mouse.up();
  ok(await ev(() => PTD.tables.get('t1').preset === null), 'dragging a node detaches the preset');
  const moved = await ev(() => { const w = PTD.tables.worldNodes(PTD.tables.get('t1'))[0]; return [w.x, w.y]; });
  ok(Math.abs(moved[0] - node.wx) > 10 || Math.abs(moved[1] - node.wy) > 10, 'node moved ' + moved.map(Math.round));
  await p.keyboard.press('Control+z');
  ok(await ev(() => PTD.tables.get('t1').preset !== null), 'undo restores preset');
  await p.keyboard.press('Control+y');
  ok(await ev(() => PTD.tables.get('t1').preset === null), 'redo re-applies the drag');
  await p.keyboard.press('Control+z');

  // second table, rotate, delete
  await p.click('[data-act="tadd"][data-type="rect"]');
  ok(await ev(() => PTD.core.state().tables.length === 2), 'second table added');
  await p.click('[data-act="trot"][data-a="90"]');
  ok(await ev(() => PTD.core.state().tables[1].rot === 90), 'rotation 90');
  await p.click('[data-act="tdel"][data-id="t2"]');
  ok(await ev(() => PTD.core.state().tables.length === 1), 'table deleted');

  // ---- guides
  await p.click('#tabs button[data-tab="guides"]');
  await p.click('[data-act="gadd"][data-axis="x"]');
  await p.click('[data-act="gadd"][data-axis="x"]');
  await p.click('[data-act="gadd"][data-axis="x"]');
  ok(await ev(() => PTD.core.state().guides.length === 3), 'three guides');
  await p.fill('[data-scope="guide:g1"][data-key="dist"]', '-500');
  await p.fill('[data-scope="guide:g2"][data-key="dist"]', '100');
  await p.fill('[data-scope="guide:g3"][data-key="dist"]', '700');
  ok(await ev(() => PTD.guides.abs(PTD.guides.get('g3')) === 700), 'guide distance typed');
  await p.selectOption('#newConsType', 'equal');
  await p.click('[data-act="cadd"][data-axis="x"]');
  ok(await ev(() => PTD.core.state().constraints.length === 1), 'equal constraint added');
  ok(await ev(() => { const p = ['g1','g2','g3'].map(i => PTD.guides.abs(PTD.guides.get(i))); return Math.abs((p[1]-p[0]) - (p[2]-p[1])) < 1e-6; }), 'equal spacing solved: ' + JSON.stringify(await ev(() => ['g1','g2','g3'].map(i => PTD.guides.abs(PTD.guides.get(i))))));
  // drag the middle guide: others adapt
  const gx = await ev(() => { const g = PTD.guides.get('g2'); const v = PTD.core.ui.view; const r = document.getElementById('stage').getBoundingClientRect(); return { x: r.left + r.width/2 + (PTD.guides.abs(g) - v.cx)*v.z, y: r.top + r.height/2 + 120 }; });
  await p.mouse.move(gx.x, gx.y); await p.mouse.down(); await p.mouse.move(gx.x + 30, gx.y, { steps: 3 }); await p.mouse.up();
  ok(await ev(() => { const p = ['g1','g2','g3'].map(i => PTD.guides.abs(PTD.guides.get(i))); return Math.abs((p[1]-p[0]) - (p[2]-p[1])) < 1e-3; }), 'still equal after drag');
  // conflict: fix g1 and g3 positions with pos constraints while equal would force g2
  await ev(() => { const st = PTD.core.state(); st.constraints.push(PTD.guides.normalizeCons({ id: 'c9', type: 'pos', axis: 'x', ids: ['g2'], value: 0 }, 'c9')); });
  const r = await ev(() => { const x = PTD.guides.resolve(); return { ok: x.ok, n: x.conflicts.length }; });
  ok(r.ok === true, 'consistent extra constraint ok');
  await ev(() => { const st = PTD.core.state(); st.constraints.push(PTD.guides.normalizeCons({ id: 'c10', type: 'pos', axis: 'x', ids: ['g2'], value: 50 }, 'c10')); });
  const r2 = await ev(() => { const x = PTD.guides.resolve(); return { ok: x.ok, n: x.conflicts.length, t: PTD.guides.conflictText(x) }; });
  ok(r2.ok === false && r2.n > 0, 'conflict reported: ' + r2.t);
  await ev(() => { const st = PTD.core.state(); st.constraints = st.constraints.filter(c => c.id !== 'c9' && c.id !== 'c10'); PTD.guides.resolve(); PTD.core.renderPanels(); PTD.core.renderStage(); });
  // outline-referenced guide
  await ev(() => { const g = PTD.guides.get('g1'); g.ref = { type: 'outline', table: 't1', side: 'min' }; g.dist = 100; });
  ok(await ev(() => Math.abs(PTD.guides.abs(PTD.guides.get('g1')) - (PTD.tables.geo(PTD.tables.get('t1')).bbox.x0 + 100)) < 1e-6), 'outline guide position');
  await p.screenshot({ path: OUT + 's2.png' });

  // measure tool
  await p.click('[data-tool="measure"]');
  await p.mouse.click(400, 400); await p.mouse.click(700, 500);
  ok(await ev(() => PTD.core.ui.measure && PTD.core.ui.measure.a && PTD.core.ui.measure.b), 'measure two points');
  await p.keyboard.press('Escape');

  // guide tool by click
  await p.click('[data-tool="guideY"]'); await p.mouse.click(600, 300);
  ok(await ev(() => PTD.core.state().guides.some(g => g.axis === 'y')), 'horizontal guide placed by click');

  // ---- artwork
  await p.click('#tabs button[data-tab="artwork"]');
  await ev(() => PTD.core.state().layers[0].frozen);
  await p.click('[data-act="select"][data-id="l1"]');
  await p.fill('[data-scope="layer:l1"][data-key="size"][type="number"]', '180');
  ok(await ev(() => PTD.core.state().layers[0].size === 180), 'text size edit');
  await p.fill('[data-scope="layer:l1"][data-key="text"]', 'Molino X');
  ok(await ev(() => PTD.core.state().layers[0].text === 'Molino X'), 'text edit');
  await ev(() => { PTD.core.state().layers[0].text = 'Molino'; });
  // missing font warning for an imported-but-unloaded font
  await ev(() => { PTD.core.state().fonts.push({ family: 'Ghost Font', fileName: 'ghost.ttf', url: '', bytes: 1 }); PTD.core.state().layers[2].font = 'Ghost Font'; PTD.core.renderPanels(); });
  await p.click('[data-act="toggle"][data-id="l3"]');
  ok((await p.textContent('[data-fstat="l3"]')).includes('Load the font file') || (await p.textContent('[data-fstat="l3"]')).includes('not loaded'), 'missing font warning shown');
  await ev(() => { PTD.core.state().layers[2].font = 'Josefin Sans'; PTD.core.state().fonts = []; PTD.core.renderPanels(); });

  // font import with a real system font
  const ttf = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].find(f => fs.existsSync(f));
  if (ttf) {
    await p.click('#tabs button[data-tab="fonts"]');
    const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-act="fontimport"]')]);
    await chooser.setFiles(ttf);
    await p.waitForTimeout(500);
    ok(await ev(() => PTD.core.state().fonts.length === 1 && PTD.fonts.status(PTD.core.state().fonts[0].family) === 'ok'), 'font file imported and loaded: ' + await ev(() => JSON.stringify(PTD.core.state().fonts)));
    ok(await ev(() => PTD.core.state().fonts[0].family === 'DejaVu Sans'), 'family name read from the font name table');
    await p.fill('[data-scope^="font:"][data-key="url"]', 'https://example.org/font');
    ok(await ev(() => PTD.core.state().fonts[0].url === 'https://example.org/font'), 'source URL stored');
  } else console.log('skip font import (no TTF on system)');

  // palette
  await p.click('#tabs button[data-tab="colours"]');
  await p.click('[data-act="paladd"]');
  ok(await ev(() => PTD.core.state().palette.length === 6), 'colour added');
  await p.fill('[data-scope="pal:c1"][data-key="name"]', 'Burgundy');
  ok(await ev(() => PTD.scopes.pal('c1').name === 'Burgundy'), 'colour renamed');
  await p.click('[data-act="paldel"][data-id="c1"]');
  ok(await ev(() => PTD.core.state().palette.length === 5), 'unused colour deleted');
  await p.click('[data-act="paldel"][data-id="gold"]', { force: true }).catch(() => {});
  ok(await ev(() => PTD.core.state().palette.some(c => c.id === 'gold')), 'used colour cannot be deleted');

  // units
  await p.selectOption('select[data-key="units"]', 'in');
  await p.click('#tabs button[data-tab="tables"]');
  await p.click('[data-act="tselect"][data-id="t1"]');
  const wv = await p.inputValue('[data-scope="preset:t1"][data-key="w"]');
  ok(Math.abs(parseFloat(wv) - 2600/25.4) < 0.01, 'width shown in inches ' + wv);
  await p.selectOption('select[data-key="units"]', 'mm');

  // real cloth + dim
  await p.check('[data-scope="cloth"][data-key="real"]'); await p.check('[data-scope="cfg"][data-key="dimOutside"]');
  await p.click('#fitBtn');
  await p.screenshot({ path: OUT + 's3.png' });
  await p.uncheck('[data-scope="cloth"][data-key="real"]'); await p.uncheck('[data-scope="cfg"][data-key="dimOutside"]');

  // ---- save / load roundtrip
  const snap = await ev(() => JSON.stringify(PTD.core.toJSON(true)));
  const o = JSON.parse(snap);
  ok(o.format === 'poker-table-designer-project' && o.version === 1 && o.tables.length === 1 && o.palette.length >= 5, 'project JSON shape');
  ok(o.artwork.layers[0].fontSizeMm === undefined, 'no stray keys');
  await p.click('#tabs button[data-tab="project"]');
  await p.click('[data-act="ptext"]');
  const txt = await p.inputValue('#projectText');
  await p.evaluate(() => { PTD.core.state().layers.length = 1; });
  await p.fill('#projectText', txt); await p.click('[data-act="papply"]');
  ok(await ev(() => PTD.core.state().layers.length === 3), 'project reloaded from text');
  // legacy
  const legacy = { stage: { w: 1000, h: 560, bg: '#0d2b22' }, layers: [{ text: 'Old', font: 'Mea Culpa', size: 100, x: 500, y: 280, color: '#d4af5a', gradient: true }], band: { x: 500, y: 362, len: 720, gap: 150, thick: 3, color: '#d4af5a' }, cards: { hand: 'As Ks' } };
  await p.fill('#projectText', JSON.stringify(legacy)); await p.click('[data-act="papply"]');
  ok(await ev(() => { const l = PTD.core.state().layers[0]; return l.x === 0 && l.y === 0 && l.color === 'gold' && PTD.core.state().band.y === 82; }), 'legacy settings converted to mm and centre origin');

  // restore defaults for export tests
  await p.click('[data-act="pnew"]').catch(() => {});
  await ev(() => { window.confirm = () => true; });
  await p.click('[data-act="pnew"]');
  ok(await ev(() => PTD.core.state().layers.length === 3 && PTD.core.state().tables.length === 1 && PTD.core.state().layers[0].x === -170), 'new project keeps default positions');

  // ---- sheet
  await ev(() => { PTD.guides.add('x', 300); PTD.guides.add('y', -200); PTD.guides.add('x', -300); PTD.guides.add('y', 200); });
  const sheet = await ev(() => PTD.sheet.build());
  ok(/Check diagonals/.test(sheet.html) && /Centre mark/.test(sheet.html) && /Guide lines/.test(sheet.html), 'sheet has sections');
  ok(/<svg/.test(sheet.svg), 'sheet svg');
  fs.writeFileSync(OUT + 'sheet.html', sheet.html);
  await p.click('#tabs button[data-tab="export"]');
  await p.click('[data-act="sheetview"]');
  ok(await p.isVisible('#modal iframe'), 'sheet preview opens');
  await p.screenshot({ path: OUT + 's4.png' });
  await p.keyboard.press('Escape');

  // ---- cut export (fake frozen outlines, Paper unavailable offline -> fallback)
  await ev(() => { PTD.core.state().layers.forEach((l, i) => { l.frozen = { d: 'M0 0L200 0L200 -80L0 -80Z', x0: 0, y0: -80, x1: 200, y1: 0 }; }); PTD.core.renderStage(); });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('[data-act="cutsvg"][data-col=""]')]);
  const cutPath = OUT + 'cut.svg'; await dl.saveAs(cutPath);
  const cut = fs.readFileSync(cutPath, 'utf8');
  ok(/<svg[^>]+mm/.test(cut) && /<path d="M/.test(cut) && /data-colour="#d4af5a"/.test(cut), 'cut svg has colour layer');
  console.log('cut svg bytes', cut.length, 'msg:', await p.textContent('#exportMsg'));
  // mirror + rotate
  await p.check('[data-scope="xp"][data-key="mirror"]'); await p.selectOption('[data-scope="xp"][data-key="rotate"]', '90');
  await p.fill('[data-scope="xp"][data-key="stripW"]', '150');
  const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('[data-act="cutsvg"][data-col=""]')]);
  await dl2.saveAs(OUT + 'cut2.svg');
  const cut2 = fs.readFileSync(OUT + 'cut2.svg', 'utf8');
  ok(/strip 1 of/.test(cut2), 'strips split');
  await p.uncheck('[data-scope="xp"][data-key="mirror"]'); await p.selectOption('[data-scope="xp"][data-key="rotate"]', '0'); await p.fill('[data-scope="xp"][data-key="stripW"]', '0');

  // ---- PNG
  const [dl3] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('[data-act="pngexport"]')]);
  await dl3.saveAs(OUT + 'out.png');
  ok(fs.statSync(OUT + 'out.png').size > 1000, 'png saved ' + fs.statSync(OUT + 'out.png').size);

  // ---- Blender
  const [dl4] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('[data-act="blender"][data-kind="preview"]')]);
  await dl4.saveAs(OUT + 'scene.py');
  const py = fs.readFileSync(OUT + 'scene.py', 'utf8');
  ok(/PROJECT = json.loads\(r'''\{/.test(py) && /PROFILE = \{"name": "preview"/.test(py), 'blender script has project and profile');
  ok(/TABLE_HEIGHT = 0\.74/.test(py), 'table height');
  ok(/^main\(\)\s*$/m.test(py), 'blender script calls main()');
  {
    const { spawnSync } = require('child_process');
    fs.writeFileSync(OUT + 'scene-for-mock.py', py);
    const r = spawnSync('python3', [__dirname + '/blender_mock.py', OUT + 'scene-for-mock.py', '--expect-project'], { encoding: 'utf8' });
    ok(r.status === 0, 'blender script runs against the stand-in bpy: ' + (r.stdout + r.stderr).split('\n').filter(l => /PROBLEM|Error|Traceback|ok$/.test(l)).join(' | '));
  }
  fs.writeFileSync(OUT + 'scene.py', py);

  // ---- Paste settings box
  await p.click('#pasteBtn');
  await p.fill('#pasteBox', JSON.stringify({ stage: { w: 1000, h: 600 }, layers: [{ id: 1, type: 'text', text: 'PASTED', x: 500, y: 300, font: 'Arial', size: 80, color: '#d4af5a' }] }));
  await p.click('[data-act="pload"]');
  ok(await ev(() => PTD.core.state().layers.length === 1 && PTD.core.state().layers[0].text === 'PASTED'), 'pasted legacy settings load');
  await p.fill('#pasteBox', 'nonsense'); await p.click('[data-act="pload"]');
  ok(/not valid JSON/.test(await p.textContent('#projMsg')), 'invalid pasted text reported');

  // ---- Randomizer
  await p.click('#tabs button[data-tab="project"]');
  await p.click('[data-act="pnew"]').catch(() => {});
  await p.click('#tabs button[data-tab="random"]');
  const words0 = await ev(() => PTD.core.state().layers.map(l => l.text).join('|'));
  await ev(() => { PTD.core.state().tables.forEach(t => { t.bet.on = true; }); PTD.core.renderPanels(); });
  const undo0 = await ev(() => document.getElementById('undoBtn').disabled);
  await p.fill('[data-scope="rand"][data-key="interval"]', '1');
  await p.click('[data-act="randstart"]');
  await p.waitForTimeout(3500);
  ok(await p.locator('#randBar').count() === 1, 'progress bar shown');   /* its width is 0 right after a round */
  ok(/elapsed/.test(await p.textContent('#randTime')), 'progress text shows elapsed and remaining time');
  ok(await ev(() => PTD.random.isRunning()), 'randomizer running');
  await p.click('[data-act="randstop"]');
  ok(await ev(() => !PTD.random.isRunning()), 'randomizer stopped');
  ok(await ev(() => PTD.core.state().layers.map(l => l.text).join('|')) === words0, 'words unchanged by the randomizer');
  const inside = await ev(() => {
    const t = PTD.core.state().tables.filter(x => x.visible)[0], G = PTD.geom;
    const poly = G.transformPoints(G.offsetPolygon(G.flatten(t.nodes, 0.5), -(t.bet.inset), 0.5), t.x, t.y, t.rot);
    return PTD.core.state().layers.every(l => G.pointInPolygon([l.x, l.y], poly));
  });
  ok(inside, 'text anchors stay inside the player area');
  const before = await ev(() => PTD.core.state().layers.map(l => [l.font, l.size, l.x, l.y].join()).join('|'));
  await p.keyboard.press('Control+z');
  const after = await ev(() => PTD.core.state().layers.map(l => [l.font, l.size, l.x, l.y].join()).join('|'));
  ok(before !== after, 'one undo reverts the whole run');
  ok(await ev(() => document.getElementById('undoBtn').disabled) === undo0, 'undo history is back to the start');
  // shape checkbox
  await p.check('[data-scope="rand"][data-key="shape"]');
  const nodes0 = await ev(() => JSON.stringify(PTD.core.state().tables[0].preset));
  let changed = false;
  for (let i = 0; i < 12 && !changed; i++) { await p.click('[data-act="randonce"]'); await p.waitForTimeout(400); changed = nodes0 !== await ev(() => JSON.stringify(PTD.core.state().tables[0].preset)); }
  ok(changed, 'table shape changes when the box is ticked');
  // create casino from nothing
  await p.click('[data-act="randcreate"]');
  await p.waitForTimeout(3200);
  const made = await ev(() => ({ n: PTD.core.state().layers.length, name: PTD.core.state().name, texts: PTD.core.state().layers.map(l => l.text) }));
  ok(made.n >= 1 && made.n <= 7 && made.name.split(' ').every(w => made.texts.indexOf(w) >= 0), 'Create casino makes texts from an invented name: ' + JSON.stringify(made));

  // ---- Player-area line outline, view toggles, dealer line
  await ev(() => PTD.core.state && 1);
  await p.click('#tabs button[data-tab="project"]');
  p.once('dialog', d => d.accept());
  await p.click('[data-act="pnew"]');
  ok(await ev(() => PTD.core.state().band.at === PTD.core.state().layers.length && PTD.core.state().band.outline === true), 'default: lines above all texts, with outline');
  ok(await ev(() => { const L = PTD.core.state().layers; return L[0].outline === false && L[1].outline === false && L[2].outline === true; }), 'default: two big texts without outline, small text with outline');
  await p.check('#betToggle');
  ok(await ev(() => PTD.core.state().tables.every(t => t.bet.on && t.bet.outline === true && t.bet.outlineW > 0)), 'player-area line toggle works and has an outline by default');
  const order = await ev(() => {
    const paths = [...document.querySelectorAll('#stage path[stroke-linecap="butt"]')];
    const line = paths[paths.length - 1], halo = paths[paths.length - 2], par = line && line.parentNode;
    if (!par) return 'none';
    const kids = [...par.children], textBefore = kids.slice(0, kids.indexOf(halo)).some(k => k.querySelector && k.querySelector('text'));
    return (kids[kids.length - 1] === line && textBefore) ? 'ok' : 'wrong order';
  });
  ok(order === 'ok', 'player-area line and its outline are drawn after all texts: ' + order);
  const gathered = await ev(async () => { const r = await PTD.exporter.gather({ bet: true }); const it = r.items[r.items.length - 1]; return { name: it.name, halo: it.halo, hasHaloRings: !!it.haloRings, rings: it.rings.length }; });
  ok(/player-area/.test(gathered.name) && gathered.halo > 0 && gathered.hasHaloRings && gathered.rings === 2, 'cut export puts the player-area line on top, with a hole outline: ' + JSON.stringify(gathered));
  // centre mark and dealer line toggles
  const cnt = () => ev(() => document.querySelectorAll('#stage circle').length);
  const c1 = await cnt(); await p.uncheck('[data-scope="cfg"][data-key="showCentre"]'); const c2 = await cnt();
  ok(c2 < c1, 'centre mark hides'); await p.check('[data-scope="cfg"][data-key="showCentre"]');
  await ev(() => { const t = PTD.core.state().tables[0]; t.preset.notch.on = true; PTD.tables.regen(t); PTD.core.renderPanels(); PTD.core.renderStage(); });
  const hasDealer = () => ev(() => [...document.querySelectorAll('#stage text')].some(t => t.textContent === 'Dealer'));
  ok(await hasDealer(), 'dealer line shown when the notch is on');
  await p.uncheck('[data-scope="cfg"][data-key="showDealer"]');
  ok(!(await hasDealer()), 'dealer line can be hidden'); await p.check('[data-scope="cfg"][data-key="showDealer"]');
  // toggles work while the randomizer runs
  await p.click('#tabs button[data-tab="random"]');
  await p.uncheck('[data-scope="rand"][data-key="betVary"]');
  await p.click('[data-act="randstart"]'); await p.waitForTimeout(600);
  await p.uncheck('#betToggle');
  await p.waitForTimeout(400);
  ok(await ev(() => PTD.random.isRunning() && PTD.core.state().tables.every(t => !t.bet.on)), 'player-area line toggle works while the randomizer runs');
  await p.click('[data-act="randstop"]');
  // the randomizer flips the line when allowed
  await p.check('[data-scope="rand"][data-key="betVary"]');
  const seen = new Set();
  for (let i = 0; i < 14; i++) { await p.click('[data-act="randonce"]'); await p.waitForTimeout(250); seen.add(await ev(() => PTD.core.state().tables[0].bet.on)); }
  ok(seen.size === 2, 'random shows and hides the player-area line');

  // ---- JSON window and table names
  await p.click('#tabs button[data-tab="project"]');
  await p.click('#projectPane [data-act="jsonopen"]');
  ok(await p.isVisible('#jsonDlg'), 'JSON window opens from the Project tab');
  const jtxt = await p.inputValue('#jsonText');
  ok(/"format": "poker-table-designer-project"/.test(jtxt) && /"layers"/.test(jtxt) && /"tables"/.test(jtxt), 'JSON window shows the whole project');
  await p.click('#jsonDlg [data-j="copy"]');
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => navigator.clipboard.readText()) === jtxt, 'Copy puts the text on the clipboard');
  // edit through the clipboard: change the project name, paste, Apply keeps the window open
  await p.evaluate((t) => navigator.clipboard.writeText(t.replace('"name": "Casino"', '"name": "X"').replace(/"name": "[^"]*",\n "artwork"/, '"name": "Pasted via clipboard",\n "artwork"')), jtxt);
  await p.click('#jsonDlg [data-j="paste"]');
  await p.waitForTimeout(400);
  ok(/Pasted via clipboard/.test(await p.inputValue('#jsonText')), 'Paste brings the clipboard into the window');
  await p.click('#jsonDlg [data-j="apply"]');
  ok(await p.isVisible('#jsonDlg') && await ev(() => PTD.core.state().name === 'Pasted via clipboard'), 'Apply applies and keeps the window open');
  await p.fill('#jsonText', 'not json');
  await p.click('#jsonDlg [data-j="ok"]');
  ok(await p.isVisible('#jsonDlg') && /not valid JSON/.test(await p.textContent('#jsonMsg')), 'OK with bad text keeps the window open and reports');
  await p.click('#jsonDlg [data-j="cancel"]');
  ok(!(await p.isVisible('#jsonDlg')), 'Cancel closes the window');
  ok(await ev(() => PTD.core.state().name === 'Pasted via clipboard'), 'Cancel does not change the project');
  await p.click('#projectPane [data-act="jsonopen"]');
  await p.evaluate(() => { const ta = document.getElementById('jsonText'); ta.value = ta.value.replace('"name": "Pasted via clipboard"', '"name": "Applied by OK"'); });
  await p.click('#jsonDlg [data-j="ok"]');
  ok(!(await p.isVisible('#jsonDlg')) && await ev(() => PTD.core.state().name === 'Applied by OK'), 'OK applies and closes');
  // dragging a JSON file onto the window
  await p.click('#projectPane [data-act="jsonopen"]');
  await p.evaluate(() => {
    const dt = new DataTransfer(); dt.items.add(new File(['{"format":"poker-table-designer-project","version":1,"name":"Dropped file"}'], 'dropped.json', { type: 'application/json' }));
    const ev = (t) => document.getElementById('jsonDlg').dispatchEvent(new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true }));
    ev('dragover'); ev('drop');
  });
  await p.waitForTimeout(300);
  ok(/Dropped file/.test(await p.inputValue('#jsonText')) && /Loaded dropped.json/.test(await p.textContent('#jsonMsg')), 'dropping a JSON file fills the text box');
  await p.click('#jsonDlg [data-j="ok"]');
  ok(await ev(() => PTD.core.state().name === 'Dropped file'), 'the dropped file is applied with OK');
  // table name label
  const names = () => ev(() => [...document.querySelectorAll('#stage text')].filter(t => t.textContent === PTD.core.state().tables[0].name).length);
  ok(await names() === 1, 'table name shown by default');
  await p.uncheck('[data-scope="cfg"][data-key="showNames"]');
  ok(await names() === 0, 'table name can be hidden');
  await p.check('[data-scope="cfg"][data-key="showNames"]');

  // ---- Blender preview window
  await p.click('#tabs button[data-tab="export"]');
  await p.click('[data-act="blenderpreview"]');
  await p.waitForSelector('#modalBody canvas', { timeout: 30000 });
  ok(await p.isVisible('#modalBody canvas') && /cloth .* m, \d+ outline points/.test(await p.textContent('#modalBody p')), 'Blender preview shows the table and its numbers');
  const dark = await p.evaluate(() => { const c = document.querySelector('#modalBody canvas'), d = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data; return [d[0], d[1], d[2], d[3]]; });
  ok(dark[3] === 255, 'Blender preview canvas is painted at the table centre: ' + dark.join(','));
  await p.click('#modalBar [data-sheet="close"]');

  // ---- version tag
  ok(/^V\d+ · \d{12}$/.test(await p.textContent('#version')), 'version tag shown under the title: ' + await p.textContent('#version'));

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
