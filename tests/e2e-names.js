/* Browser checks for the casino name of the project and the randomizer name styles (split and monogram).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-names.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(800);
  const ev = (f, a) => p.evaluate(f, a);
  const reset = () => ev(() => {
    const o = PTD.random.opts; Object.keys(o).forEach(k => { if (/(Vary|Set)$/.test(k)) o[k] = false; }); o.shape = false; o.words = false; o.helperFonts = true; o.styleSet = true; o.styleVal = 'asis';
  });
  await reset();

  // ---- the project holds the casino name
  ok(await ev(() => PTD.core.state().casinoName === 'Molino Royale'), 'a new project has the casino name Molino Royale');
  ok(await ev(() => PTD.core.state().layers.filter(l => l.nameWord).map(l => l.text).join(' ') === 'Molino Royale'), 'the two big default texts are part of the casino name, Casino is not');
  ok(await ev(() => PTD.core.toJSON(false).artwork.casinoName === 'Molino Royale'), 'the project JSON holds artwork.casinoName');
  ok(await p.isVisible('#namePanel input[data-key="casinoName"]'), 'the Artwork tab has the casino name field');
  await p.fill('#namePanel input[data-key="casinoName"]', 'Club of Royal Flush');
  ok(await ev(() => PTD.core.state().casinoName === 'Club of Royal Flush'), 'typing in the field changes the project casino name');
  ok(await ev(() => PTD.core.state().layers[0].text === 'Molino'), 'the name field does not touch the text objects');
  // an old file without the field and the flags: the big texts are the name
  const keep = await ev(() => JSON.stringify(PTD.core.toJSON(false)));
  const old = await ev(() => {
    const o = PTD.core.toJSON(false); delete o.artwork.casinoName; o.artwork.layers.forEach(l => { delete l.nameWord; });
    o.artwork.layers = [{ text: 'Big', size: 200 }, { text: 'Also', size: 150 }, { text: 'tiny', size: 20 }];
    PTD.core.loadText(JSON.stringify(o)); const s = PTD.core.state();
    return { name: s.casinoName, flags: s.layers.map(l => l.nameWord) };
  });
  ok(old.name === 'Big Also' && old.flags.join() === 'true,true,false', 'an old file gets its casino name from the big texts: ' + JSON.stringify(old));
  await ev(t => PTD.core.loadText(t), keep);

  // ---- initials
  const ini = await ev(() => { const f = PTD.random.initials; return [f('The Club of Royal Flush', true), f('The Club of Royal Flush', false), f('Le Diable', true), f('Le Diable', false), f('Seven of Spades', true), f('Molino Royale', false)].map(a => a.join('')); });
  ok(ini.join() === 'TRF,CRF,L,D,SS,MR', 'initials follow the nameWords units, the leading article shown or hidden: ' + ini.join());

  // ---- split pieces: any number of neighbouring words, "of" included
  const sp = await ev(() => { const seen = {}, okJoin = []; for (let i = 0; i < 400; i++) { const a = PTD.random.splitPieces('Club of Royal Flush'); seen[a.length] = 1; okJoin.push(a.join(' ') === 'Club of Royal Flush'); } return { counts: Object.keys(seen).join(), allOk: okJoin.every(Boolean), split: (() => { for (let i = 0; i < 400; i++) if (PTD.random.splitPieces('Club of Royal Flush').indexOf('of') >= 0) return true; return false; })() }; });
  ok(sp.counts === '1,2,3,4' && sp.allOk, 'a four-word name is cut into 1, 2, 3 or 4 pieces that always read as the name');
  ok(sp.split, '"of" can be a piece of its own');

  // ---- a split round
  await ev(() => { const s = PTD.core.state(); s.casinoName = 'Club of Royal Flush'; PTD.core.save(); });
  const nBefore = await ev(() => PTD.core.state().layers.length);
  await ev(() => { PTD.random.opts.styleSet = true; PTD.random.opts.styleVal = 'split'; PTD.random.once(); });
  await p.waitForTimeout(3500);
  const sr = await ev(() => {
    const s = PTD.core.state(), gen = s.layers.filter(l => l.gen), own = s.layers.filter(l => l.nameWord);
    return { gen: gen.map(l => ({ t: l.text, x: l.x, y: l.y, c: l.color, kind: l.gen })), ownHidden: own.every(l => l.hidden && l.styleHidden), ids: s.layers.every((l, i) => l.id === 'l' + (i + 1)), at: s.band.at, n: s.layers.length, helper: s.layers.filter(l => l.text === 'Casino')[0].hidden, baseColor: own[0].color };
  });
  ok(sr.gen.length >= 1 && sr.gen.every(g => g.kind === 'split') && sr.gen.map(g => g.t).join(' ') === 'Club of Royal Flush', 'a split round makes pieces that read as the casino name: ' + JSON.stringify(sr.gen.map(g => g.t)));
  ok(sr.ownHidden && !sr.helper, 'the user name texts are hidden by the style, the helper text stays shown');
  ok(sr.ids && sr.at === sr.n, 'layer ids are renumbered and the lines stay above all texts');
  ok(sr.gen.every(g => g.c === sr.baseColor), 'the pieces take the colour of the name texts');
  let ordered = true; for (let i = 0; i + 1 < sr.gen.length; i++) { const a = sr.gen[i], c = sr.gen[i + 1]; if (a.y > c.y + 25 || (Math.abs(a.y - c.y) <= 25 && a.x > c.x)) ordered = false; }
  ok(ordered, 'the pieces keep the reading order');
  // many rounds keep the rule
  let allOrdered = true, manyPieces = false;
  for (let r = 0; r < 12; r++) {
    await ev(() => PTD.random.once()); await p.waitForTimeout(3200);
    const g = await ev(() => PTD.core.state().layers.filter(l => l.gen).map(l => ({ t: l.text, x: l.x, y: l.y })));
    if (g.map(q => q.t).join(' ') !== 'Club of Royal Flush') allOrdered = false;
    for (let i = 0; i + 1 < g.length; i++) { if (g[i].y > g[i + 1].y + 25 || (Math.abs(g[i].y - g[i + 1].y) <= 25 && g[i].x > g[i + 1].x)) allOrdered = false; }
    if (g.length > 1) manyPieces = true;
  }
  ok(allOrdered && manyPieces, 'twelve more split rounds: the text and the reading order always hold, and the name is cut at least once');

  // ---- one undo step per round; restore button
  await ev(() => { PTD.random.opts.styleVal = 'split'; PTD.random.once(); }); await p.waitForTimeout(3200);
  await p.click('#undoBtn');
  ok(await ev(() => PTD.core.state().layers.filter(l => l.gen).length > 0 || PTD.core.state().layers.length === 3), 'Undo steps back one round at a time');
  await ev(() => { PTD.random.opts.styleVal = 'split'; PTD.random.once(); }); await p.waitForTimeout(3200);
  await p.click('#namePanel [data-act="namerestore"]');
  const rest = await ev(() => { const s = PTD.core.state(); return { gen: s.layers.filter(l => l.gen).length, hid: s.layers.filter(l => l.hidden).length, n: s.layers.length, at: s.band.at, ids: s.layers.every((l, i) => l.id === 'l' + (i + 1)) }; });
  ok(rest.gen === 0 && rest.hid === 0 && rest.n === nBefore && rest.at === rest.n && rest.ids, 'Back to my own texts removes the made texts and shows the user texts');
  await p.click('#undoBtn');
  ok(await ev(() => PTD.core.state().layers.some(l => l.gen)), 'Back to my own texts is one undo step');
  await p.click('#redoBtn');
  ok(await ev(() => !PTD.core.state().layers.some(l => l.gen)), 'and Redo repeats it');

  // ---- a monogram round
  await ev(() => { PTD.core.state().casinoName = 'The Club of Royal Flush'; PTD.random.opts.styleVal = 'mono'; });
  let monoOk = true, sawShort = false, sawLong = false, haloOk = true, last = null;
  for (let r = 0; r < 6; r++) {
    await ev(() => PTD.random.once()); await p.waitForTimeout(3200);
    last = await ev(() => PTD.core.state().layers.filter(l => l.gen).map(l => ({ t: l.text, outline: l.outline, x: l.x, y: l.y, size: l.size, kind: l.gen })));
    const letters = last.slice(0, -1).map(l => l.t).join(''), full = last[last.length - 1];
    if (!(letters === 'TRF' || letters === 'CRF') || full.t !== 'The Club of Royal Flush' || last.some(l => l.kind !== 'mono')) monoOk = false;
    if (letters === 'TRF') sawLong = true; if (letters === 'CRF') sawShort = true;
    if (!full.outline) haloOk = false;
    const ini = last.slice(0, -1); for (let i = 0; i + 1 < ini.length; i++) if (ini[i].y > ini[i + 1].y + 25 || ini[i].x >= ini[i + 1].x) monoOk = false;
  }
  ok(monoOk, 'monogram rounds make big initials in reading order and the full name last (on top): ' + JSON.stringify(last.map(l => l.t)));
  ok(haloOk, 'the small full name has an outline that knocks a hole in what lies below');
  ok(sawLong || sawShort, 'the leading article is shown or hidden at random (saw TRF: ' + sawLong + ', CRF: ' + sawShort + ')');
  ok(await ev(() => { const s = PTD.core.state(); return s.layers.filter(l => l.gen).length >= 4 && s.layers.every((l, i) => l.id === 'l' + (i + 1)) && s.band.at === s.layers.length; }), 'initials, the name and the lines are in a consistent layer order');

  // ---- the style survives save and load, and as written removes it
  const rt = await ev(() => { const o = JSON.parse(JSON.stringify(PTD.core.toJSON(false))); PTD.core.loadText(JSON.stringify(o)); const s = PTD.core.state(); return { gen: s.layers.filter(l => l.gen).length, hid: s.layers.filter(l => l.styleHidden).length, name: s.casinoName }; });
  ok(rt.gen >= 4 && rt.hid === 2 && rt.name === 'The Club of Royal Flush', 'the made texts, the hidden flags and the name are saved in the project');
  await ev(() => { PTD.random.opts.styleVal = 'asis'; PTD.random.once(); }); await p.waitForTimeout(3200);
  ok(await ev(() => { const s = PTD.core.state(); return !s.layers.some(l => l.gen) && s.layers.filter(l => l.nameWord).every(l => !l.hidden); }), 'a round with the style “as written” brings the user texts back');

  // ---- Vary picks all three styles over many rounds
  await ev(() => { PTD.random.opts.styleSet = false; PTD.random.opts.styleVary = true; });
  const seen = {};
  for (let r = 0; r < 14; r++) {
    await ev(() => PTD.random.once()); await p.waitForTimeout(3100);
    const k = await ev(() => { const g = PTD.core.state().layers.filter(l => l.gen)[0]; return g ? g.gen : 'asis'; }); seen[k] = 1;
  }
  ok(seen.asis && seen.split && seen.mono, 'Vary uses all three styles over 14 rounds: ' + Object.keys(seen).join());

  // ---- the fonts of the other texts
  await ev(() => { PTD.random.opts.styleVary = false; PTD.random.opts.styleSet = true; PTD.random.opts.styleVal = 'asis'; PTD.random.opts.helperFonts = false; const h = PTD.core.state().layers.filter(l => l.text === 'Casino')[0]; h.font = 'Josefin Sans'; h.weight = 300; h.ls = 12; });
  let kept = true, moved = false;
  for (let r = 0; r < 4; r++) {
    await ev(() => PTD.random.once()); await p.waitForTimeout(3100);
    const h = await ev(() => { const l = PTD.core.state().layers.filter(l => l.text === 'Casino')[0]; return { font: l.font, w: l.weight, ls: l.ls, t: l.text, x: l.x, y: l.y }; });
    if (h.font !== 'Josefin Sans' || h.w !== 300 || h.t !== 'Casino') kept = false;   /* letter space may shrink with the layout */
    if (r === 0) var first = h; else if (h.x !== first.x || h.y !== first.y) moved = true;
  }
  ok(kept && moved, 'with the font option off the other text keeps its word, font and weight, but its place changes');
  await ev(() => { PTD.random.opts.helperFonts = true; });
  let changed = false;
  for (let r = 0; r < 6 && !changed; r++) {
    await ev(() => PTD.random.once()); await p.waitForTimeout(3100);
    changed = await ev(() => { const l = PTD.core.state().layers.filter(l => l.text === 'Casino')[0]; return l.weight !== 300 || l.ls !== 12; });
  }
  ok(changed, 'with the font option on the other text changes its look too');

  // ---- the words box together with a style
  await ev(() => { const o = PTD.random.opts; o.helperFonts = true; o.words = true; o.styleSet = true; o.styleVal = 'split'; });
  await ev(() => PTD.random.once()); await p.waitForTimeout(3500);
  const wd = await ev(() => { const s = PTD.core.state(); return { name: s.casinoName, gen: s.layers.filter(l => l.gen).map(l => l.text).join(' ') }; });
  ok(wd.name && wd.gen === wd.name, 'with new words the project casino name is the new name and the pieces read as it: ' + wd.name);

  // ---- panel
  await ev(() => { PTD.random.opts.words = false; PTD.core.setTab('random'); PTD.core.renderPanels(); });
  ok(await p.isVisible('#randomPane select[data-key="styleVal"]') && await p.isVisible('#randomPane [data-key="helperFonts"]') && await p.isVisible('#randomPane [data-act="namerestore"]'), 'the Random tab has the style row, the font option and the restore button');
  const un = await ev(() => [...document.querySelectorAll('#namePanel button, #randomPane select[data-key="styleVal"], #randomPane [data-act="namerestore"], #randomPane label.chk')].filter(n => !n.getAttribute('title')).map(n => n.textContent.trim().slice(0, 30))); ok(un.length === 0, 'every new control has a tooltip: ' + un.join());
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close(); process.exit(fails ? 1 : 0);
})();
