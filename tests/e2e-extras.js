/* Browser checks for the randomizer history, selection after Random, the wrap line switch, pot, burn cards and muck, and the name inventor.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-extras.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(500);
  /* the randomizer's shipped defaults change many things; these tests start from a neutral set */
  await p.evaluate(() => { const o = PTD.random.opts; Object.keys(o).forEach(k => { if (/(Vary|Set)$/.test(k)) o[k] = false; }); o.shape = false; o.betVary = true; const c = PTD.core.state().cards; c.potShow = c.burnShow = c.muckShow = false; PTD.core.renderPanels(); PTD.core.renderStage(); });
  const ev = (f, a) => p.evaluate(f, a);
  const sig = () => ev(() => JSON.stringify(PTD.core.state().layers.map(l => [l.font, l.size, l.x, l.y, l.ls, l.weight])));
  const nothingSelected = () => ev(() => { const s = PTD.core.state(), u = PTD.core.ui; return !s.selected && Object.keys(u.extra).length === 0 && !u.selTable && u.selNode == null && !u.selGuide; });

  // ---- nothing selected after Random
  await p.click('#tabs button[data-tab="artwork"]');
  await ev(() => { PTD.core.state().selected = 'l1'; PTD.core.renderPanels(); PTD.core.renderStage(); });
  await p.click('#tabs button[data-tab="random"]');
  await p.click('[data-act="randonce"]'); await p.waitForTimeout(1500);
  ok(await nothingSelected(), 'nothing is selected after Shuffle once');
  await ev(() => { PTD.core.state().selected = 'l1'; });
  await p.click('[data-act="randcreate"]'); await p.waitForTimeout(2000);
  ok(await nothingSelected(), 'nothing is selected after Create casino');
  await p.click('[data-act="randonce"]'); await p.waitForTimeout(1500);

  // ---- every round is its own undo step
  await p.fill('[data-scope="rand"][data-key="interval"]', '0.5');
  await p.dispatchEvent('[data-scope="rand"][data-key="interval"]', 'change');
  const seen = [await sig()];
  await p.click('[data-act="randstart"]');
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) { const s = await sig(); if (s !== seen[seen.length - 1]) seen.push(s); await p.waitForTimeout(60); }
  await p.click('[data-act="randstop"]'); await p.waitForTimeout(300);
  const last = await sig(); if (last !== seen[seen.length - 1]) seen.push(last);
  ok(seen.length >= 4, 'the run made several rounds: ' + seen.length);
  ok(await nothingSelected(), 'nothing is selected after a run');
  await p.click('#undoBtn');
  ok(await sig() === seen[seen.length - 2], 'one Undo goes back exactly one round');
  ok(await nothingSelected(), 'nothing is selected after Undo');
  await p.click('#undoBtn');
  ok(await sig() === seen[seen.length - 3], 'a second Undo goes back another round');
  await p.click('#redoBtn');
  ok(await sig() === seen[seen.length - 2], 'Redo goes forward one round');
  await p.click('[data-act="randonce"]'); await p.waitForTimeout(1500);
  ok(await ev(() => document.getElementById('redoBtn').disabled), 'a new round after stepping back drops the rounds ahead');
  // Undo while running stops the run and steps back
  await p.click('[data-act="randstart"]'); await p.waitForTimeout(1800);
  await p.click('#undoBtn');
  ok(!(await ev(() => PTD.random.isRunning())), 'Undo stops a running randomizer');

  // ---- wrap line
  const dashes = () => ev(() => [...document.querySelectorAll('#stage path')].filter(x => x.getAttribute('stroke-dasharray') === '7 5').length);
  ok(await dashes() === 1, 'the dashed wrap line is shown by default');
  await p.uncheck('#wrapToggle');
  ok(await dashes() === 0 && await ev(() => PTD.core.state().tables[0].wrapShow === false), 'the toolbar switch hides the wrap line');
  await p.check('#wrapToggle');
  ok(await dashes() === 1, 'the toolbar switch shows the wrap line again');
  await p.click('#tabs button[data-tab="tables"]');
  await p.click('[data-act="tselect"][data-id="t1"]');
  await p.uncheck('#tablesPane [data-key="wrapShow"]');
  ok(await dashes() === 0 && !(await p.isChecked('#wrapToggle')), 'the table checkbox hides the wrap line and the toolbar follows');
  ok(await ev(() => JSON.stringify(PTD.core.toPartJSON('tables', false)).includes('"wrapShow":false')), 'the wrap line setting is part of the tables file');
  await p.check('#tablesPane [data-key="wrapShow"]');

  // ---- pot, burn cards, muck
  await p.click('#tabs button[data-tab="artwork"]');
  const count = (sel) => ev(s => document.querySelectorAll(s).length, sel);
  const circles0 = await count('#stage circle'), rects0 = await count('#stage rect');
  await p.check('[data-key="potShow"]');
  ok(await count('#stage circle') >= circles0 + 9 * 3, 'Show pot draws chips');
  const potSig = () => ev(() => [...document.querySelectorAll('#stage circle')].map(c => c.getAttribute('cx')).join());
  const ps = await potSig(); await p.click('[data-act="potseed"]');
  ok(await potSig() !== ps, 'New chip pile changes the pile');
  const px0 = (await ev(() => document.querySelector('#stage circle[stroke-dasharray]').getAttribute('cx')));
  await p.fill('[data-scope="cards"][data-key="potX"]', '-500'); await p.dispatchEvent('[data-scope="cards"][data-key="potX"]', 'input');
  ok(Number(await ev(() => document.querySelector('#stage circle[stroke-dasharray]').getAttribute('cx'))) !== Number(px0), 'the pot offset moves the chips');
  const r1 = await count('#stage rect'); await p.check('[data-key="burnShow"]');
  ok(await count('#stage rect') >= r1 + 6, 'Show burn cards draws three card backs');
  const r2 = await count('#stage rect'); await p.check('[data-key="muckShow"]');
  ok(await count('#stage rect') >= r2 + 16, 'Show muck draws a pile of card backs');
  await p.uncheck('[data-key="potShow"]'); await p.uncheck('[data-key="burnShow"]'); await p.uncheck('[data-key="muckShow"]');
  await p.uncheck('[data-key="show"][data-scope="cards"]');
  ok(await count('#stage circle') <= circles0, 'everything can be switched off again');
  await p.check('[data-key="show"][data-scope="cards"]');
  // randomizer leaves them alone
  await p.check('[data-key="muckShow"]'); await p.click('#tabs button[data-tab="random"]');
  await p.click('[data-act="randonce"]'); await p.waitForTimeout(1500);
  ok(await ev(() => PTD.core.state().cards.muckShow === true && PTD.core.state().cards.muckSeed === 11), 'the randomizer does not touch the decorations');
  await ev(() => { PTD.core.state().cards.muckShow = false; PTD.core.state().cards.potShow = false; });
  // cut export keeps working with decorations on
  await ev(() => { PTD.core.state().cards.potShow = true; PTD.core.state().cards.burnShow = true; PTD.core.state().cards.muckShow = true; PTD.core.renderStage(); });
  await p.click('#tabs button[data-tab="export"]');
  ok(await p.isVisible('#exportPane'), 'the export tab renders with decorations on');

  // ---- name inventor
  const inv = await ev(() => {
    const R = PTD.random; let rep = 0, estTwice = 0, horse = 0, unicorn = 0, helperClash = 0;
    for (let i = 0; i < 1500; i++) {
      const n = R.inventName(); if (R.repeats([n])) rep++; if (/Horse/.test(n)) horse++; if (/Unicorn/.test(n)) unicorn++;
      const h = R.inventHelpers(n);
      if (h.filter(x => /^EST\./.test(x)).length > 1) estTwice++;
      if (R.repeats([n].concat(h))) helperClash++;
    }
    return { rep, estTwice, horse, unicorn, helperClash };
  });
  const kinds = await ev(() => {
    const R = PTD.random, seen = { owner: 0, of: 0, hand: 0, deuce: 0, two: 0, badApos: 0, themed: 0 };
    for (let i = 0; i < 12000; i++) {
      const n = R.inventName();
      if (/'s /.test(n)) seen.owner++;
      if (/ of /.test(n)) seen.of++;
      if (/Snowman|Big Slick|Rockets|Seven Deuce/.test(n)) seen.hand++;
      if (/^Deuce of /.test(n)) seen.deuce++;
      if (/^Two of /.test(n)) seen.two++;
      if (/(Devil|Heaven|Paradise|Gambler|Meadow)/.test(n)) seen.themed++;
      if (/s's|'s'|''|'$|^'/.test(n) || /Paradise's/.test(n)) seen.badApos++;
    }
    return seen;
  });
  ok(kinds.owner > 100 && kinds.of > 100 && kinds.hand > 50 && kinds.themed > 100, 'the inventor makes possessive names, "X of Y" names, hand names and themed names');
  ok(kinds.deuce > 0 && kinds.two > 0, 'the two of a suit is called both Two and Deuce');
  ok(kinds.badApos === 0, 'no malformed possessive forms');
  // plurals, plural possessives, hand names, Pair of / Set of, word splitting and reading order
  const more = await ev(() => {
    const R = PTD.random, seen = { plPoss: 0, plural: 0, pair: 0, royal: 0, fullHouseHouse: 0, badPl: 0 };
    for (let i = 0; i < 12000; i++) {
      const n = R.inventName();
      if (/s' /.test(n)) seen.plPoss++;
      if (/^(Pair|Set) of \w+s/.test(n)) seen.pair++;
      if (/^Royal Flush/.test(n)) seen.royal++;
      if (/(Devils|Aces|Lions|Roses|Dragons|Falcons)\b/.test(n) && !/' /.test(n)) seen.plural++;
      if (/House House|Royal Flush Royale|ss\b.*'s|ys\b|ies'?s/.test(n) && /House House|Royale/.test(n) && /Royal Flush Royale|House House/.test(n)) seen.fullHouseHouse++;
      if (/\w+s's|s'' |\w+'s' /.test(n)) seen.badPl++;
    }
    return seen;
  });
  ok(more.plPoss > 20 && more.plural > 20 && more.pair > 20 && more.royal > 5, 'plural possessives, plurals, Pair of / Set of and Royal Flush names appear');
  ok(more.fullHouseHouse === 0 && more.badPl === 0, 'no "Full House House", "Royal Flush Royale" or malformed possessives');
  ok(await ev(() => { const w = PTD.random.nameWords; return JSON.stringify(w('Seven of Spades')) === '["Seven of","Spades"]' && JSON.stringify(w('Le Roi Rouge')) === '["Le Roi","Rouge"]' && JSON.stringify(w('Four of a Kind')) === '["Four of","a Kind"]' && JSON.stringify(w("Devil's Gambit")) === '["Devil\'s","Gambit"]'; }), 'small words are glued to a neighbour so they do not become big texts');
  const ord = await ev(() => {
    const R = PTD.random, G = PTD.geom; let bad = 0, styles = {};
    const poly = [[-900, -450], [900, -450], [900, 450], [-900, 450]];
    for (let t = 0; t < 600; t++) {
      const k = 2 + (t % 3), items = [];
      for (let i = 0; i < k; i++) items.push({ role: 'main', size: 150 + Math.random() * 30, w: 300 + Math.random() * 400, ls: 0, text: 'W' + i });
      const st = R._layout(items, { poly, cx: 0, cy: 0, w: 1800, h: 900 }); styles[st] = 1;
      for (let i = 0; i + 1 < k; i++) {
        const a = items[i], b = items[i + 1], dy = b.y - a.y;
        if (dy < -1e-6) bad++;
        else if (dy < 0.2 * a.size && !(b.x > a.x)) bad++;
      }
    }
    return { bad, styles: Object.keys(styles).sort().join() };
  });
  ok(ord.bad === 0 && /row/.test(ord.styles) && /stack/.test(ord.styles) && /scatter/.test(ord.styles), 'words keep their order: the first is never below the next, and at the same height it is to the left (' + ord.styles + ')');
  // seven deadly sins, longer names
  const sins = await ev(() => {
    const R = PTD.random, base = ['Pride', 'Greed', 'Lust', 'Envy', 'Gluttony', 'Wrath', 'Sloth', 'Wealth'], adj = ['Proud', 'Greedy', 'Lustful', 'Envious', 'Gluttonous', 'Wrathful', 'Slothful', 'Wealthy'];
    const hb = {}, ha = {}; let long4 = 0, theOwn = 0, ofHand = 0, ofKings = 0, bad = 0, max = 0;
    for (let i = 0; i < 20000; i++) {
      const n = R.inventName(), words = n.split(' ').length; if (words > max) max = words;
      base.forEach(b => { if (new RegExp('\\b' + b + "(\\b|')").test(n)) hb[b] = 1; });
      adj.forEach(a => { if (new RegExp('\\b' + a + '\\b').test(n)) ha[a] = 1; });
      if (words >= 4) long4++;
      if (/^The \w+'s \w+s$/.test(n)) theOwn++;
      if (/ of (Royal Flush|Full House|Straight Flush|Two Pair|Broadway)/.test(n)) ofHand++;
      if (/^(The )?(Club|House|Palace|Temple|Court|Hall|Order|Society|Lounge|Den) of Kings$/.test(n)) ofKings++;
      if (R.repeats([n]) || /The The|of of/.test(n)) bad++;
    }
    return { nb: Object.keys(hb).length, na: Object.keys(ha).length, long4, theOwn, ofHand, ofKings, bad, max };
  });
  ok(sins.nb === 8 && sins.na === 8, 'all seven sins and Wealth occur as nouns and as adjectives: ' + sins.nb + ' / ' + sins.na);
  ok(sins.long4 > 100 && sins.theOwn > 20 && sins.ofHand > 20 && sins.ofKings > 5 && sins.bad === 0 && sins.max <= 6, 'three and four word names occur ("Club of Royal Flush", "The Devil\'s Saints", "House of Kings"): ' + JSON.stringify(sins));
  ok(await ev(() => { const w = PTD.random.nameWords; return JSON.stringify(w("The Devil's Saints")) === '["The Devil\'s","Saints"]' && JSON.stringify(w('Club of Royal Flush')) === '["Club of","Royal","Flush"]'; }), 'long names split into reading-order texts');
  const ws = await ev(() => {
    const R = PTD.random, want = ['Hooker', 'Bitch', 'Dog', 'Hooter', 'Hooters', 'Boob', 'Boobs', 'Silk', 'Velvet', 'Sun', 'Palm', 'Beach', 'Oriental', 'Universal', 'Universe', 'Public', 'Private', 'Palm Beach'], got = {};
    for (let i = 0; i < 40000; i++) { const n = R.inventName(); want.forEach(w => { if (!got[w] && new RegExp('(^| )' + w + "( |'|$)").test(n)) got[w] = 1; }); }
    return want.filter(w => !got[w]);
  });
  ok(ws.length === 0, 'the added words all occur in invented names (missing: ' + ws.join(', ') + ')');
  ok(inv.rep === 0, 'names never repeat a word');
  ok(inv.estTwice === 0, 'EST. appears at most once');
  ok(inv.helperClash === 0, 'helper texts never repeat a word of the name or of each other');
  ok(inv.horse > 0 && inv.unicorn > 0, 'Horse and Unicorn are in the vocabulary: ' + inv.horse + ', ' + inv.unicorn);

  // Lines & cards opens and closes with the same arrow button as a text panel
  {
    await ev(() => { PTD.core.setTab('artwork'); PTD.core.renderPanels(); });
    ok(await ev(() => document.getElementById('bandPanel').open), 'Lines & cards starts open');
    await p.click('#bandPanel [data-act="bandtoggle"]');
    ok(await ev(() => !document.getElementById('bandPanel').open && document.querySelector('#bandPanel [data-act="bandtoggle"]').textContent === '\u25BC'), 'the arrow closes Lines & cards and turns down');
    await p.click('#bandPanel [data-act="bandtoggle"]');
    ok(await ev(() => document.getElementById('bandPanel').open && document.querySelector('#bandPanel [data-act="bandtoggle"]').getAttribute('aria-expanded') === 'true'), 'the arrow opens Lines & cards again');
  }

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
