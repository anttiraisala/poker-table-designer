/* Browser checks for REQ-008 (groups of texts): make, nest, ungroup, take out, add, select by click, move, scale with the handles and the
 * fields, turn, clone, delete, lock, collapse, undo and the saved form.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-groups.js */
const { chromium } = require('playwright');
const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t = 0.05) => Math.abs(a - b) <= t;
(async () => {
  const root = path.resolve(__dirname, '..');
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  const ev = (f, a) => p.evaluate(f, a);
  const url = 'file://' + path.join(root, 'index.html');
  const wait = () => p.waitForTimeout(250);
  async function fresh(list) {
    await p.goto(url); await ev(() => { localStorage.clear(); });
    await p.goto(url); await p.waitForTimeout(500);
    await ev(() => { PTD.core.cfg().snap = false; const s = PTD.core.state(); s.layers = []; s.groups = []; s.band.at = 0; s.band.hidden = true; PTD.core.save(); });
    await ev((list) => {
      const s = PTD.core.state(); const base = { font: 'Arial', size: 60, ls: 0, rot: 0, upper: false, cap: false, capAll: false, frozen: null, locked: false, nameWord: false, gen: '', styleHidden: false, group: '' };
      list.forEach(t => s.layers.push(Object.assign({}, base, t)));
      s.layers.forEach((l, i) => { l.id = 'l' + (i + 1); });
      PTD.core.save(); PTD.core.renderPanels(); PTD.core.renderStage(); PTD.core.setTool('select');
    }, list);
    await wait();
  }
  const sel = (ids) => ev((ids) => { const s = PTD.core.state(), u = PTD.core.ui; s.selected = ids[0] || null; u.extra = {}; ids.slice(1).forEach(k => u.extra[k] = true); u.areaSel = false; PTD.core.renderPanels(); PTD.core.renderStage(); }, ids);
  const L = () => ev(() => PTD.core.state().layers.map(l => ({ id: l.id, text: l.text, x: l.x, y: l.y, size: l.size, ls: l.ls, rot: l.rot, group: l.group, locked: l.locked })));
  const G = () => ev(() => PTD.core.state().groups.map(g => ({ uid: g.uid, name: g.name, nameAuto: g.nameAuto, parent: g.parent, open: g.open })));
  const selIds = () => ev(() => PTD.core.selectedIds());
  const client = (key) => ev((key) => { const bnd = PTD.core.ui.bounds[key], r = document.getElementById('stage').getBoundingClientRect(), v = PTD.core.ui.view; return { x: r.left + r.width / 2 + (bnd.x + bnd.w / 2 - v.cx) * v.z, y: r.top + r.height / 2 + (bnd.y + bnd.h / 2 - v.cy) * v.z }; }, key);
  const four = [{ text: 'Alpha', x: -300, y: -150 }, { text: 'Beta', x: 100, y: -150 }, { text: 'Gamma', x: -300, y: 150 }, { text: 'Delta', x: 100, y: 150 }];

  // make a group with the button, the roll shows it
  await fresh(four);
  await sel(['l1', 'l2']);
  ok(!(await ev(() => document.getElementById('groupBtn').disabled)), 'Group button is enabled for two texts');
  ok(await ev(() => document.getElementById('ungroupBtn').disabled), 'Ungroup button is disabled when no group is selected');
  await p.click('#groupBtn'); await wait();
  let g = await G(), l = await L();
  ok(g.length === 1 && l[0].group === g[0].uid && l[1].group === g[0].uid && !l[2].group, 'two texts are in the new group');
  ok(g[0].nameAuto === true, 'the name is automatic');
  ok(await ev(() => document.querySelectorAll('[data-gpanel]').length) === 1, 'the list has a group row');
  ok(await ev(() => /Beta Alpha|Alpha Beta/.test(document.querySelector('[data-gpanel] .ttl').textContent)), 'the group is named after its texts');
  ok(await ev(() => document.querySelector('[data-panel="l1"]').style.marginLeft === '14px'), 'the texts of the group are indented in the list');
  ok((await selIds()).length === 2 && !!(await ev(() => PTD.core.curGroup())), 'the group is selected as a whole');
  // order: group row directly above its top text in the list
  ok(await ev(() => { const o = (n) => Number(n.style.order); const gr = document.querySelector('[data-gpanel]'), a = document.querySelector('[data-panel="l1"]'), c = document.querySelector('[data-panel="l2"]'); return o(gr) < Math.min(o(a), o(c)); }), 'the group row comes before its texts in the list');

  // a click on a member selects the whole group; Esc/empty clears; Shift+click toggles groups
  await sel([]);
  let pt = await client('l1'); await p.mouse.click(pt.x, pt.y); await wait();
  ok((await selIds()).sort().join() === 'l1,l2', 'a click on one text of a group selects the group');
  await ev(() => PTD.core.setTool('select'));
  // double click enters the group
  await p.waitForTimeout(600); pt = await client('l1'); await p.mouse.click(pt.x, pt.y); await p.mouse.click(pt.x, pt.y); await wait();
  ok((await selIds()).join() === 'l1', 'a double click selects the text alone');

  // drag moves everything
  await p.waitForTimeout(600); await sel([]); pt = await client('l2'); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(600);
  const before = await L();
  pt = await client('l2');
  await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.mouse.move(pt.x + 40, pt.y + 20, { steps: 5 }); await p.mouse.up(); await wait();
  l = await L();
  ok(near(l[0].x - before[0].x, l[1].x - before[1].x, 0.01) && l[0].x - before[0].x > 5 && near(l[2].x, before[2].x), 'dragging the group moves its texts equally and leaves the others');

  // a press and drag right after a click still moves the group (it does not go into the group)
  await sel([]); await p.waitForTimeout(600); pt = await client('l2'); await p.mouse.click(pt.x, pt.y);
  pt = await client('l2'); await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.mouse.move(pt.x - 30, pt.y, { steps: 4 }); await p.mouse.up(); await wait();
  ok((await selIds()).length === 2, 'a quick press and drag after a click keeps the group selected');

  // handles and scaling
  await sel(['l1', 'l2']);
  ok(await ev(() => PTD.thandles.handles().length) === 4, 'a low group box has the four corner handles');
  const box0 = await ev(() => PTD.core.groupBox(PTD.core.selectedIds().map(PTD.core.getLayer)));
  const hn = await ev(() => { const n = document.querySelector('[data-h="thandle:1:1"]'); const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const s0 = await L();
  await p.mouse.move(hn.x, hn.y); await p.mouse.down(); await p.mouse.move(hn.x + 80, hn.y + 40, { steps: 6 }); await p.mouse.up(); await wait();
  l = await L();
  const k = l[0].size / s0[0].size;
  ok(k > 1.05 && near(l[1].size / s0[1].size, k, 0.001), 'dragging a handle scales all the texts by the same factor (x' + k.toFixed(3) + ')');
  const box1 = await ev(() => PTD.core.groupBox(PTD.core.selectedIds().map(PTD.core.getLayer)));
  ok(near(box1.x, box0.x, 0.3) && near(box1.y, box0.y, 0.3), 'the opposite corner stays where it was');
  ok(near(box1.w / box0.w, k, 0.02), 'the box grows by the same factor');
  await p.click('#undoBtn'); await wait();
  l = await L(); ok(near(l[0].size, 60, 0.001), 'one undo step takes the scaling back');

  // fields: width scales evenly; X moves
  await sel(['l1', 'l2']);
  const w0 = (await ev(() => PTD.core.groupBox([PTD.core.getLayer('l1'), PTD.core.getLayer('l2')]))).w;
  await ev(() => { const i = document.querySelector('[data-gfield="w"]'); i.value = String(Math.round(i.value * 2)); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await wait(); l = await L();
  ok(near(l[0].size, 120, 1.5) && near(l[1].size, 120, 1.5), 'the Width field scales the group (about x2: ' + l[0].size + ')');
  await ev(() => { const i = document.querySelector('[data-gfield="x"]'); i.value = '0'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await wait();
  ok(near((await ev(() => PTD.core.groupBox([PTD.core.getLayer('l1'), PTD.core.getLayer('l2')]))).x - (await ev(() => PTD.core.state().origin.x)), 0, 0.5), 'the X field moves the group');
  await ev(() => { const i = document.querySelector('[data-gfield="name"]'); i.value = 'Title'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await wait();
  g = await G(); ok(g[0].name === 'Title' && g[0].nameAuto === false, 'the name can be written');
  ok(await ev(() => document.querySelector('[data-gpanel] .ttl').textContent.includes('Title')), 'the group row shows the name');
  await ev(() => { const i = document.querySelector('[data-gfield="name"]'); i.value = ''; i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait();
  g = await G(); ok(g[0].nameAuto === true, 'an empty name is automatic again');

  // turn
  await fresh(four); await sel(['l1', 'l2']); await p.click('#groupBtn'); await wait();
  const c0 = await L();
  ok(await ev(() => PTD.core.turnGroup(PTD.core.selectedIds().map(PTD.core.getLayer), 90)), 'turn works');
  l = await L();
  ok(l[0].rot === 90 && l[1].rot === 90, 'the texts turn by 90');
  const mid = { x: (c0[0].x + c0[1].x) / 2, y: (c0[0].y + c0[1].y) / 2 };
  ok(near((l[0].x + l[1].x) / 2, mid.x, 40) && near((l[0].y + l[1].y) / 2, mid.y, 40), 'they turn about the middle of the group');

  // nesting, ungroup, take out, add
  await fresh(four); await sel(['l1', 'l2']); await p.click('#groupBtn'); await wait();
  await sel(['l1', 'l2', 'l3']); await p.click('#groupBtn'); await wait();
  g = await G(); l = await L();
  ok(g.length === 2 && g.filter(x => x.parent).length === 1, 'a group and a text make a group that holds the group');
  ok(await ev(() => document.querySelector('[data-panel="l1"]').style.marginLeft === '28px'), 'the nested texts are indented twice');
  ok(await ev(() => PTD.core.curGroup() && PTD.core.curGroup().parent === ''), 'the outer group is selected as a whole');
  await p.click('#ungroupBtn'); await wait();
  g = await G(); ok(g.length === 1 && g[0].parent === '', 'ungroup removes the outer group only');
  await sel(['l1', 'l2']); await p.click('#ungroupBtn'); await wait();
  ok((await G()).length === 0, 'ungroup removes the last group');
  // add
  await sel(['l1', 'l2']); await p.click('#groupBtn'); await wait();
  await sel(['l3']);
  await ev(() => { document.querySelector('[data-act="grpadd"]').click(); }); await wait();
  l = await L(); ok(l[2].group && l[2].group === l[0].group, 'Add to group puts the selected text in the group');
  // take out
  await sel(['l3']);
  await ev(() => document.querySelector('[data-act="lout"][data-id="l3"]').click()); await wait();
  l = await L(); ok(!l.filter(x => x.id === 'l3')[0].group, 'Take out puts the text back out of the group');

  // collapse hides the texts
  await sel(['l1', 'l2']);
  ok(await ev(() => !!document.querySelector('[data-panel="l1"]')), 'the texts of an open group are listed');
  await ev(() => document.querySelector('[data-act="grptoggle"]').click()); await wait();
  ok(await ev(() => !document.querySelector('[data-panel="l1"]') && !!document.querySelector('[data-gpanel]')), 'a collapsed group hides its texts in the list');

  // keys and menu
  await fresh(four); await sel(['l3', 'l4']);
  await p.keyboard.press('Control+g'); await wait();
  ok((await G()).length === 1, 'Ctrl+G groups');
  await p.keyboard.press('Control+Shift+G'); await wait();
  ok((await G()).length === 0, 'Ctrl+Shift+G ungroups');

  // clone of a group makes a new group
  await sel(['l1', 'l2']); await p.click('#groupBtn'); await wait();
  await p.click('#cloneBtn'); await wait();
  g = await G(); l = await L();
  ok(g.length === 2 && l.length === 6, 'cloning a group makes a second group (' + g.length + ' groups, ' + l.length + ' texts)');
  const ids2 = await selIds(); const newGrp = await ev(() => PTD.core.curGroup() && PTD.core.curGroup().uid);
  ok(!!newGrp && ids2.length === 2, 'the clones are selected as the new group');
  ok(await ev(() => { const s = PTD.core.state(); return s.groups.every(gr => { const ix = s.layers.map((x, i) => x.group === gr.uid ? i : -1).filter(i => i >= 0); return ix[ix.length - 1] - ix[0] === ix.length - 1; }); }), 'the texts of every group are next to each other');

  // delete a group
  await ev(() => document.querySelector('[data-gpanel].sel [data-act="grpdel"], [data-gpanel] [data-act="grpdel"]').click()); await wait();
  l = await L(); ok(l.length === 4 || l.length === 5 || l.length === 6, 'the delete button on a group row removes its texts (' + l.length + ' left)');
  ok((await ev(() => PTD.core.state().groups.every(gr => PTD.core.state().layers.filter(x => x.group === gr.uid).length >= 2))), 'no group is left with fewer than two texts');

  // lock: a locked text stops the handles; the group lock button locks all
  await fresh(four); await sel(['l1', 'l2']); await p.click('#groupBtn'); await wait();
  await ev(() => document.querySelector('[data-act="grplock"]').click()); await wait();
  l = await L(); ok(l[0].locked && l[1].locked && !l[2].locked, 'the lock button of a group locks its texts');
  ok(await ev(() => PTD.thandles.handles().length) === 0, 'a locked group has no handles');
  await ev(() => document.querySelector('[data-act="grplock"]').click()); await wait();
  await ev(() => document.querySelector('[data-act="grpeye"]').click()); await wait();
  ok(await ev(() => PTD.core.state().layers[0].hidden && PTD.core.state().layers[1].hidden && !PTD.core.state().layers[2].hidden), 'the eye of a group hides its texts');

  // saved form and undo
  await fresh(four); await sel(['l1', 'l2']); await p.click('#groupBtn'); await wait();
  const js = await ev(() => PTD.core.toJSON(false));
  ok(Array.isArray(js.artwork.groups) && js.artwork.groups.length === 1 && js.artwork.layers.filter(x => x.group).length === 2, 'the project JSON has the groups and the texts carry their group');
  await p.click('#undoBtn'); await wait();
  ok((await G()).length === 0 && (await L()).every(x => !x.group), 'one undo step removes the group');
  await ev(() => document.getElementById('redoBtn').click()); await wait();
  ok((await G()).length === 1, 'redo brings it back');
  // a bad file is repaired
  await ev((js) => { js.artwork.groups.push({ uid: 'gx', parent: 'nope' }); js.artwork.layers[2].group = 'ghost'; PTD.core.state(); window.__js = js; }, js);
  ok(await ev(() => { const o = JSON.parse(JSON.stringify(window.__js)); return o.artwork.groups.length === 2; }), 'the damaged project text is built');

  // the randomizer leaves the texts of a group alone
  await fresh(four); await sel(['l1', 'l2']); await p.click('#groupBtn'); await wait();
  ok(await ev(() => { const r = PTD.random; return typeof r.isRunning === 'function'; }), 'the randomizer module is there');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
