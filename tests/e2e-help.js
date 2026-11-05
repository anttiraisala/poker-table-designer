/* Browser checks for tooltips, the help window and the examples.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-help.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(800);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const o = PTD.random.opts; Object.keys(o).forEach(k => { if (/(Vary|Set)$/.test(k)) o[k] = false; }); o.shape = false; });

  // ---- tooltips on every button, on every tab
  const missing = [];
  for (const t of ['artwork', 'tables', 'guides', 'colours', 'fonts', 'random', 'export', 'project', 'settings']) {
    await p.click(`#tabs button[data-tab="${t}"]`);
    (await ev(() => PTD.help.untitled())).forEach(x => missing.push(t + ':' + x));
  }
  ok(missing.length === 0, 'every button, choice and switch has a tooltip: ' + missing.slice(0, 8).join(', '));
  ok((await p.getAttribute('[data-act="madd"][data-k="rayc"]', 'title')).length > 20, 'measurement buttons have a descriptive tooltip');
  ok((await p.getAttribute('#tabs button[data-tab="settings"]', 'title')).length > 10, 'tab buttons have tooltips');

  // ---- the help window
  await p.click('#tabs button[data-tab="guides"]');
  await p.keyboard.press('F1');
  ok(await p.isVisible('#helpBox') && /Measurements/.test(await p.textContent('#helpBody h2')), 'F1 opens the help at the topic of the current tab');
  await p.click('#helpNav [data-topic="keys"]');
  ok(/Keyboard/.test(await p.textContent('#helpBody h2')), 'the topic list switches topics');
  const topics = await ev(() => PTD.help.topics.length);
  ok(topics >= 12, 'there are help topics for the features: ' + topics);
  await p.keyboard.press('Escape');
  ok(!(await p.isVisible('#helpBox')), 'Esc closes the help');
  await p.click('#helpBtn');
  ok(await p.isVisible('#helpBox'), 'the Help button opens it');
  await p.click('#helpClose');
  ok(!(await p.isVisible('#helpBox')), 'Close closes it');

  // ---- examples (fast): each kind adds a real measurement through the real tools
  await ev(() => { PTD.help.speed = 0.02; });
  const kinds = { points: 'point to point', h: 'horizontal', v: 'vertical', near: 'shortest distance', rayc: 'ray', raya: 'ray' };
  for (const k of Object.keys(kinds)) {
    const n0 = await ev(() => PTD.core.state().measures.length);
    const started = await ev((k) => PTD.help.example(k), k);
    await p.waitForFunction(() => !PTD.help.running(), null, { timeout: 15000 });
    const n1 = await ev(() => PTD.core.state().measures.length);
    ok(started && n1 === n0 + 1, `example "${k}" adds one measurement (${n0} -> ${n1})`);
    ok(await ev(() => PTD.core.ui.tool === 'select' && !PTD.core.ui.dim), `after "${k}" the tool is back to select`);
  }
  // along a guide needs a guide
  const noGuide = await ev(() => PTD.help.example('span'));
  ok(noGuide === false, 'the along-a-guide example explains that it needs a guide when there is none');
  await ev(() => { const g = PTD.guides.add('x', 100); PTD.core.renderStage(); });
  const spanOk = await ev(() => { const sc = PTD.measure.exampleSteps('span'); return !sc.error || /guide/.test(sc.error); });
  ok(spanOk, 'the span example is built when a guide crosses something');
  const ms = await ev(() => PTD.core.state().measures.length), spanRun = await ev(() => PTD.help.example('span'));
  if (spanRun) await p.waitForFunction(() => !PTD.help.running(), null, { timeout: 15000 });
  ok(spanRun && (await ev(() => PTD.core.state().measures.length)) === ms + 1, 'the along-a-guide example adds a measurement along the guide');
  // pin and guide examples
  const m0 = await ev(() => PTD.core.state().measures.length);
  await ev(() => PTD.help.example('pin')); await p.waitForFunction(() => !PTD.help.running(), null, { timeout: 15000 });
  ok((await ev(() => PTD.core.state().measures.length)) === m0 + 1, 'the Pin example pins a measurement');
  const g0 = await ev(() => PTD.core.state().guides.length);
  await ev(() => PTD.help.example('guide')); await p.waitForFunction(() => !PTD.help.running(), null, { timeout: 15000 });
  ok((await ev(() => PTD.core.state().guides.length)) === g0 + 1, 'the guide example places a guide');
  // Undo removes the result
  await p.keyboard.press('Control+z');
  ok((await ev(() => PTD.core.state().guides.length)) === g0, 'Undo removes what the example made');

  // ---- the panel button and stopping an example
  await p.click('#tabs button[data-tab="guides"]');
  await ev(() => { PTD.help.speed = 1; });
  const n2 = await ev(() => PTD.core.state().measures.length);
  await p.click('[data-act="mexample"]');
  ok(await ev(() => PTD.help.running()) && await p.isVisible('#demoPtr'), 'Generate example starts a slow example with a visible pointer');
  await p.keyboard.press('x');
  ok(await ev(() => !PTD.help.running()) && !(await p.isVisible('#demoPtr')), 'a key press stops the example');
  ok((await ev(() => PTD.core.state().measures.length)) === n2, 'a stopped example leaves nothing behind');
  ok(await ev(() => PTD.core.ui.tool === 'select'), 'and the tool is back to select');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? fails + ' FAILED' : 'all passed'); await b.close(); process.exit(fails ? 1 : 0);
})();
