/* Browser checks for the word lists (universal and project), the settings/project split and the project tabs.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-words.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(800);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const o = PTD.random.opts; Object.keys(o).forEach(k => { if (/(Vary|Set)$/.test(k)) o[k] = false; }); o.shape = false; });

  // ---- shipped words include the newer ones
  const names = await ev(() => { const out = []; for (let i = 0; i < 6000; i++) out.push(PTD.random.inventName()); return out; });
  const any = re => names.some(n => re.test(n));
  ok(any(/\bStallion/i) && any(/\bKnight/i) && any(/\bNight\b/i) && any(/\bArabia/i), 'Stallion, Knight, Night and Arabia are used in names');
  ok(any(/Knight's|Knights'/) && any(/Stallion's|Stallions'/), 'Knight and Stallion take possessives');
  ok(names.some(n => n === 'Arabian Nights'), 'Arabian Nights is a phrase');

  // ---- project words only: the full name is always made
  await ev(() => { PTD.core.applyWords('project', { fullNames: ['Vanha Paja'], useUniversal: false }); });
  const only = await ev(() => { const s = new Set(); for (let i = 0; i < 50; i++) s.add(PTD.random.inventName()); return [...s]; });
  ok(only.length === 1 && only[0] === 'Vanha Paja', 'a project without universal words makes only its full name: ' + JSON.stringify(only));
  ok(await ev(() => JSON.parse(JSON.stringify(PTD.core.toJSON(false))).words.useUniversal === false), 'the project JSON records useUniversal');

  // ---- universal switched on again merges both, unique
  await ev(() => { PTD.core.state().words.useUniversal = true; PTD.core.state().words.words.adjectives = ['Greedy', 'Zesty']; });
  const bank = await ev(() => { const b = PTD.words.bank(); return { z: b.adjectives.indexOf('Zesty') >= 0, g: b.adjectives.filter(a => a.toLowerCase() === 'greedy').length, full: b.fullNames.indexOf('Vanha Paja') >= 0 }; });
  ok(bank.z && bank.g === 1 && bank.full, 'the bank is the unique union of universal and project words');

  // ---- universal override, export shape and reset
  const r1 = await ev(() => PTD.core.applyWords('universal', { fullNames: ['Only One'] }));
  ok(r1.ok, 'a universal words text is accepted: ' + r1.msg);
  await ev(() => { const w = PTD.core.state().words; w.useUniversal = true; w.words = PTD.words.empty(); });
  ok(await ev(() => { const s = new Set(); for (let i = 0; i < 30; i++) s.add(PTD.random.inventName()); return s.size === 1 && s.has('Only One'); }), 'the user universal list replaces the shipped one');
  ok(await ev(() => !!PTD.core.cfg().words), 'the settings keep the override');
  await ev(() => PTD.core.applyWords('reset'));
  ok(await ev(() => !PTD.core.cfg().words && PTD.words.universal().adjectives.length > 20), 'reset brings back the shipped words');
  const bad = await ev(() => PTD.core.applyWords('universal', { adjectives: [] }));
  ok(!bad.ok, 'an empty universal list is refused');

  // ---- settings versus project
  const cfgText = await ev(() => JSON.stringify(PTD.core.toPartJSON('settings')));
  ok(!/showGrid|palette|randomizer/.test(cfgText) && /units/.test(cfgText), 'the settings do not hold view switches, palette or randomizer options');
  const prj = await ev(() => PTD.core.toJSON(false));
  ok(prj.view && prj.randomizer && prj.cutter && prj.palette && prj.words, 'the project holds view, randomizer, cutter, palette and words');

  // ---- project tabs
  await ev(() => { PTD.core.state().name = 'Alpha'; PTD.core.state().words.words.adjectives = ['Alphaish']; PTD.core.cfg().showGrid = true; PTD.random.opts.interval = 9; PTD.core.save(); });
  await p.click('[data-tabact="new"]');
  ok(await ev(() => PTD.core.tabs().length === 2 && PTD.core.state().name !== 'Alpha'), 'New tab opens a fresh project');
  ok(await ev(() => PTD.core.cfg().showGrid === false && PTD.random.opts.interval === 5 && PTD.core.state().words.words.adjectives.length === 0), 'the new tab has its own view, randomizer options and words');
  await ev(() => { PTD.core.state().name = 'Beta'; PTD.core.state().layers[0].text = 'Changed'; PTD.core.save(); });
  await p.click('.ptab:nth-child(1) .ptabname');
  ok(await ev(() => PTD.core.state().name === 'Alpha' && PTD.core.cfg().showGrid === true && PTD.random.opts.interval === 9), 'switching back restores the first project with its view and options');
  await ev(() => { PTD.core.state().layers[0].text = 'One'; PTD.core.save(); });
  await p.click('#undoBtn');
  ok(await ev(() => PTD.core.state().layers[0].text !== 'One' && PTD.core.cfg().showGrid === true), 'undo is per tab and does not touch the view switches');
  await p.click('.ptab:nth-child(2) .ptabname');
  ok(await ev(() => PTD.core.state().layers[0].text === 'Changed'), 'the second tab kept its own changes');
  await p.click('[data-tabact="dup"]');
  ok(await ev(() => PTD.core.tabs().length === 3 && /Beta copy/.test(PTD.core.state().name)), 'Duplicate tab copies the project next to the original');
  await p.click('[data-tabact="left"]');
  ok(await ev(() => PTD.core.tabs().map(t => t.name)[1] === 'Beta copy' || PTD.core.tabs()[1].id === PTD.core.activeTab()), 'a tab can be moved');
  await p.waitForTimeout(800);
  const saved = await ev(() => JSON.parse(localStorage.getItem('poker-table-designer-tabs-v1')));
  ok(saved.ids.length === 3 && (await ev(ids => ids.every(id => !!localStorage.getItem('poker-table-designer-tab-' + id)), saved.ids)), 'every tab has its own autosave key');
  await p.reload(); await p.waitForTimeout(800);
  ok(await ev(() => PTD.core.tabs().length === 3 && PTD.core.tabs().some(t => t.name === 'Alpha')), 'tabs come back after a reload');
  await ev(() => { PTD.random.opts.interval = 1; });
  await p.click('[data-act="randstart"]').catch(() => {});
  await ev(() => PTD.random.start());
  await ev(() => PTD.core.switchTab(PTD.core.tabs()[0].id === PTD.core.activeTab() ? PTD.core.tabs()[1].id : PTD.core.tabs()[0].id));
  ok(await ev(() => !PTD.random.isRunning()), 'the randomizer stops when another tab is shown');
  await p.click('.ptabx >> nth=0');
  ok(await ev(() => PTD.core.tabs().length === 2), 'a tab can be closed');
  await p.click('.ptabx >> nth=0'); await p.click('.ptabx >> nth=0');
  ok(await ev(() => PTD.core.tabs().length === 1), 'closing the last tab leaves one empty project');

  // ---- New project always opens a new tab; closing: untouched tabs close silently, touched ones ask
  let dialogs = [];
  p.removeAllListeners('dialog'); p.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  const n0 = await ev(() => PTD.core.tabs().length);
  await ev(() => { document.getElementById('newBtn').click(); });
  ok(await ev(n => PTD.core.tabs().length === n + 1, n0) && dialogs.length === 0, 'New project opens a new tab without a question');
  await p.click('.ptab.on .ptabx');
  ok(await ev(n => PTD.core.tabs().length === n + 1, n0) === false && dialogs.length === 0, 'an untouched tab closes without a question');
  await ev(() => { PTD.core.state().layers[0].text = 'Touched'; PTD.core.save(); });
  await p.click('.ptab.on .ptabx');
  ok(dialogs.length === 1 && /sure/i.test(dialogs[0]) && await ev(() => PTD.core.state().layers[0].text === 'Touched'), 'a touched tab asks "Are you sure" and stays when dismissed');
  p.removeAllListeners('dialog'); p.on('dialog', d => d.accept());

  // ---- importing words: asks where they go
  const wordsText = JSON.stringify({ adjectives: ['Quokka'] });
  await ev(t => { PTD.core.applyPart('universal', t); }, wordsText);
  ok(await p.isVisible('#wordsAsk [data-choice="universal"]') && !(await p.isVisible('#wordsAsk [data-choice="project"]')), 'importing into the universal window asks (no project-only choice)');
  await p.click('#wordsAsk [data-choice="universal-add"]');
  ok(await ev(() => PTD.words.universal().adjectives.indexOf('Quokka') >= 0 && PTD.words.universal().adjectives.length > 20), 'Add to the universal list keeps the shipped words and adds the new ones');
  await ev(() => PTD.core.applyWords('reset'));
  await ev(() => PTD.core.addTab()); await ev(() => PTD.core.addTab());
  await ev(t => { PTD.core.applyPart('universal', t); }, wordsText);
  await p.click('#wordsAsk [data-choice="all-add"]');
  const copies = await ev(() => { PTD.core.tabs(); const out = []; PTD.core.tabs().forEach(t => out.push(JSON.parse(t.id === PTD.core.activeTab() ? JSON.stringify(PTD.core.toJSON(false)) : t.json).words.adjectives.indexOf('Quokka') >= 0)); return out; });
  ok(copies.length >= 3 && copies.every(Boolean) && await ev(() => !PTD.core.cfg().words), 'Copy into every open project adds the words to each tab and leaves the universal list alone');
  await ev(t => { PTD.core.loadText(t); }, wordsText);
  ok(await p.isVisible('#wordsAsk [data-choice="project"]'), 'a words text pasted into the general paste place also offers this project only');
  await p.click('#wordsAsk [data-choice="cancel"]');
  ok(await ev(() => PTD.core.kindOf({ tables: [] }) === 'project' && PTD.core.kindOf({ fullNames: [] }) === 'words' && PTD.core.kindOf({ units: 'mm' }) === 'settings'), 'the kind of a JSON text is found from its keys');

  ok(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
