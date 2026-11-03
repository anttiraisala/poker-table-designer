/* Browser checks for partial project files (artwork / tables), the Save menu, per-tab buttons and the Space hand cursor.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-parts.js */
const { chromium } = require('playwright');
const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(500);
  const ev = (f, a) => p.evaluate(f, a);
  const dlJson = async (trigger) => {
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), trigger()]);
    return { name: dl.suggestedFilename(), json: JSON.parse(fs.readFileSync(await dl.path(), 'utf8')) };
  };

  // ---- Save menu
  const menuShown = () => p.isVisible('#saveMenu');
  ok(!(await menuShown()), 'Save menu is closed at start');
  let downloaded = false; p.on('download', () => { downloaded = true; });
  await p.click('#saveBtn'); await p.waitForTimeout(200);
  ok(await menuShown() && !downloaded, 'clicking Save opens the menu without saving');
  await p.keyboard.press('Escape');
  ok(!(await menuShown()), 'Esc closes the Save menu');
  await p.mouse.move(5, 500); await p.waitForTimeout(100);
  const box = await p.locator('#saveBtn').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(150);
  ok(await menuShown(), 'hovering Save opens the menu');
  const items = await p.locator('#saveMenu button').allTextContents();
  ok(items.length === 3 && /Project/.test(items[0]) && /Artwork/.test(items[1]) && /Tables/.test(items[2]), 'menu lists Project, Artwork only, Tables only: ' + items.join(' | '));
  const art = await dlJson(() => p.click('#saveMenu [data-save="artwork"]'));
  ok(/\.artwork\.json$/.test(art.name) && art.json.artwork && art.json.cloth && !art.json.tables && !art.json.guides && !art.json.export, 'Artwork only has artwork and cloth, no tables or export: ' + art.name);
  ok(art.json.palette.length > 0 && art.json.palette.length < 5, 'artwork file carries only the colours it uses: ' + art.json.palette.map(c => c.id));
  await p.mouse.move(5, 500); await p.waitForTimeout(150);
  await p.click('#saveBtn');
  const tab = await dlJson(() => p.click('#saveMenu [data-save="tables"]'));
  ok(/\.tables\.json$/.test(tab.name) && tab.json.tables && Array.isArray(tab.json.guides) && Array.isArray(tab.json.constraints) && !tab.json.artwork && !tab.json.cloth, 'Tables only has tables, guides, constraints: ' + tab.name);
  await p.mouse.move(5, 500); await p.waitForTimeout(150);
  await p.click('#saveBtn');
  const proj = await dlJson(() => p.click('#saveMenu [data-save="project"]'));
  ok(/\.project\.json$/.test(proj.name) && proj.json.artwork && proj.json.tables && proj.json.export && proj.json.palette, 'Project has everything: ' + proj.name);
  await p.mouse.move(5, 500); await p.click('body', { position: { x: 700, y: 5 } });
  const cs = await dlJson(() => p.keyboard.press('Control+s'));
  ok(/\.project\.json$/.test(cs.name), 'Ctrl+S saves the project');

  // ---- per-tab buttons and part JSON windows
  await p.click('#tabs button[data-tab="artwork"]');
  const a2 = await dlJson(() => p.click('#tab-artwork [data-act="partsave"]'));
  ok(/\.artwork\.json$/.test(a2.name), 'Artwork tab Save saves the artwork only');
  await p.click('#tab-artwork [data-act="jsonopen"]');
  let txt = await p.inputValue('#jsonText');
  ok(/"artwork"/.test(txt) && !/"tables"/.test(txt), 'Artwork tab JSON shows only the artwork part');
  await p.click('#jsonDlg [data-j="cancel"]');
  await p.click('#tabs button[data-tab="tables"]');
  const t2 = await dlJson(() => p.click('#tablesPane [data-act="partsave"]'));
  ok(/\.tables\.json$/.test(t2.name), 'Tables tab Save saves the tables only');
  await p.click('#tablesPane [data-act="jsonopen"]');
  txt = await p.inputValue('#jsonText');
  ok(/"tables"/.test(txt) && /"guides"/.test(txt) && !/"artwork"/.test(txt), 'Tables tab JSON shows tables and guides, no artwork');
  await p.fill('#jsonText', txt.replace('"name": "Table 1"', '"name": "Edited in JSON"'));
  await p.click('#jsonDlg [data-j="ok"]');
  ok(await ev(() => PTD.core.state().tables[0].name === 'Edited in JSON' && PTD.core.state().layers.length === 3), 'applying the tables text changes tables and keeps the artwork');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#tablesPane [data-act="partopen"]')]);
  ok(!!fc, 'Tables tab Open opens the file chooser');
  await fc.setFiles({ name: 'x.tables.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(tab.json)) }); await p.waitForTimeout(400);
  ok(await ev(() => PTD.core.state().tables[0].name === 'Table 1'), 'Open loads the chosen tables file');

  // ---- partial loading rules
  const load = (o) => ev(o => PTD.core.loadText(JSON.stringify(o)), o);
  const nm = await ev(() => PTD.core.state().name);
  const modArt = JSON.parse(JSON.stringify(art.json)); modArt.name = 'Other name'; modArt.artwork.layers[0].text = 'Edited';
  await ev(() => { PTD.core.state().tables[0].name = 'Keep me'; PTD.core.state().guides.push(PTD.guides.normalize({ axis: 'x', pos: 50 }, 'g9')); PTD.core.save(); });
  const gc = await ev(() => PTD.core.state().guides.length);
  let r = await load(modArt);
  ok(r.ok && /^Loaded artwork.*\. Kept tables, guides and constraints\.$/.test(r.msg), 'artwork file message: ' + r.msg);
  ok(await ev(() => PTD.core.state().layers[0].text === 'Edited' && PTD.core.state().tables[0].name === 'Keep me'), 'artwork load leaves tables alone');
  ok(await ev(g => PTD.core.state().guides.length === g, gc), 'artwork load leaves guides alone');
  ok(await ev(n => PTD.core.state().name === n, nm), 'a one-group file does not rename the project');
  await ev(() => { PTD.core.ui; });
  const modTab = JSON.parse(JSON.stringify(tab.json)); modTab.tables[0].name = 'From file';
  r = await load(modTab);
  ok(r.ok && /^Loaded tables, guides and constraints.*\. Kept artwork\.$/.test(r.msg), 'tables file message: ' + r.msg);
  ok(await ev(() => PTD.core.state().layers[0].text === 'Edited' && PTD.core.state().tables[0].name === 'From file'), 'tables load leaves the artwork alone');
  r = await load({ format: 'poker-table-designer-project', version: 1, name: 'Just a name' });
  ok(r.ok && await ev(() => PTD.core.state().name === 'Just a name' && PTD.core.state().layers[0].text === 'Edited'), 'a name-only file sets the name and keeps the rest');
  // palette: partial files merge by id, a full project replaces
  await load({ format: 'poker-table-designer-project', version: 1, artwork: { layers: [] }, palette: [{ id: 'gold', name: 'Gold', hex: '#ff0000' }, { id: 'neon', name: 'Neon', hex: '#00ff00' }] });
  ok(await ev(() => { const P = PTD.core.state().palette; return P.find(c => c.id === 'gold').hex === '#ff0000' && P.some(c => c.id === 'neon') && P.some(c => c.id === 'felt'); }), 'a partial file merges the palette by id');
  const full = JSON.parse(JSON.stringify(proj.json)); full.palette = [{ id: 'felt', name: 'Felt', hex: '#112233' }, { id: 'gold', name: 'Gold', hex: '#d4af5a' }];
  r = await load(full);
  ok(r.ok && r.msg === 'Project loaded.' && await ev(() => !PTD.core.state().palette.some(c => c.id === 'neon') && PTD.core.state().palette.find(c => c.id === 'felt').hex === '#112233'), 'a full project replaces the palette');
  // export references
  await ev(() => { PTD.core.state().export.bTable = 't9'; PTD.core.state().export.area = 't9'; });
  const t1only = JSON.parse(JSON.stringify(tab.json)); t1only.tables[0].id = 'tA';
  await load(t1only);
  ok(await ev(() => PTD.core.state().export.bTable === '' && PTD.core.state().export.area === 'all'), 'export table references reset when the table is gone');
  // undo restores the state before a partial load
  const before = await ev(() => PTD.core.state().layers[0].text);
  await load(modArt); await p.click('#undoBtn');
  ok(await ev(b => PTD.core.state().layers[0].text === b, before), 'a partial load is one undo step');
  // legacy logo-editor settings only replace the artwork
  await ev(() => { PTD.core.state().tables[0].name = 'Survivor'; PTD.core.save(); });
  r = await load({ stage: { w: 1000, h: 560, bg: '#0d2b22' }, layers: [{ text: 'Old logo', font: 'Mea Culpa', size: 100, x: 500, y: 280 }] });
  ok(r.ok && await ev(() => PTD.core.state().layers[0].text === 'Old logo' && PTD.core.state().tables[0].name === 'Survivor'), 'old logo-editor settings load as artwork only: ' + r.msg);

  // ---- Space hand cursor
  await p.click('#tabs button[data-tab="artwork"]');
  const sw = () => ev(() => document.getElementById('stageWrap').className);
  const cur = (sel) => ev(s => getComputedStyle(document.querySelector(s)).cursor, sel);
  await p.mouse.move(700, 450);
  await p.keyboard.down('Space'); await p.waitForTimeout(50);
  ok(/\bspace\b/.test(await sw()), 'Space over the stage turns on the hand cursor');
  ok(await cur('#stageWrap') === 'grab' && await cur('#stage rect') === 'grab', 'cursor is the open hand, also over artwork');
  const c0 = await ev(() => [PTD.core.ui.view.cx, PTD.core.ui.view.cy]);
  await p.mouse.down(); await p.mouse.move(600, 400, { steps: 4 });
  ok(await cur('#stageWrap') === 'grabbing', 'cursor is the closed hand while dragging');
  await p.mouse.up();
  const c1 = await ev(() => [PTD.core.ui.view.cx, PTD.core.ui.view.cy]);
  ok(c1[0] > c0[0] && c1[1] > c0[1], 'Space + left drag pans the view');
  await p.keyboard.up('Space'); await p.waitForTimeout(50);
  ok(!/\bspace\b|panning/.test(await sw()) && await cur('#stageWrap') !== 'grab', 'releasing Space restores the cursor');
  // Space over the stage with a button focused: pans, and does not press the button
  await p.focus('#cloneBtn'); const n0 = await ev(() => PTD.core.state().layers.length);
  await p.mouse.move(700, 450); await p.keyboard.down('Space'); await p.keyboard.up('Space');
  ok(await ev(n => PTD.core.state().layers.length === n, n0), 'Space over the stage does not press a focused button');
  await p.keyboard.down('Space'); await p.waitForTimeout(50);
  ok(/\bspace\b/.test(await sw()), 'Space works when a button had the focus');
  await p.mouse.move(1450, 20); await p.waitForTimeout(50);
  ok(!/\bspace\b/.test(await sw()), 'hand cursor goes away when the pointer leaves the stage');
  await p.keyboard.up('Space');

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
