/* Browser checks for wires in the graph editor (V146): select, handles, rubber band, + and insert into wires, group ports and copies.
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-wires.js */
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
  await ev((i) => { const g = PTD.core.state().graph, f = id => g.nodes.filter(n => n.id === id)[0]; f(i.c).x = 0; f(i.c).y = 0; f(i.s).x = 600; f(i.s).y = 0; f(i.o).x = 900; f(i.o).y = 0; PTD.pathsui.editor.vb = null; PTD.core.renderPanels(); }, ids); await wait(300);
  const wk = (a, b2, port) => a + '|' + b2 + '|' + (port || 'in');
  const nW = () => ev(() => PTD.core.state().graph.wires.length);
  const nN = () => ev(() => PTD.core.state().graph.nodes.length);
  const wset = () => ev(() => Object.keys(PTD.pathsui.editor.wset));
  const mid = (key, t) => ev(([k, t]) => { const svg = document.getElementById('gxsvg'), pe = svg.querySelector('.gxwirehit[data-wire="' + k + '"]'), L = pe.getTotalLength(), q = pe.getPointAtLength(L * (t == null ? 0.5 : t)), m = svg.getScreenCTM(); return { x: q.x * m.a + m.e, y: q.y * m.d + m.f }; }, [key, t]);
  const clickWire = async (key, mod, t) => { const q = await mid(key, t); if (mod) await p.keyboard.down(mod); await p.mouse.click(q.x, q.y); if (mod) await p.keyboard.up(mod); await wait(250); };
  const w1 = wk(ids.c, ids.s), w2 = wk(ids.s, ids.o);
  // click selects, does not remove
  const n0 = await nW();
  await clickWire(w1);
  ok((await nW()) === n0 && (await wset()).join() === w1, 'a click on a wire selects it and leaves it in place');
  ok(await ev(() => !!document.querySelector('#gxsvg .gxwire.sel') && document.querySelectorAll('#gxsvg .gxhandle').length === 2), 'the selected wire is highlighted and has two handles');
  await clickWire(w2, 'Shift'); ok((await wset()).length === 2, 'Shift+click adds a wire to the selection');
  await clickWire(w2, 'Control'); ok((await wset()).join() === w1, 'Ctrl+click takes a wire out of the selection');
  await p.dblclick; const q0 = await mid(w1); await p.mouse.dblclick(q0.x, q0.y); await wait(300);
  ok((await nW()) === n0 && !(await ev(() => !!document.getElementById('gxMenu'))), 'a double click on a wire does nothing');
  // + icons appear on all selected wires when the pointer is near one
  await clickWire(w2, 'Shift'); await p.mouse.move(q0.x + 3, q0.y + 3); await wait(300);
  ok((await ev(() => document.querySelectorAll('#gxsvg .gxplus').length)) === 2, 'a + shows on every selected wire while the pointer is near one of them');
  // both selected: nothing fits both (path into stroke, shape into output)
  await p.click('#gxsvg .gxplus'); await wait(300);
  ok(await ev(() => { const m = document.getElementById('gxMenu'); return !!m && m.dataset.ins === '1' && /Nothing fits/.test(m.textContent); }), 'the search lists only what fits every selected wire (here nothing)');
  await p.keyboard.press('Escape'); await wait(200);
  // one wire: a path node fits; the search is filtered, the pick goes into the wire
  await clickWire(w1); const q1 = await mid(w1); await p.mouse.move(q1.x + 2, q1.y + 2); await wait(300);
  await p.click('#gxsvg .gxplus'); await wait(300);
  const listed = await ev(() => [...document.querySelectorAll('#gxMenu [data-gm]')].map(b2 => b2.dataset.gm));
  ok(listed.some(x => x === 'ins:type:round') && !listed.some(x => x === 'ins:type:union' || x === 'ins:type:circle'), 'only types that fit are listed (round yes, union and circle no)');
  const nb = await nN();
  await ev(() => document.querySelector('#gxMenu [data-gm="ins:type:round"]').click()); await wait(400);
  const g1 = await ev(() => { const g = PTD.core.state().graph; return { n: g.nodes.length, w: JSON.parse(JSON.stringify(g.wires)), r: (g.nodes.filter(n => n.type === 'round')[0] || {}).id }; });
  ok(g1.n === nb + 1 && g1.w.some(w => w.from === ids.c && w.to === g1.r) && g1.w.some(w => w.from === g1.r && w.to === ids.s) && !g1.w.some(w => w.from === ids.c && w.to === ids.s), 'the node sits in the wire: circle to it to stroke');
  // Delete removes selected wires; with a node too
  const wr = wk(g1.r, ids.s); await clickWire(wr); await p.keyboard.press('Delete'); await wait(300);
  ok(!(await ev((k) => PTD.core.state().graph.wires.some(w => w.from + '|' + w.to + '|' + w.port === k), wr)), 'Delete removes the selected wire');
  // handle: pull a selected wire's end onto empty space removes the wire; onto a port reconnects it
  await ev(([c, r]) => { const g = PTD.core.state().graph; g.wires.push({ from: r, to: g.nodes.filter(n => n.type === 'stroke')[0].id, port: 'in' }); PTD.core.renderPanels(); }, [ids.c, g1.r]); await wait(300);
  await clickWire(wr);
  let hb = await (await p.$('#gxsvg .gxhandle[data-end="in"]')).boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down(); await p.mouse.move(hb.x + 120, hb.y + 160, { steps: 6 }); await p.mouse.up(); await wait(300);
  ok(!(await ev((k) => PTD.core.state().graph.wires.some(w => w.from + '|' + w.to + '|' + w.port === k), wr)), 'pulling a handle off onto empty space removes the wire');
  // rubber band selects wires it touches
  await ev(([c, r, s]) => { const g = PTD.core.state().graph; g.wires.push({ from: r, to: s, port: 'in' }); PTD.core.renderPanels(); }, [ids.c, g1.r, ids.s]); await wait(300);
  const bb = await ev(() => { const svg = document.getElementById('gxsvg'), m = svg.getScreenCTM(), r = svg.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await ev(() => { const e = PTD.pathsui.editor; e.set = {}; e.wset = {}; e.sel = ''; PTD.core.renderPanels(); }); await wait(200);
  const mq = await mid(wr, 0.5);
  await p.mouse.move(mq.x - 6, bb.y + 8); await p.mouse.down(); await p.mouse.move(mq.x + 6, mq.y + 4, { steps: 5 }); await p.mouse.up(); await wait(300);
  ok((await wset()).indexOf(wr) >= 0, 'a rubber band that touches a wire selects it');
  // a misfit: a path node into the shape wire flashes red with a popup and changes nothing
  const nw0 = await nW();
  await ev((s) => { const g = PTD.core.state().graph; const e = PTD.pathsui.editor; e.wset = {}; e.wset[s] = 1; PTD.core.renderPanels(); }, wk(ids.s, ids.o)); await wait(200);
  await ev(() => PTD.pathsui.editor.wset && 0);
  const rid = g1.r; await ev((a) => { const e = PTD.pathsui.editor; e.set = {}; e.set[a] = 1; e.sel = a; PTD.core.renderPanels(); }, rid); await wait(200);
  await ev(() => { const e = PTD.pathsui.editor; e.wset = {}; e.wset[Object.keys(PTD.pathsui.editor.wset)[0] || ''] = 1; });
  await ev(([k]) => { PTD.pathsui.editor.wset = {}; PTD.pathsui.editor.wset[k] = 1; PTD.core.renderPanels(); }, [wk(ids.s, ids.o)]); await wait(200);
  await ev((a) => { const el = document.querySelector('.gxnode[data-nid="' + a + '"] .gxhead'); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 5, button: 2 })); }, rid); await wait(300);
  await ev(() => { const bt = [...document.querySelectorAll('#gxMenu [data-gm]')].filter(x => x.dataset.gm === 'winsel')[0]; if (bt && !bt.disabled) bt.click(); }); await wait(500);
  ok((await nW()) === nw0 && !!(await ev(() => document.querySelector('.gxpop'))), 'a node that does not fit shows a red popup and changes nothing');
  await wait(100);
  // Insert selected node into selected wires: two wires, two copies, the original stays
  const prep = await ev(() => { const g = PTD.core.state().graph, G = PTD.graph, c2 = G.addNode(g, 'circle', 0, 340), s2 = G.addNode(g, 'stroke', 400, 340), c3 = G.addNode(g, 'circle', 0, 460), s3 = G.addNode(g, 'stroke', 400, 460), r0 = G.addNode(g, 'round', 200, 560); G.connect(g, c2.id, s2.id, 'in'); G.connect(g, c3.id, s3.id, 'in'); PTD.core.renderPanels(); return { a: c2.id, b: s2.id, c: c3.id, d: s3.id, r0: r0.id }; });
  await wait(300);
  await ev((a) => { const e = PTD.pathsui.editor; e.wset = {}; e.wset[a.a + '|' + a.b + '|in'] = 1; e.wset[a.c + '|' + a.d + '|in'] = 1; e.set = {}; e.set[a.r0] = 1; e.sel = a.r0; PTD.core.renderPanels(); }, prep); await wait(300);
  const nR = () => ev(() => PTD.core.state().graph.nodes.filter(n => n.type === 'round').length);
  const r0n = await nR();
  await ev((a) => { const el = document.querySelector('.gxnode[data-nid="' + a + '"] .gxhead'); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 5, button: 2 })); }, prep.r0); await wait(300);
  await ev(() => { const bt = [...document.querySelectorAll('#gxMenu [data-gm]')].filter(x => x.dataset.gm === 'winsel')[0]; bt.click(); }); await wait(500);
  ok((await nR()) === r0n + 2 && (await ev((a) => PTD.core.state().graph.nodes.some(n => n.id === a.r0) && !PTD.core.state().graph.wires.some(w => w.from === a.a && w.to === a.b), prep)), 'a selected node goes into the selected wires as one copy per wire, the original stays');
  // group: copy keeps ports without wires; the copy goes into a wire
  const gp = await ev((a) => { const g = PTD.core.state().graph, G = PTD.graph, m = G.makeGroup(g, [g.wires.filter(w => w.from === a.a)[0].to, g.wires.filter(w => w.from === a.c)[0].to], 'Pair'); PTD.core.renderPanels(); return m; }, prep);
  ok(!!gp.id, 'two nodes grouped (' + (gp.err || gp.id) + ')');
  await ev((id) => { const e = PTD.pathsui.editor; e.wset = {}; e.set = {}; e.set[id] = 1; e.sel = id; PTD.core.renderPanels(); }, gp.id); await wait(250);
  await ev(() => { PTD.pathsui.editor.focus = true; }); await p.keyboard.press('Control+d'); await wait(400);
  const gd = await ev((id) => { const g = PTD.core.state().graph, q = g.groups.filter(x => x.id !== id)[0]; return q ? { id: q.id, name: q.name, ports: PTD.graph.groupPorts(g, q.id) } : null; }, gp.id);
  ok(gd && gd.name === 'Pair copy' && gd.ports.ins.length === 2 && gd.ports.outs.length === 2, 'Ctrl+D copies a group, and the copy keeps its external ports unconnected (' + (gd ? gd.ports.ins.length + ' in, ' + gd.ports.outs.length + ' out' : 'none') + ')');
  ok(await ev((id) => { const g = PTD.core.state().graph; return !g.wires.some(w => g.groups.filter(x => x.id === id)[0] && PTD.graph.members(g, id).indexOf(w.to) >= 0 && PTD.graph.members(g, id).indexOf(w.from) < 0); }, gd && gd.id), 'the copy has no wires from outside');
  // a group goes into a wire through the search; a click on a node in the graph chooses it too
  const f4 = await ev((a) => { const g = PTD.core.state().graph, G = PTD.graph, c4 = G.addNode(g, 'circle', 0, 700), s4 = G.addNode(g, 'stroke', 700, 700); G.connect(g, c4.id, s4.id, 'in'); const e = PTD.pathsui.editor; e.set = {}; e.wset = {}; e.sel = ''; e.vb = null; PTD.core.renderPanels(); return { c: c4.id, s: s4.id }; }, prep);
  await wait(300);
  const wire4 = wk(f4.c, f4.s);
  const openWadd = async () => {
    await ev((k) => { const e = PTD.pathsui.editor; e.wset = {}; e.wset[k] = 1; PTD.core.renderPanels(); const pe = document.querySelector('.gxwirehit[data-wire="' + k + '"]'), r = pe.getBoundingClientRect(); pe.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 2 })); }, wire4); await wait(300);
    await ev(() => { [...document.querySelectorAll('#gxMenu [data-gm]')].filter(b2 => b2.dataset.gm === 'wadd')[0].click(); }); await wait(300);
  };
  await openWadd();
  const items = await ev(() => [...document.querySelectorAll('#gxMenu [data-gm]')].map(b2 => b2.dataset.gm));
  ok(items.some(x => x === 'ins:item:' + gp.id), 'the search lists the groups that fit the wire');
  const nG0 = await ev(() => PTD.core.state().graph.groups.length);
  await ev((id) => { document.querySelector('#gxMenu [data-gm="ins:item:' + id + '"]').click(); }, gp.id); await wait(500);
  const gg4 = await ev(([a]) => { const g = PTD.core.state().graph; const w = g.wires.filter(x => x.from === a.c)[0]; return { groups: g.groups.length, direct: g.wires.some(x => x.from === a.c && x.to === a.s), first: w && w.to }; }, [f4]);
  ok(gg4.groups === nG0 + 1 && !gg4.direct && !!gg4.first, 'a copy of the group is in the wire: it is wired through the group ports');
  // pick a node in the graph instead
  const wire5 = wk(f4.c, (await ev((a) => PTD.core.state().graph.wires.filter(x => x.from === a.c)[0].to, f4)));
  await ev((k) => { const e = PTD.pathsui.editor; e.wset = {}; e.wset[k] = 1; e.set = {}; e.sel = ''; e.vb = null; PTD.core.renderPanels(); }, wire5); await wait(300);
  await ev(() => { const bt = document.querySelector('#gxsvg'); });
  const q5 = await mid(wire5, 0.3); await p.mouse.move(q5.x, q5.y); await wait(300);
  await p.click('#gxsvg .gxplus'); await wait(300);
  const nRn = await nR();
  const pick = await ev(() => { const g = PTD.core.state().graph; for (const n of g.nodes.filter(n => n.type === 'round')) { const h = document.querySelector('.gxnode[data-nid="' + n.id + '"] .gxhead'); if (!h) continue; const r = h.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y); const q = t && t.closest && t.closest('#gxsvg [data-nid]'); if ((q && q.dataset.nid === n.id) || (t && t.closest && t.closest('.gxplus'))) return { x, y }; } return null; });
  ok(!!pick, 'a round node is visible outside the search list');
  if (pick) { await p.mouse.move(pick.x, pick.y); await wait(300); await p.mouse.click(pick.x, pick.y); await wait(500); }
  ok((await nR()) === nRn + 1, 'clicking a node in the graph while the search is open puts a copy of it into the wires');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
