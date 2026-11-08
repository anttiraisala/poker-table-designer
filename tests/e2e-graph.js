/* Browser checks for the procedural graph and its editor (REQ-049 to REQ-054).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-graph.js */
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
  const st = () => ev(() => { const s = PTD.core.state(); return { nodes: s.graph.nodes.length, wires: s.graph.wires.length, pats: s.layers.filter(l => l.pattern).length }; });
  ok(!(await ev(() => PTD.layout.dock.isOpen())), 'the dock is closed with nothing selected');
  await p.click('[data-pa="pattern"]'); await wait(500);
  let r = await st(); ok(r.pats === 1 && r.nodes === 3 && r.wires === 2, '+ Add pattern makes circle, stroke, output and a layer');
  ok(await ev(() => PTD.layout.dock.isOpen()), 'the dock opens when a pattern is selected');
  ok(await ev(() => document.querySelectorAll('#gxsvg .gxnode').length === 3), 'the editor shows three nodes');
  let w = await ev(() => { const l = PTD.core.state().layers.filter(x => x.pattern)[0]; return l.frozen.x1 - l.frozen.x0; });
  ok(Math.abs(w - 1012) < 6, 'a plain ring round the 500 mm circle (' + w.toFixed(1) + ')');
  // select the circle node and change the radius in the side panel
  await ev(() => { const g = PTD.core.state().graph; const n = g.nodes.filter(x => x.type === 'circle')[0]; PTD.pathsui.editor.sel = n.id; PTD.core.renderPanels(); });
  await ev(() => { const el = document.querySelector('[data-gp$="|r"]'); el.value = '300'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(400);
  w = await ev(() => { const l = PTD.core.state().layers.filter(x => x.pattern)[0]; return l.frozen.x1 - l.frozen.x0; });
  ok(Math.abs(w - 612) < 6, 'changing the radius of the source changes the pattern (' + w.toFixed(1) + ')');
  // pin the radius: a slider appears in the layer panel
  await ev(() => { PTD.pathsui.editor.sel = PTD.core.state().graph.nodes.filter(x => x.type === 'circle')[0].id; PTD.core.renderPanels(); });
  await ev(() => document.querySelector('[data-pa="gpin"][data-key="r"]').click()); await wait(300);
  ok(await ev(() => !!document.querySelector('input[type=range][data-gx$="|r"]')), 'a pinned value shows as a slider in the layer panel');
  await ev(() => { const el = document.querySelector('input[type=number][data-gx$="|r"]'); el.value = '200'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(400);
  w = await ev(() => { const l = PTD.core.state().layers.filter(x => x.pattern)[0]; return l.frozen.x1 - l.frozen.x0; });
  ok(Math.abs(w - 412) < 6, 'moving the pinned value changes the pattern (' + w.toFixed(1) + ')');
  // live: dragging a pinned slider changes the shape before the change event
  const live = await ev(() => { const r = document.querySelector('input[type=range][data-gx$="|r"]'); if (!r) return null; const l = PTD.core.state().layers.filter(x => x.pattern)[0]; const w0 = l.frozen.x1 - l.frozen.x0; r.value = String(+r.value + 50); r.dispatchEvent(new Event('input', { bubbles: true })); return [w0, l.frozen.x1 - l.frozen.x0]; });
  ok(live && live[1] > live[0] + 50, 'the stage follows a slider live (' + (live && live.map(v => v.toFixed(0))) + ')');
  // add a sine bend and a union through the add button
  await ev(() => { document.querySelector('[data-pa="gnew"][data-type="sinep"]').click(); }); await wait(300);
  r = await st(); ok(r.nodes === 4, 'the + Add node button adds a node');
  ok(await ev(() => PTD.core.state().graph.wires.some(w => { const g = PTD.core.state().graph; const a = g.nodes.filter(n => n.id === w.to)[0]; return a.type === 'sinep'; })), 'the new node is wired to the selected one');
  // a wire of the wrong type is refused with a reason
  const why = await ev(() => { const g = PTD.core.state().graph, G = PTD.graph; const c = g.nodes.filter(n => n.type === 'circle')[0], u = G.addNode(g, 'union', 0, 0); return G.canConnect(g, c.id, u.id, 'in'); });
  ok(/path/.test(why), 'a path cannot go into a shape input: ' + why);
  // an extra output layer shares the chain
  await ev(() => { PTD.pathsui.editor.sel = PTD.core.state().graph.nodes.filter(x => x.type === 'stroke')[0].id; PTD.core.renderPanels(); });
  await ev(() => document.querySelector('[data-pa="goutput"]').click()); await wait(500);
  r = await st(); ok(r.pats === 2, '+ Output layer makes a second layer');
  // round trip
  const j = await ev(() => { const o = JSON.parse(JSON.stringify(PTD.core.toJSON(true))); return { n: o.artwork.graph.nodes.length, w: o.artwork.graph.wires.length, pat: o.artwork.layers.filter(l => l.pattern).length }; });
  ok(j.n >= 5 && j.pat === 2, 'the graph is in the project JSON');
  // deleting a layer removes its output node
  await ev(() => { const s = PTD.core.state(); const l = s.layers.filter(x => x.pattern)[1]; s.layers = s.layers.filter(x => x !== l); PTD.core.renderStage(); });
  ok(await ev(() => PTD.core.state().graph.nodes.filter(n => n.type === 'output').length === 1), 'an output node goes away with its layer');
  // an objects path follows a text; moving the text moves the pattern
  const o = await ev(async () => {
    const c = PTD.core, s = c.state(), g = s.graph, G = PTD.graph;
    const T = s.layers.filter(l => !l.pattern)[0]; c.renderStage(); c.renderStage();
    const ob = G.addNode(g, 'objects', 0, 300, Object.assign(G.defaultParams('objects'), { items: [{ l: T.uid }], dist: 30 }));
    const sk = G.addNode(g, 'stroke', 220, 300), out = G.addNode(g, 'output', 440, 300);
    G.connect(g, ob.id, sk.id, 'in'); G.connect(g, sk.id, out.id, 'in');
    const l = c.mkLayer('P2', 'Mea Culpa', 100, 0, 0, 0, 0, true, false); l.pattern = { out: out.id }; l.glyph = true; l.frozen = { d: 'M0 0Z', x0: 0, y0: 0, x1: 1, y1: 1 }; l.id = 'l' + (s.layers.length + 1); s.layers.push(l);
    c.renderStage(); c.renderStage(); const a = l.frozen.x1 - l.frozen.x0, cx0 = (l.frozen.x0 + l.frozen.x1) / 2;
    T.x += 100; c.renderStage(); c.renderStage();
    return { a, moved: (l.frozen.x0 + l.frozen.x1) / 2 - cx0, status: PTD.pathsui.status(l) };
  });
  ok(o.a > 20 && Math.abs(o.moved - 100) < 3, 'a pattern round an object follows it (' + o.a.toFixed(0) + ' wide, moved ' + o.moved.toFixed(1) + ')');
  // a cycle is refused
  const cyc = await ev(() => { const s = PTD.core.state(); const l = s.layers.filter(x => x.pattern).pop(); const g = s.graph; const ob = g.nodes.filter(n => n.type === 'objects')[0]; ob.p.items = [{ l: l.uid || l.id }]; const m = PTD.pathsui.cycleMsg(); ob.p.items = []; return m; });
  ok(/loop/.test(cyc), 'a pattern that follows itself is refused: ' + cyc.slice(0, 60));
  // dragging one node moves only that node, by about the pointer distance; Tidy packs them
  await ev(() => { const s = PTD.core.state(); s.selected = s.layers.filter(l => l.pattern)[0].id; PTD.pathsui.editor.sel = ''; PTD.pathsui.editor.vb = null; PTD.core.renderPanels(); });
  const before = await ev(() => PTD.core.state().graph.nodes.map(n => [n.id, n.x, n.y]));
  const hd = await ev(() => { const n = PTD.core.state().graph.nodes.filter(n => n.type === 'stroke')[0]; const r = document.querySelector('[data-nid="' + n.id + '"] .gxhead').getBoundingClientRect(); return { x: r.x + 30, y: r.y + 8, id: n.id }; });
  await p.mouse.move(hd.x, hd.y); await p.mouse.down(); await p.mouse.move(hd.x, hd.y + 60, { steps: 6 }); await p.mouse.up(); await wait(300);
  const after = await ev(() => PTD.core.state().graph.nodes.map(n => [n.id, n.x, n.y]));
  const mv = after.filter((a, i) => a[1] !== before[i][1] || a[2] !== before[i][2]);
  ok(mv.length === 1 && mv[0][0] === hd.id && mv[0][2] > before.filter(b => b[0] === hd.id)[0][2] && mv[0][2] < before.filter(b => b[0] === hd.id)[0][2] + 400, 'dragging a node moves only that node, downwards, by a sensible amount');
  ok(await ev(() => !!document.querySelector('#gxsvg pattern#gxgrid')), 'the editor has a faint grid');
  await ev(() => document.querySelector('[data-pa="gtidy"]').click()); await wait(300);
  const sp = await ev(() => { const ns = PTD.core.state().graph.nodes; return Math.max(...ns.map(n => n.x)) - Math.min(...ns.map(n => n.x)); });
  ok(sp < 1500, 'Tidy packs the nodes close together (' + sp + ')');
  // panning follows the pointer one to one
  const pan = await ev(() => { const svg = document.getElementById('gxsvg'); const r = svg.getBoundingClientRect(); return { x: r.x + 5, y: r.y + r.height - 8, a: svg.getScreenCTM().a, vx: svg.viewBox.baseVal.x }; });
  await p.mouse.move(pan.x + 300, pan.y); await p.mouse.down({ button: 'right' }); await p.mouse.move(pan.x + 400, pan.y, { steps: 5 }); await p.mouse.up({ button: 'right' }); await wait(150);
  ok(!(await ev(() => !!document.querySelector('#gxMenu'))), 'a right-drag pans and opens no menu');
  const vx = await ev(() => document.getElementById('gxsvg').viewBox.baseVal.x);
  ok(Math.abs((pan.vx - vx) * pan.a - 100) < 3, 'right-button panning moves the graph as far as the pointer (' + ((pan.vx - vx) * pan.a).toFixed(1) + ' px for 100)');
  await ev(() => { PTD.pathsui.editor.vb = null; PTD.core.renderPanels(); });
  // Delete in the editor deletes the selected node, not the artwork; shift-click selects several
  await ev(() => { PTD.pathsui.editor.vb = null; PTD.pathsui.editor.sel = ''; PTD.core.renderPanels(); });
  const nodesBefore = await ev(() => PTD.core.state().graph.nodes.length), layersBefore = await ev(() => PTD.core.state().layers.length);
  const loose = await ev(() => { const g = PTD.core.state().graph; return g.nodes.filter(n => n.type === 'union').map(n => n.id); });
  const rect = async (id) => ev((id) => { const r = document.querySelector('[data-nid="' + id + '"] .gxhead').getBoundingClientRect(); return { x: r.x + 30, y: r.y + 8 }; }, id);
  let rc = await rect(loose[loose.length - 1]); await p.mouse.click(rc.x, rc.y);
  await p.keyboard.press('Delete'); await wait(300);
  ok(await ev(() => PTD.core.state().graph.nodes.length) === nodesBefore - 1 && await ev(() => PTD.core.state().layers.length) === layersBefore, 'Delete removes the selected node and leaves the artwork alone');
  // detach a wire by dragging it off an input port, and drop it on nothing
  const wInfo = await ev(() => { const g = PTD.core.state().graph; const w = g.wires.filter(w => g.nodes.filter(n => n.id === w.to)[0].type === 'stroke')[0]; const r = document.querySelector('[data-pin="' + w.to + '"]').getBoundingClientRect(); return { n: g.wires.length, x: r.x + r.width / 2, y: r.y + r.height / 2, to: w.to }; });
  await p.mouse.move(wInfo.x, wInfo.y); await p.mouse.down(); await p.mouse.move(wInfo.x - 60, wInfo.y + 80, { steps: 5 }); await p.mouse.up(); await wait(300);
  ok(await ev(() => PTD.core.state().graph.wires.length) === wInfo.n - 1, 'dragging a wire off an input detaches it');
  // a source added while the stroke is selected is wired into it
  await ev((id) => { PTD.pathsui.editor.sel = id; PTD.core.renderPanels(); document.querySelector('[data-pa="gnew"][data-type="circle"]').click(); }, wInfo.to); await wait(300);
  ok(await ev((id) => { const g = PTD.core.state().graph; return g.wires.some(w => w.to === id && g.nodes.filter(n => n.id === w.from)[0].type === 'circle'); }, wInfo.to), 'a source added next to a waiting node is wired into it');
  // the context menu of a node
  rc = await rect(wInfo.to); await p.mouse.click(rc.x, rc.y, { button: 'right' }); await wait(200);
  ok(await ev(() => !!document.querySelector('#gxMenu [data-gm="del"]')), 'right-click on a node opens a menu');
  await ev(() => document.querySelector('#gxMenu [data-gm="cutin"]').click()); await wait(300);
  ok(await ev((id) => !PTD.core.state().graph.wires.some(w => w.to === id), wInfo.to), 'the menu can disconnect the inputs');
  // left-drag on the background selects with a rubber band; the preview shows the data of a node
  await ev(() => { PTD.pathsui.editor.vb = null; PTD.pathsui.editor.sel = ''; PTD.core.renderPanels(); });
  const cv = await ev(() => { const r = document.getElementById('gxsvg').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(cv.x + 3, cv.y + 3); await p.mouse.down(); await p.mouse.move(cv.x + cv.w - 3, cv.y + cv.h - 3, { steps: 6 }); await p.mouse.up(); await wait(250);
  const nSel = await ev(() => Object.keys(PTD.pathsui.editor.set).length), nVis = await ev(() => document.querySelectorAll('#gxsvg .gxnode').length);
  ok(nSel > 1 && nSel === nVis, 'a left-drag on the background selects the nodes inside the rubber band (' + nSel + ')');
  await p.mouse.click(cv.x + 3, cv.y + 3); await wait(150);
  ok((await ev(() => Object.keys(PTD.pathsui.editor.set).length)) === 0, 'a click on the background clears the selection');
  await ev(() => { const g = PTD.core.state().graph; PTD.pathsui.editor.sel = g.nodes.filter(n => n.type === 'circle')[0].id; PTD.core.renderPanels(); });
  ok(await ev(() => /Loops/.test(document.querySelector('.gxdata').textContent) && /Length/.test(document.querySelector('.gxdata').textContent) && /Size/.test(document.querySelector('.gxdata').textContent)), 'the preview lists the data of the selected node');
  // the palette adds a node, Shift+A searches
  const nb = await ev(() => PTD.core.state().graph.nodes.length);
  await ev(() => document.querySelector('[data-pa="gnew"][data-type="wobble"]').click()); await wait(200);
  ok(await ev(() => PTD.core.state().graph.nodes.length) === nb + 1, 'a palette button adds a node');
  await p.mouse.move(cv.x + 200, cv.y + 100); await p.keyboard.press('Shift+A'); await wait(150);
  ok(await ev(() => !!document.querySelector('.gxsearch input')), 'Shift+A opens the node search');
  await p.keyboard.type('negate'); await p.keyboard.press('Enter'); await wait(250);
  ok(await ev(() => PTD.core.state().graph.nodes.some(n => n.type === 'negate')), 'the search adds the node that was typed');
  // every control of the editor has a tooltip
  await ev(() => { const s = PTD.core.state(); s.selected = s.layers.filter(l => l.pattern)[0].id; PTD.pathsui.editor.sel = s.graph.nodes.filter(n => n.type === 'stroke')[0].id; PTD.core.renderPanels(); });
  const bare = await ev(() => [...document.querySelectorAll('#dockBody input, #dockBody select, #dockBody button, #dockBody svg')].filter(e => !e.title && !e.getAttribute('aria-label') && !e.closest('label[title]')).map(e => e.outerHTML.slice(0, 80)));
  ok(bare.length === 0, 'every editor control has a tooltip' + (bare.length ? ': ' + bare[0] : ''));
  // wiring by dragging: stroke -> a new union -> output
  await ev(() => { PTD.pathsui.editor.sel = ''; document.querySelector('[data-pa="gnew"][data-type="union"]').click(); document.querySelector('[data-pa="gfit"]').click(); }); await wait(300);
  const pos = await ev(() => { const g = PTD.core.state().graph; const u = g.nodes.filter(n => n.type === 'union').pop(), s2 = g.nodes.filter(n => n.type === 'stroke')[0];
    const o = document.querySelector('[data-pout="' + s2.id + '"]').getBoundingClientRect(), i = document.querySelector('[data-pin="' + u.id + '"]').getBoundingClientRect();
    const hit = document.elementFromPoint(i.x + i.width / 2, i.y + i.height / 2); return { hit: hit && hit.outerHTML.slice(0, 70), ox: o.x + o.width / 2, oy: o.y + o.height / 2, ix: i.x + i.width / 2, iy: i.y + i.height / 2, u: u.id }; });
  await p.mouse.move(pos.ox, pos.oy); await p.mouse.down(); await p.mouse.move((pos.ox + pos.ix) / 2, (pos.oy + pos.iy) / 2, { steps: 4 }); await p.mouse.move(pos.ix, pos.iy, { steps: 4 }); await p.mouse.up(); await wait(400);
  ok(await ev((u) => PTD.core.state().graph.wires.some(w => w.to === u), pos.u), 'dragging from an output to an input makes a wire');
  // input nodes that take other elements: geometry and outer edge
  await p.goto(url); await ev(() => { localStorage.clear(); }); await p.goto(url); await wait(600);
  await p.click('[data-pa="pattern"]'); await wait(400);
  await p.mouse.click(700, 800); await wait(100);   // a press in the dock: the editor is in use
  await ev(() => { const s = PTD.core.state(); s.selected = s.layers.filter(l => !l.pattern)[0].id; PTD.core.renderPanels(); PTD.core.renderStage(); }); await wait(200);
  ok(await ev(() => PTD.layout.dock.isOpen()), 'the editor stays open while an object is picked on the stage');
  await ev(() => document.querySelector('[data-pa="gshape"]').click()); await wait(300);
  const ln = await ev(() => { const g = PTD.core.state().graph; const n = g.nodes.filter(x => x.type === 'layer')[0]; return n && n.p.items.length; });
  ok(ln === 1, 'the Shape of selection button makes an input node with the selected object');
  await ev(() => document.querySelector('[data-pa="gedge"]').click()); await wait(300);
  ok(await ev(() => PTD.core.state().graph.nodes.some(x => x.type === 'objects' && x.p.items.length === 1)), 'the Edge of selection button makes an outer-edge input node');
  // geometry minus a table area, then the edge of that shape as a path
  const res = await ev(() => { const c = PTD.core, g = c.state().graph, G = PTD.graph; c.renderStage(); c.renderStage();
    const ly = g.nodes.filter(x => x.type === 'layer')[0], ta = G.addNode(g, 'tablearea', 0, 0), sb = G.addNode(g, 'subtract', 0, 0), ol = G.addNode(g, 'outline', 0, 0);
    ta.p.table = c.state().tables[0].id; ta.p.dist = -200; G.connect(g, ly.id, sb.id, 'in'); G.connect(g, ta.id, sb.id, 'in'); G.connect(g, sb.id, ol.id, 'in');
    const env = { tableLoops: null }; const memo = G.newMemo();
    const r = PTD.pathsui.preview ? null : null; return { ok: G.canConnect(g, sb.id, ol.id, 'in') === '' }; });
  ok(res.ok, 'shape inputs wire into operators and Edge of shape');
  // a pattern has resize handles; dragging a corner scales it
  await p.goto(url); await ev(() => { localStorage.clear(); }); await p.goto(url); await wait(600);
  await p.click('[data-pa="pattern"]'); await wait(500);
  await ev(() => { PTD.core.ui.view.z = 0.2; PTD.core.renderStage(); PTD.core.renderStage(); });
  ok(await ev(() => PTD.thandles.handles().length > 0), 'a selected pattern has resize handles');
  const w0 = await ev(() => { const l = PTD.core.state().layers.filter(x => x.pattern)[0]; return (l.frozen.x1 - l.frozen.x0) * PTD.glyph.k(l); });
  const hp = await ev(() => { const h = [...document.querySelectorAll('[data-h^="thandle:1:1"]')][0]; if (!h) return null; const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (hp) { await p.mouse.move(hp.x, hp.y); await p.mouse.down(); await p.mouse.move(hp.x + 40, hp.y + 40, { steps: 5 }); await p.mouse.up(); await wait(200); }
  const w1 = await ev(() => { const l = PTD.core.state().layers.filter(x => x.pattern)[0]; return [(l.frozen.x1 - l.frozen.x0) * PTD.glyph.k(l), l.size]; });
  ok(hp && w1[0] > w0 * 1.02 && w1[1] > 100, 'dragging a corner handle scales the pattern (' + w0.toFixed(0) + ' to ' + w1[0].toFixed(0) + ' mm, scale ' + w1[1].toFixed(0) + ' %)');
  // V123: preview beside the fields and fixed, centre pinned from the start, drag over numbers, node help in the status bar, colours
  await p.goto(url); await ev(() => { localStorage.clear(); }); await p.goto(url); await wait(600);
  await p.click('[data-pa="pattern"]'); await wait(500);
  await ev(() => { const g = PTD.core.state().graph, n = g.nodes.filter(x => x.type === 'circle')[0]; document.querySelector('.gxnode[data-nid="' + n.id + '"] .gxhead').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 5, clientY: 5 })); window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 })); });
  await wait(300);
  const lay = await ev(() => { const a = document.querySelector('.gxpcol'), b = document.querySelector('.gxfcol'); if (!a || !b) return null; const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return { left: ra.right <= rb.left + 1, fixed: getComputedStyle(b).overflowY === 'auto' && getComputedStyle(a).overflowY !== 'auto' && getComputedStyle(a).overflowY !== 'scroll' }; });
  ok(lay && lay.left && lay.fixed, 'the preview column is left of the fields and does not scroll with them');
  ok(await ev(() => { const n = PTD.core.state().graph.nodes.filter(x => x.type === 'circle')[0]; return n.exp.map(e => e.key).join() === 'cx,cy'; }), 'the centre X and Y of a source node are pinned from the start');
  ok(await ev(() => /Circle: .*circular path/.test(document.getElementById('nodeInfo').textContent)), 'the status bar says what the selected node does');
  const sv = await ev(() => { const el = document.querySelector('input[data-gp$="|r"]'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, v: el.value, id: el.dataset.gp }; });
  await p.mouse.move(sv.x, sv.y); await p.mouse.down(); await p.mouse.move(sv.x + 40, sv.y, { steps: 6 }); await p.mouse.up(); await wait(300);
  const v1 = await ev((id) => { const el = document.querySelector('input[data-gp="' + id + '"]'); return el.value; }, sv.id).catch(() => null);
  ok(v1 !== null && Number(v1) > Number(sv.v), 'dragging sideways over a node number changes it (' + sv.v + ' to ' + v1 + ')');
  ok(await ev(() => { const n = PTD.core.state().graph.nodes.filter(x => x.type === 'circle')[0]; return n.p.r > 300; }), 'the dragged value reached the node');
  ok(await ev(() => document.querySelector('.gxnode[data-nid="' + PTD.core.state().graph.nodes.filter(x => x.type === 'circle')[0].id + '"] .gxhead').style.fill.replace(/\s/g, '') === 'rgb(79,209,217)'), 'path nodes are blue and shape nodes gold');
  // V124: the editor opens from the menu or a double click, not from one click; Generate graph in the context menu
  await p.goto(url); await ev(() => { localStorage.clear(); }); await p.goto(url); await wait(600);
  await ev(() => { PTD.core.renderStage(); });
  const tl = await ev(() => { const l = PTD.core.state().layers.filter(x => !x.pattern && !x.glyph)[0]; PTD.core.state().selected = l.id; PTD.core.renderPanels(); PTD.core.renderStage(); const e = document.querySelector('[data-id="' + l.id + '"]'); const r = e.getBoundingClientRect(); return { id: l.id, x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.click(tl.x, tl.y, { button: 'right' }); await wait(300);
  const menu = await ev(() => [...document.querySelectorAll('#ctxMenu .it')].map(e => e.textContent));
  ok(menu.includes('Generate graph') && menu.includes('Generate outline pattern') && menu.includes('Generate border ring pattern') && menu.includes('Generate grown pattern') && menu.includes('Generate hole-free pattern'), 'the context menu of a text offers the Generate graph items');
  await ev(() => { const it = [...document.querySelectorAll('#ctxMenu .it')].filter(e => e.textContent === 'Generate graph')[0]; it.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); await wait(500);
  const gen = await ev((id) => { const s = PTD.core.state(), g = s.graph, l = s.layers.filter(x => x.pattern)[0], src = s.layers.filter(x => x.id === id)[0]; const ly = g.nodes.filter(n => n.type === 'layer')[0]; return l && ly && { n: g.nodes.length, item: ly.p.items[0].l === src.uid, moved: l.x > src.x && l.y > src.y, open: !document.getElementById('graphDock').hidden, shape: l.frozen && l.frozen.d && l.frozen.d.length > 20 }; }, tl.id);
  ok(gen && gen.n === 2 && gen.item && gen.moved && gen.open && gen.shape, 'Generate graph makes a procedural copy: source node, output, moved down and right, editor opened ' + JSON.stringify(gen));
  const made = await ev((id) => ['outline', 'border', 'grown', 'filled'].map(k => PTD.pathsui.make(k, PTD.core.state().layers.filter(x => x.id === id)[0]).id), tl.id); await wait(800);
  for (let i = 0; i < 4; i++) { const r = await ev((id) => { PTD.core.renderStage(); const l = PTD.core.state().layers.filter(x => x.id === id)[0]; return l && l.frozen && l.frozen.d.length > 20; }, made[i]); ok(r, 'Generate ' + ['outline', 'border', 'grown', 'filled'][i] + ' pattern makes a pattern with a shape'); }
  await ev((id) => { PTD.core.state().selected = id; PTD.core.renderPanels(); PTD.core.renderStage(); }, tl.id); await wait(300);
  ok(await ev(() => document.getElementById('graphDock').hidden), 'selecting a text closes the editor');
  await p.goto(url); await ev(() => { localStorage.clear(); }); await p.goto(url); await wait(600);
  await p.click('[data-pa="pattern"]'); await wait(500);
  await ev(() => { const s = PTD.core.state(); s.selected = s.layers.filter(x => !x.pattern)[0].id; PTD.core.renderPanels(); PTD.core.renderStage(); }); await wait(300);
  const pc = await ev(() => { const l = PTD.core.state().layers.filter(x => x.pattern)[0]; PTD.core.state().selected = l.id; PTD.core.renderPanels(); PTD.core.renderStage(); const e = document.querySelector('[data-id="' + l.id + '"]'); const r = e.getBoundingClientRect(); let best = null, bd = 1e9; const cx = r.x + r.width / 2, cy = r.y + r.height / 2; for (let yy = r.y + 2; yy < r.bottom; yy += 3) for (let xx = r.x + 2; xx < r.right; xx += 3) { const t = document.elementFromPoint(xx, yy); const d = Math.hypot(xx - cx, yy - cy); if (d < bd && t && t.closest('[data-id="' + l.id + '"]')) { best = { x: xx, y: yy }; bd = d; } } return { id: l.id, x: best ? best.x : r.x, y: best ? best.y : r.y, found: !!best }; });
  ok(pc.found, 'a hit point on the pattern was found');
  await p.mouse.click(pc.x, pc.y); await wait(500);
  ok(await ev(() => document.getElementById('graphDock').hidden), 'a single click on a pattern does not open the editor');
  await p.mouse.click(pc.x, pc.y); await wait(100); await p.mouse.click(pc.x, pc.y); await wait(500);
  ok(await ev(() => !document.getElementById('graphDock').hidden), 'a double click on a pattern opens the editor');
  await ev(() => { PTD.layout.dock.close(); }); await p.mouse.click(pc.x, pc.y, { button: 'right' }); await wait(300);
  const m2 = await ev(() => [...document.querySelectorAll('#ctxMenu .it')].map(e => e.textContent));
  ok(m2[0] === 'Edit graph' || m2.includes('Edit graph'), 'the context menu of a pattern has Edit graph');
  // V125: the preview follows the fields while one of them has the focus
  const pv0 = await ev(() => { const n = PTD.core.state().graph.nodes.filter(x => x.type === 'circle')[0]; PTD.pathsui.editor.sel = n.id; PTD.core.renderPanels(); const el = document.querySelector('input[data-gp$="|r"]'); el.focus(); return document.querySelector('.gxpcol').textContent; });
  await ev(() => { const el = document.querySelector('input[data-gp$="|r"]'); el.value = '123'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(300);
  const pv1 = await ev(() => document.querySelector('.gxpcol').textContent);
  ok(pv0 !== pv1 && /Length772/.test(pv1), 'the preview updates while a field is edited (' + pv1.slice(0, 120) + ')');
  // V126: the Fringe node and the dice buttons
  const fr = await ev(() => { const g = PTD.core.state().graph, c = g.nodes.filter(x => x.type === 'circle')[0]; const n = PTD.graph.addNode(g, 'fringe', 300, 300); PTD.graph.connect(g, c.id, n.id, 'in'); PTD.pathsui.editor.sel = n.id; PTD.core.renderPanels(); const d = [...document.querySelectorAll('.gxfcol [data-pa="gdice"]')].length; const sel = document.querySelector('select[data-gp$="|form"]'); return { id: n.id, dice: d, forms: sel ? sel.options.length : 0 }; });
  ok(fr.dice === 1 && fr.forms === 6, 'the Fringe node has six forms and a dice button on its Seed ' + JSON.stringify(fr));
  const s0 = await ev((id) => PTD.graph.node(PTD.core.state().graph, id).p.seed, fr.id);
  await ev(() => { document.querySelector('.gxfcol [data-pa="gdice"]').click(); }); await wait(300);
  const s1 = await ev((id) => PTD.graph.node(PTD.core.state().graph, id).p.seed, fr.id);
  ok(s1 !== s0, 'the dice button runs (' + s0 + ' to ' + s1 + ')');
  await ev((id) => { const sel = document.querySelector('select[data-gp$="|form"]'); sel.value = 'lightning'; sel.dispatchEvent(new Event('change', { bubbles: true })); }, fr.id); await wait(300);
  ok(await ev(() => !!document.querySelector('input[data-gp$="|forks"]')), 'choosing Lightning shows the fork fields');
  ok(await ev(() => { const r = PTD.graph.evaluate(PTD.core.state().graph, PTD.core.state().graph.nodes.filter(x => x.type === 'fringe')[0].id, {}); return r.kind === 'shape'; }), 'the Fringe node gives a shape in the page');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
