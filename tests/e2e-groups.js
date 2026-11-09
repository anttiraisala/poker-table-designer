/* Browser checks for groups and names in the graph editor (V142).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-groups.js */
const { chromium } = require('playwright');
const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const root = path.resolve(__dirname, '..');
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const ev = (f, a) => p.evaluate(f, a); const wait = (ms) => p.waitForTimeout(ms || 250);
  const url = 'file://' + path.join(root, 'index.html');
  await p.goto(url); await ev(() => { localStorage.clear(); }); await p.goto(url); await wait(600);
  await p.click('[data-pa="pattern"]'); await wait(600);
  const ids = await ev(() => { const g = PTD.core.state().graph, f = t => g.nodes.filter(n => n.type === t)[0].id; return { c: f('circle'), s: f('stroke'), o: f('output') }; });
  const menu = async (nid, label) => {
    await ev((a) => { const el = document.querySelector('.gxnode[data-nid="' + a + '"] .gxhead'); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 8 })); }, nid); await wait(250);
    await ev((l) => { [...document.querySelectorAll('#gxMenu [data-gm]')].filter(b => b.textContent === l)[0].click(); }, label); await wait(400);
  };
  // names
  await ev((a) => { const e = PTD.pathsui.editor; e.set = {}; e.set[a] = 1; e.sel = a; PTD.core.renderPanels(); }, ids.c); await wait(300);
  await ev(() => { const i = document.querySelector('input[data-pa="gname"]'); i.value = 'Table edge'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(350);
  ok(await ev((a) => PTD.core.state().graph.nodes.filter(n => n.id === a)[0].name === 'Table edge', ids.c), 'a node can be given its own name');
  ok(await ev((a) => document.querySelector('.gxnode[data-nid="' + a + '"] .gxtitle').textContent.indexOf('Table edge') === 0, ids.c), 'the header shows the name instead of the type');
  // group the circle and the stroke
  await ev((a) => { const e = PTD.pathsui.editor; e.set = {}; e.set[a.c] = 1; e.set[a.s] = 1; e.sel = a.s; PTD.core.renderPanels(); }, ids); await wait(300);
  await menu(ids.s, 'Group selected');
  ok(await ev(() => document.querySelectorAll('#gxsvg .gxblack').length === 1), 'Group selected makes a black box');
  ok(await ev((a) => !document.querySelector('.gxnode[data-nid="' + a.c + '"]') && !document.querySelector('.gxnode[data-nid="' + a.s + '"]'), ids), 'the nodes inside are hidden');
  ok(await ev(() => document.querySelectorAll('#gxsvg .gxblack .gxport.out').length === 1 && document.querySelectorAll('#gxsvg .gxwire').length === 1), 'the box shows the output that crosses its border and one wire to the Output node');
  // open and close with a double click
  const dbl = async (sel, dy) => { const bb = await (await p.$(sel)).boundingBox(); await p.mouse.dblclick(bb.x + bb.width / 2, bb.y + (dy == null ? bb.height / 2 : dy)); await wait(400); };
  await dbl('#gxsvg .gxblack .gxhead');
  ok(await ev(() => document.querySelectorAll('#gxsvg .gxframe').length === 1 && document.querySelectorAll('#gxsvg .gxblack').length === 0), 'a double click opens the group into a frame');
  ok(await ev((a) => !!document.querySelector('.gxnode[data-nid="' + a.c + '"]') && !!document.querySelector('.gxnode[data-nid="' + a.s + '"]'), ids), 'the nodes show again inside the frame');
  await dbl('#gxsvg .gxframe .gxfhead');
  ok(await ev(() => document.querySelectorAll('#gxsvg .gxblack').length === 1), 'a double click on the frame header closes it again');
  await dbl('#gxsvg .gxblack .gxhead'); await dbl('#gxsvg .gxframe .gxfbody', 6);
  ok(await ev(() => document.querySelectorAll('#gxsvg .gxblack').length === 1), 'a double click in an empty part of the frame closes it too');
  // name and state of the group
  const gid = await ev(() => PTD.core.state().graph.groups[0].id);
  await ev((a) => { const e = PTD.pathsui.editor; e.set = {}; e.set[a] = 1; e.sel = a; PTD.core.renderPanels(); }, gid); await wait(300);
  await ev(() => { const i = document.querySelector('input[data-pa="gname"]'); i.value = 'Ring'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(350);
  ok(await ev(() => document.querySelector('#gxsvg .gxblack .gxtitle').textContent.indexOf('Ring') >= 0), 'the group has a name that shows in the box');
  const area0 = await ev(() => { const l = PTD.core.state().layers.filter(x => x.pattern)[0]; return l.frozen.x1 - l.frozen.x0; });
  await ev(() => { const c = document.querySelector('select[data-pa="goffsel"]'); c.value = 'empty'; c.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(500);
  ok(await ev(() => document.querySelectorAll('#gxsvg .gxblack.off .gxstripes').length === 1), 'a group that is off shows the stripes');
  ok(await ev((w0) => { const l = PTD.core.state().layers.filter(x => x.pattern)[0]; return !l.frozen || Math.abs((l.frozen.x1 - l.frozen.x0) - w0) > 50 || (l.frozen.d || '').length < 20; }, area0), 'the pattern follows the state of the group');
  await ev(() => { const c = document.querySelector('select[data-pa="goffsel"]'); c.value = ''; c.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(500);
  ok(await ev((w0) => { const l = PTD.core.state().layers.filter(x => x.pattern)[0]; return Math.abs((l.frozen.x1 - l.frozen.x0) - w0) < 1; }, area0), 'enabling the group brings the pattern back');
  // the saved graph keeps the group
  ok(await ev(() => { const g = PTD.core.state().graph; return g.groups && g.groups[0].name === 'Ring' && g.groups[0].nodes.length === 2; }), 'the group is part of the saved graph');
  // ungroup
  await ev((a) => { const e = PTD.pathsui.editor; e.set = {}; e.set[a] = 1; e.sel = a; PTD.core.renderPanels(); }, gid); await wait(250);
  await ev(() => document.querySelector('[data-pa="gungroup"]').click()); await wait(400);
  ok(await ev(() => !PTD.core.state().graph.groups && document.querySelectorAll('#gxsvg .gxblack').length === 0 && document.querySelectorAll('#gxsvg .gxnode').length === 3), 'Ungroup brings the nodes back');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
