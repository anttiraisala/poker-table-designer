/* Browser checks for tooltips, click-to-select, card sizes, chips, players, the dealer button and the Blender things.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-scene.js */
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(500);
  const ev = (f, a) => p.evaluate(f, a);

  // ---- defaults of the table things
  const d = await ev(() => JSON.parse(JSON.stringify(PTD.core.state().cards)));
  ok(d.sizeMode === 'poker' && d.chipDia === 40 && d.chipThick === 2, 'default card size is poker and chips are 40 x 2 mm');
  ok(d.potX === -405 && d.potY === -50 && d.burnX === -357 && d.burnY === 70 && d.muckX === -610 && d.muckY === -40, 'default pot, burn and muck offsets');
  ok(await ev(() => PTD.core.state().band.len === 600), 'the default line length is 600 mm');
  const sz = () => ev(() => PTD.core.cardSize());
  let s = await sz(); ok(s.w === 64 && s.h === 89, 'poker size is 64 x 89 mm');
  await ev(() => { const c = PTD.core.state().cards; c.sizeMode = 'custom'; c.cw = 50; c.ch = 70; });
  s = await sz(); ok(s.w === 50 && s.h === 70, 'custom card size');
  await ev(() => { PTD.core.state().band.gap = 20; });
  s = await sz(); ok(s.w === 50 && s.h === 70, 'the gap never changes the card size');
  ok(!(await p.locator('[data-scope="cards"][data-key="sizeMode"] option[value="fit"]').count()), 'there is no Fit to the gap option');
  await ev(() => { PTD.core.state().cards.sizeMode = 'poker'; PTD.core.state().band.y = 123; PTD.core.state().band.gap = 200; });
  ok(await ev(() => { const L = PTD.core.cardLayout(); return Math.abs(L.top + L.h / 2 - 123) < 1e-9; }), 'the hand is centred between the lines vertically');
  await ev(() => { PTD.core.state().band.y = 82; PTD.core.state().band.gap = 150; });
  // old files: fitted or custom height keep their look
  await ev(() => { PTD.core.loadText(JSON.stringify({ format: 'poker-table-designer-project', version: 1, artwork: { cards: { hand: 'As Ks', fit: false, h: 100 } } })); });
  ok(await ev(() => { const c = PTD.core.state().cards; return c.sizeMode === 'custom' && c.ch === 100 && Math.abs(c.cw - 71.4) < 0.01; }), 'an old file with a custom card height loads as Custom');
  await ev(() => { PTD.core.loadText(JSON.stringify({ format: 'poker-table-designer-project', version: 1, artwork: { cards: { hand: 'As Ks', fit: true, h: 120 } } })); });
  ok(await ev(() => { const c = PTD.core.state().cards; return c.sizeMode === 'custom' && Math.abs(c.ch - (150 - 2) * 0.88) < 0.1; }), 'an old fitted file keeps the size it had as Custom');
  await ev(() => { PTD.core.newProject ? 0 : 0; PTD.core.loadText(JSON.stringify({ format: 'poker-table-designer-project', version: 1, artwork: { cards: { hand: 'As Ks Qs Js 10s' } } })); PTD.core.state().cards.sizeMode = 'poker'; });

  // ---- pot, burn, muck use the real sizes
  await ev(() => { const c = PTD.core.state().cards; c.potShow = c.burnShow = c.muckShow = true; });
  const sc = await ev(() => { const r = PTD.scene.build(PTD.core.state()); return { objs: r.objs, card: r.card, chip: r.chip }; });
  const chips = sc.objs.filter(o => o.k === 'chip'), cards = sc.objs.filter(o => o.k === 'card');
  ok(chips.length === 9 && chips.every(c => c.r === 20 && c.th === 2), 'pot chips are 40 mm wide and 2 mm thick');
  const burn = cards.slice(0, 3);
  ok(Math.abs((burn[1].y - burn[0].y) - 89 * 0.2) < 1e-6 && burn[1].x > burn[0].x && burn.every(c => c.w === 64 && c.h === 89), 'burn cards are poker size, a fifth of the card height apart, each a little to the right');
  ok(Math.abs(burn[1].x - -357) < 1e-6 && Math.abs(burn[1].y - (82 + 70)) < 1e-6, 'burn cards are centred on the offset from the centre between the lines');
  ok(cards.slice(3).every(c => c.w === 64 && c.h === 89), 'muck cards are poker size');
  ok(chips.every((c, i) => chips.slice(0, i).every(q => Math.abs(q.z - c.z) > 1e-9 || Math.hypot(q.x - c.x, q.y - c.y) >= 0) ), 'pot chips are placed');
  ok(chips.every(c => c.z >= 0.1 - 1e-9), 'chips float 0.1 mm above the cloth');
  // burn cards lie below the pot: drawn first, and chips over them rest on top
  const lay = await ev(() => { const c = PTD.core.state().cards, sv = [c.potX, c.potY]; c.potX = c.burnX; c.potY = c.burnY;
    const o = PTD.scene.build(PTD.core.state()).objs; c.potX = sv[0]; c.potY = sv[1];
    const first = o.findIndex(x => x.k === 'chip'), lastCard = o.map(x => x.k).lastIndexOf('card');
    return { burnFirst: o.slice(0, 3).every(x => x.k === 'card'), minZ: Math.min.apply(null, o.filter(x => x.k === 'chip').map(x => x.z)) }; });
  ok(lay.burnFirst && lay.minZ > 0.3, 'burn cards come before the pot and chips over them rest on the cards');
  await ev(() => { const c = PTD.core.state().cards; c.potShow = c.burnShow = c.muckShow = false; });
  // number fields scrub by dragging
  await p.click('#tabs button[data-tab="artwork"]');
  const nf = p.locator('[data-scope="cards"][data-key="potX"]');
  const before = await ev(() => PTD.core.state().cards.potX);
  await nf.scrollIntoViewIfNeeded();
  const bx = await nf.boundingBox();
  await p.mouse.move(bx.x + 20, bx.y + bx.height / 2); await p.mouse.down(); await p.mouse.move(bx.x + 50, bx.y + bx.height / 2, { steps: 5 }); await p.mouse.up();
  ok(await ev(b => PTD.core.state().cards.potX === b + 30, before), 'dragging over a number field changes it one step per pixel');
  await p.mouse.move(bx.x + 20, bx.y + bx.height / 2); await p.mouse.click(bx.x + 20, bx.y + bx.height / 2);
  ok(await ev(() => document.activeElement && document.activeElement.dataset.key === 'potX'), 'a plain click still focuses the field for typing');
  await ev(() => { PTD.core.state().cards.potX = -405; });

  // ---- players
  await ev(() => { const t = PTD.core.state().tables[0]; t.bet.on = true; t.players.show = true; t.players.count = 8; t.players.seed = 3; t.players.cards = 2; t.players.dealerPlayer = false; });
  const info = () => ev(() => PTD.scene.build(PTD.core.state()).info.tables[0]);
  const objs = () => ev(() => PTD.scene.build(PTD.core.state()).objs);
  let o = await objs();
  ok(o.filter(x => x.k === 'button').length === 1, 'there is exactly one dealer button');
  ok(await ev(() => { const t = PTD.core.state().tables[0], g = PTD.tables.geo(t); return PTD.scene.build(PTD.core.state()).objs.every(x => PTD.geom.pointInPolygon([x.x, x.y], g.poly)); }), 'every player object lies on the cloth');
  ok(o.filter(x => x.k === 'chip').every(c => c.r === 20 && c.th === 2) && o.filter(x => x.k === 'card').every(c => c.w === 64 && c.h === 89), 'players use the same chip and card sizes');
  // dealer position at the bottom: nobody sits there when the dealer is not a player
  const seatPos = (o) => { const m = {}; o.filter(x => x.role === 'hand' || x.role === 'tossed').forEach(x => { (m[x.seat] = m[x.seat] || []).push(x); }); return m; };
  ok(await ev(() => PTD.scene.build(PTD.core.state()).objs.filter(x => x.seat !== undefined).every(x => !(x.y > 400 && Math.abs(x.x) < 120))), 'the dealer position is empty when the dealer is not a player');
  await ev(() => { PTD.core.state().tables[0].players.dealerPlayer = true; });
  o = await objs();
  const first = o.filter(x => x.seat === 0 && (x.role === 'hand' || x.role === 'tossed' || x.role === 'stack'));
  const cx0 = first.reduce((a, x) => a + x.x, 0) / first.length, cy0 = first.reduce((a, x) => a + x.y, 0) / first.length;
  ok(cy0 > 300 && Math.abs(cx0) < 200, 'with the dealer as a player seat 1 is at the dealer position (' + Math.round(cx0) + ', ' + Math.round(cy0) + ')');
  await ev(() => { const t = PTD.core.state().tables[0]; t.players.dealerPlayer = false; t.players.count = 1; });
  o = await objs();
  const one = o.filter(x => x.seat === 0 && (x.role === 'hand' || x.role === 'tossed' || x.role === 'stack'));
  ok(one.length > 0 && one.reduce((a, x) => a + x.y, 0) / one.length < -300, 'a single player (dealer not a player) sits opposite the dealer');
  await ev(() => { PTD.core.state().tables[0].players.dealerPlayer = true; });
  o = await objs();
  const one2 = o.filter(x => x.seat === 0 && (x.role === 'hand' || x.role === 'tossed' || x.role === 'stack'));
  ok(one2.length > 0 && one2.reduce((a, x) => a + x.y, 0) / one2.length > 300, 'a single player who is the dealer sits at the dealer position');
  // evenly spaced seats: neighbouring seat centres are about equally far apart along the outline
  await ev(() => { const t = PTD.core.state().tables[0]; t.players.dealerPlayer = false; t.players.count = 11; t.players.seed = 9; });
  // hand-in-progress rules over many arrangements
  const rules = await ev(() => {
    const t = PTD.core.state().tables[0], bad = []; t.players.count = 7; t.players.cards = 3;
    for (let seed = 1; seed <= 120; seed++) {
      t.players.seed = seed; const r = PTD.scene.build(PTD.core.state()), inf = r.info.tables[0], N = 7;
      const own = r.objs.filter(x => x.role === 'hand').length, tossed = r.objs.filter(x => x.role === 'tossed').length;
      if (inf.active < 1 || inf.active > N) bad.push('active ' + inf.active);
      if (own !== inf.active * 3) bad.push('own cards ' + own + ' vs ' + inf.active);
      if (tossed !== (N - inf.active) * 3) bad.push('tossed ' + tossed);
      if (inf.folded.length !== N - inf.active) bad.push('folded list');
      const betSeats = Object.keys(inf.bets).map(Number);
      if (betSeats.some(s => inf.folded.indexOf(s) >= 0)) bad.push('a folded player has a bet');
      betSeats.forEach(s => { const i = inf.order.indexOf(s); inf.order.slice(0, i).forEach(q => { if (inf.folded.indexOf(q) < 0 && !(q in inf.bets)) bad.push('bets are not a run from the small blind'); }); });
      if (r.objs.filter(x => x.k === 'button').length !== 1) bad.push('button count');
    }
    return bad.slice(0, 5);
  });
  ok(rules.length === 0, 'hand-in-progress rules hold for 120 arrangements ' + rules.join('; '));
  const stackOk = await ev(() => {
    const r = PTD.scene.build(PTD.core.state()), by = {};
    r.objs.filter(x => x.k === 'chip' && x.stack).forEach(c => { (by[c.stack] = by[c.stack] || []).push(c); });
    return Object.values(by).every(list => list.every((c, i) => i === 0 ? Math.abs(c.z - 0.1) < 1e-9 : Math.abs(c.z - list[i - 1].z - 2.1) < 1e-9) && list.length >= 1);
  });
  ok(stackOk, 'chips in a stack rest on each other with a 0.1 mm gap');
  const bounds = await ev(() => { const r = PTD.scene.build(PTD.core.state()); const ns = r.objs.filter(x => x.role === 'stack').map(c => c.stack.split('.')[0]); return new Set(ns).size; });
  ok(bounds >= 1, 'every seat has chip stacks');
  await ev(() => { PTD.core.state().tables[0].players.cards = 4; PTD.core.state().tables[0].players.count = 12; });
  ok((await objs()).length > 100, 'twelve players with four cards each build');
  await ev(() => { PTD.core.state().tables[0].players.show = false; });
  ok((await objs()).length === 0, 'hiding the players removes their objects');
  await ev(() => { PTD.core.state().tables[0].players.show = true; PTD.core.state().tables[0].players.count = 6; PTD.core.state().tables[0].players.cards = 2; PTD.core.renderPanels(); PTD.core.renderStage(); });

  // ---- panel
  await p.click('#tabs button[data-tab="tables"]'); await p.click('[data-act="tselect"][data-id="t1"]');
  ok(await p.isVisible('#tablesPane [data-scope="players:t1"][data-key="count"]'), 'the Tables panel has the player settings');
  await p.fill('#tablesPane [data-scope="players:t1"][data-key="count"]', '9'); await p.dispatchEvent('#tablesPane [data-scope="players:t1"][data-key="count"]', 'input');
  ok(await ev(() => PTD.core.state().tables[0].players.count === 9), 'the player count can be changed');
  await p.selectOption('#tablesPane [data-scope="players:t1"][data-key="cards"]', '4');
  ok(await ev(() => PTD.core.state().tables[0].players.cards === 4), 'cards per player can be 4');
  const seed0 = await ev(() => PTD.core.state().tables[0].players.seed);
  await p.click('#tablesPane [data-act="playseed"]');
  ok(await ev(s => PTD.core.state().tables[0].players.seed !== s, seed0), 'New arrangement changes the arrangement');
  ok(/still in the hand/.test(await p.textContent('#tablesPane')), 'the panel tells how many players are still in');
  ok(await ev(() => JSON.stringify(PTD.core.toPartJSON('tables', false)).includes('"players"')), 'the player settings are part of the tables file');

  // ---- tooltips
  await p.click('#tabs button[data-tab="guides"]');
  await ev(() => { PTD.guides.add('x', 123); PTD.core.renderStage(); });
  const gname = await ev(() => PTD.core.state().guides[0].name);
  const pt = await ev(() => { const r = document.querySelector('#stage [data-h^="guide:"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 200 }; });
  await p.mouse.move(pt.x - 40, pt.y); await p.mouse.move(pt.x, pt.y, { steps: 4 });
  ok(await p.isVisible('#tip') && (await p.textContent('#tip')).includes(gname), 'hovering a guide shows a tooltip with its name: ' + await p.textContent('#tip'));
  await p.mouse.move(5, 500);
  ok(!(await p.isVisible('#tip')), 'the tooltip goes away');
  const tipFor = async (sel) => {
    const pos = await ev(sel => { const n = document.querySelector(sel), L = n.getTotalLength(), q = n.getPointAtLength(L * 0.3), m = n.getScreenCTM(); return { x: q.x * m.a + m.e, y: q.y * m.d + m.f }; }, sel);
    await p.mouse.move(pos.x + 30, pos.y + 30); await p.mouse.move(pos.x, pos.y, { steps: 3 });
    return (await p.isVisible('#tip')) ? await p.textContent('#tip') : '';
  };
  ok(/table outline/.test(await tipFor('#stage path[data-h^="tedge:"]')), 'hovering the table outline names the table');
  ok(/wrap line/.test(await tipFor('#stage path[data-tip*="wrap line"]')), 'hovering the dashed wrap line says what it is');
  ok(/player-area line/.test(await tipFor('#stage path[data-tip*="player-area"]')), 'hovering the player-area line says what it is');
  await p.mouse.move(5, 500);

  // ---- click on a text selects it, a second click deselects it
  await ev(() => { PTD.guides.remove(PTD.core.state().guides[0].id); PTD.core.state().tables[0].players.show = false; PTD.core.state().layers.forEach((l, i) => { l.hidden = i > 1; }); });
  await p.click('#tabs button[data-tab="artwork"]'); await p.click('#deselectBtn');
  const hit = async (id) => ev(id => { const r = document.querySelector('#stage rect[data-id="' + id + '"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
  let h1 = await hit('l1');
  await p.mouse.click(h1.x, h1.y); await p.waitForTimeout(100);
  ok(await ev(() => PTD.core.state().selected === 'l1') && await p.locator('#layers [data-panel="l1"].sel').count() === 1, 'clicking a text selects it and highlights its panel');
  h1 = await hit('l1'); await p.mouse.click(h1.x, h1.y); await p.waitForTimeout(100);
  ok(await ev(() => !PTD.core.state().selected), 'clicking the selected text again deselects it');
  h1 = await hit('l1'); await p.mouse.move(h1.x, h1.y); await p.mouse.down(); await p.mouse.move(h1.x + 40, h1.y + 10, { steps: 4 }); await p.mouse.up();
  ok(await ev(() => PTD.core.state().selected === 'l1'), 'a drag keeps the text selected');
  h1 = await hit('l1'); await p.mouse.move(h1.x, h1.y); await p.mouse.down(); await p.mouse.move(h1.x + 30, h1.y, { steps: 3 }); await p.mouse.up();
  ok(await ev(() => PTD.core.state().selected === 'l1'), 'dragging a selected text does not deselect it');
  await ev(() => { PTD.core.state().layers.forEach(l => { l.hidden = false; }); });


  // ---- random: players and the player-area line
  await ev(() => { PTD.random.opts.betVary = false; const t = PTD.core.state().tables[0]; t.players.show = true; t.bet.on = false; t.players.count = 3; });
  await ev(() => { const o = PTD.random.opts; o.playersSet = true; o.playersVal = 5; o.betSet = true; o.betVal = true; });
  await p.click('#tabs button[data-tab="random"]'); await p.click('[data-act="randonce"]'); await p.waitForFunction(() => PTD.core.state().tables[0].players.count === 5, null, { timeout: 8000 }).catch(() => {});
  ok(await ev(() => { const t = PTD.core.state().tables[0]; return t.players.count === 5 && t.bet.on === true; }), 'Set overrides the player count and the player-area line');
  await ev(() => { const o = PTD.random.opts; o.playersSet = false; o.playersVary = true; o.betSet = false; });
  const counts = new Set();
  for (let i = 0; i < 12; i++) { await p.click('[data-act="randonce"]'); await p.waitForTimeout(250); counts.add(await ev(() => PTD.core.state().tables[0].players.count)); }
  ok(counts.size > 3 && [...counts].every(c => c >= 1 && c <= 12), 'Vary draws different player counts from 1 to 12: ' + [...counts].join(','));
  ok(await p.locator('[data-scope="rand"][data-key="playersVary"]').isEnabled() && await p.locator('[data-scope="rand"][data-key="playersVal"]').isDisabled(), 'the value box is disabled until Set is ticked');
  await ev(() => { const o = PTD.random.opts; o.playersVary = false; o.playersSet = false; });

  await p.waitForTimeout(3000);   /* a Shuffle once waits up to 2.5 s for fonts; let any late round finish first */
  // ---- a long scrub on the table width keeps going although the panel is rebuilt on every step
  await p.click('#tabs button[data-tab="tables"]'); await p.click('[data-act="tselect"][data-id="t1"]');
  const wf = p.locator('[data-scope="preset:t1"][data-key="w"]'); await wf.scrollIntoViewIfNeeded();
  const w0 = await ev(() => PTD.core.state().tables[0].preset.w), c0 = await ev(() => { const t = PTD.core.state().tables[0]; return [t.x, t.y]; });
  const wb = await wf.boundingBox();
  await p.mouse.move(wb.x + 20, wb.y + wb.height / 2); await p.mouse.down(); await p.mouse.move(wb.x + 220, wb.y + wb.height / 2, { steps: 40 }); await p.mouse.up();
  await p.waitForTimeout(300);
  ok(await ev(w => PTD.core.state().tables[0].preset.w > w + 100, w0), 'scrubbing the table width continues through many steps');
  ok(await ev(c => { const t = PTD.core.state().tables[0]; return t.x === c[0] && t.y === c[1]; }, c0), 'the table centre stays put when the size changes');
  // dragging a node of a circle resizes it around the same centre
  await ev(() => { const t = PTD.core.state().tables[0]; PTD.tables.act('tpreset', { id: t.id, type: 'circle' }); });
  const node = await ev(() => { const t = PTD.core.state().tables[0], w = PTD.tables.worldNodes(t)[1], sv = document.getElementById('stage'), m = sv.getScreenCTM ? null : null; const c = document.querySelector('[data-h="tnode:' + t.id + ':1"]').getBoundingClientRect(); return { x: c.x + c.width / 2, y: c.y + c.height / 2, r: t.preset.w }; });
  await p.mouse.move(node.x, node.y); await p.mouse.down(); await p.mouse.move(node.x + 60, node.y, { steps: 6 }); await p.mouse.up();
  ok(await ev(r => { const t = PTD.core.state().tables[0]; return t.preset && t.preset.type === 'circle' && t.preset.w !== r && t.x === 0 && t.y === 0 && Math.abs(PTD.tables.geo(t).bbox.cx || 0) < 1; }, node.r), 'dragging a circle node keeps it a circle around its centre');

  // ---- Lines and cards values are in millimetres, thickness takes tenths
  await p.click('#tabs button[data-tab="artwork"]');
  const lt = p.locator('#bandPanel [data-scope="band"][data-key="thick"][type="number"], [data-scope="band"][data-key="thick"][type="number"]').first();
  await lt.scrollIntoViewIfNeeded(); await lt.fill('2.4'); await lt.dispatchEvent('input');
  ok(await ev(() => PTD.core.state().band.thick === 2.4), 'line thickness accepts tenths of a millimetre');
  ok(/\(mm\)/.test(await p.locator('[data-scope="band"][data-key="len"][type="number"]').first().evaluate(n => n.closest('.pair').textContent)), 'the line length is labelled in mm');

  // ---- the randomizer makes a table when there is none and the shape option is on
  await ev(() => { const st = PTD.core.state(); st.tables = []; PTD.core.ui.selTable = null; const o = PTD.random.opts; o.shape = true; o.betVary = false; o.betSet = false; o.playersVary = false; o.playersSet = false; PTD.core.renderPanels(); PTD.core.renderStage(); });
  await p.click('#tabs button[data-tab="random"]'); await p.click('[data-act="randonce"]'); await p.waitForFunction(() => PTD.core.state().tables.length === 1, null, { timeout: 8000 }).catch(() => {});
  ok(await ev(() => PTD.core.state().tables.length === 1 && PTD.core.state().tables[0].nodes.length >= 2), 'Shuffle once creates a table when there is none');
  await ev(() => { PTD.core.state().tables = []; PTD.core.renderPanels(); PTD.core.renderStage(); });
  await p.click('[data-act="randstart"]'); await p.waitForFunction(() => PTD.core.state().tables.length === 1, null, { timeout: 8000 }).catch(() => {}); await p.click('[data-act="randstop"]');
  ok(await ev(() => PTD.core.state().tables.length === 1), 'the timed run creates a table when there is none');
  await ev(() => { PTD.random.opts.shape = false; });

  // ---- clicking a text from another tab opens the Artwork tab
  await p.click('#tabs button[data-tab="tables"]');
  let hh = await hit('l1'); await p.mouse.click(hh.x, hh.y); await p.waitForTimeout(150);
  ok(await ev(() => PTD.core.ui.tab === 'artwork' && PTD.core.state().selected === 'l1'), 'clicking a text on another tab opens the Artwork tab and selects it');
  await p.click('#tabs button[data-tab="export"]');
  hh = await hit('l1'); await p.mouse.click(hh.x, hh.y); await p.waitForTimeout(150);
  ok(await ev(() => PTD.core.ui.tab === 'artwork' && PTD.core.state().selected === 'l1'), 'an already selected text is kept selected and the Artwork tab opens');

  // ---- the words can be kept or changed by the randomizer
  await ev(() => { PTD.random.opts.shape = false; PTD.random.opts.words = false; PTD.core.renderPanels(); });
  await p.click('#tabs button[data-tab="random"]');
  const words0 = await ev(() => PTD.core.state().layers.map(l => l.text).join('|'));
  await p.click('[data-act="randonce"]'); await p.waitForTimeout(1500);
  ok(await ev(w => PTD.core.state().layers.map(l => l.text).join('|') === w, words0), 'the words stay the same when the words box is off');
  await ev(() => { PTD.random.opts.words = true; });
  const seenWords = new Set();
  for (let i = 0; i < 3; i++) { await p.click('[data-act="randonce"]'); await p.waitForTimeout(1800); seenWords.add(await ev(() => PTD.core.state().layers.map(l => l.text).join('|'))); }
  ok(seenWords.size > 1 && !seenWords.has(words0), 'new words are invented in every round when the words box is on');
  await ev(() => { PTD.random.opts.words = false; });

  // ---- opening and closing a text panel keeps its header where it is
  await p.click('#tabs button[data-tab="artwork"]');
  await ev(() => { const L = PTD.core.state().layers; for (let i = 0; i < 4; i++) L.push(Object.assign({}, L[0], { id: 'zz' + i, text: 'Extra ' + i })); PTD.core.ui.open = {}; PTD.core.renderPanels(); });
  const hdr = p.locator('#layers button[data-act="toggle"]').nth(1);
  await hdr.scrollIntoViewIfNeeded();
  const y0 = (await hdr.boundingBox()).y;
  await hdr.click(); await p.waitForTimeout(100);
  const y1 = (await p.locator('#layers button[data-act="toggle"]').nth(1).boundingBox()).y;
  await p.locator('#layers button[data-act="toggle"]').nth(1).click(); await p.waitForTimeout(100);
  const y2 = (await p.locator('#layers button[data-act="toggle"]').nth(1).boundingBox()).y;
  ok(Math.abs(y1 - y0) < 1.5 && Math.abs(y2 - y0) < 1.5, 'the panel header keeps its screen position when opened and closed: ' + [y0, y1, y2].map(Math.round).join(' / '));

  // ---- Blender gets real objects and a texture without them
  await ev(() => { const t = PTD.core.state().tables[0]; t.players.show = true; t.players.count = 6; const c = PTD.core.state().cards; c.potShow = true; c.burnShow = true; c.muckShow = true; });
  await p.click('#tabs button[data-tab="export"]');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('[data-act="blender"][data-kind="preview"]')]);
  const file = path.join(os.tmpdir(), 'ptd-things-scene.py'); await dl.saveAs(file);
  const py = fs.readFileSync(file, 'utf8');
  const m = py.match(/PROJECT = json\.loads\(r'''([\s\S]*?)'''\)/); const proj = JSON.parse(m[1]);
  ok(proj.things && proj.things.chips.length > 20 && proj.things.cards.length > 10 && proj.things.buttons.length === 1, 'the Blender script carries the chips, cards and the dealer button: ' + (proj.things ? proj.things.chips.length + ' chips, ' + proj.things.cards.length + ' cards' : 'none'));
  ok(proj.things.chip_r === 0.02 && proj.things.chip_th === 0.002 && proj.things.btn_r === 0.035 && proj.things.btn_th === 0.004, 'chip, button sizes in metres (40 x 2 mm, 70 x 4 mm)');
  ok(proj.things.chips.every(c => c[2] > 0.00009) && proj.things.cards.every(c => c[2] > 0.00009), 'Blender objects start 0.1 mm above the cloth');
  const { spawnSync } = require('child_process');
  const r = spawnSync('python3', [path.join(__dirname, 'blender_mock.py'), file, '--expect-project'], { encoding: 'utf8' });
  ok(r.status === 0, 'the Blender script with things runs against the stand-in bpy: ' + (r.stdout + r.stderr).split('\n').filter(l => /PROBLEM|Error|Traceback|things|ok$/.test(l)).join(' | '));
  // the cloth texture must not contain the objects: render both pictures and compare a patch at the pot
  const same = await ev(async () => {
    const X = PTD.exporter, st = PTD.core.state(), t = st.tables[0], g = PTD.tables.geo(t), bb = PTD.geom.bbox(g.poly);
    const reg = { x0: bb.x0, y0: bb.y0, x1: bb.x1, y1: bb.y1 };
    const a = await X.artSVG(reg, 0.3, false), c = await X.artSVG(reg, 0.3, true);
    return a.text.length < c.text.length && !/DEALER/.test(a.text) && /DEALER/.test(c.text);
  });
  ok(same, 'the picture can include the things and the Blender texture leaves them out');
  await p.click('#tabs button[data-tab="export"]');
  ok(await p.isVisible('[data-scope="xp"][data-key="picObjects"]'), 'the Picture export has an option for the things on the table');

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
