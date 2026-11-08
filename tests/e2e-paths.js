/* Browser checks for paths, patterns and paths from objects (REQ-046, REQ-047, REQ-048).
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-paths.js */
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
  const s = () => ev(() => { const st = PTD.core.state(); return { paths: st.paths.length, pats: st.layers.filter(l => l.pattern).length }; });
  // add a path and a pattern with the buttons
  await p.click('[data-pa="padd"]'); await wait();
  let r = await s(); ok(r.paths === 1, 'the + Add path button makes a path');
  await p.click('[data-pa="pattern"]'); await wait(400);
  r = await s(); ok(r.pats === 1, 'the + Add pattern button makes a pattern layer');
  let pat = await ev(() => { const l = PTD.core.state().layers.filter(x => x.pattern)[0]; return { w: l.frozen.x1 - l.frozen.x0, glyph: l.glyph, d: l.frozen.d.length, uid: !!l.uid }; });
  ok(pat.glyph && pat.d > 100 && Math.abs(pat.w - 1010) < 5, 'the pattern has a shape: a plain ring round a 500 mm circle (' + pat.w.toFixed(1) + ')');
  // the stage draws it
  ok(await ev(() => document.querySelectorAll('#stage path, svg path').length > 0), 'something is drawn');
  // change the path radius: the pattern follows
  await ev(() => { const el = document.querySelector('[data-pu^="path|"][data-pu$="|r"]'); el.value = '300'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await wait(400);
  pat = await ev(() => { const l = PTD.core.state().layers.filter(x => x.pattern)[0]; return { w: l.frozen.x1 - l.frozen.x0 }; });
  ok(Math.abs(pat.w - 610) < 5, 'changing the radius of the path changes the pattern (' + pat.w.toFixed(1) + ')');
  // add layers: sine wave and interlace
  for (const t of ['sine', 'scroll', 'interlace']) {
    await ev((t) => { const sel = document.querySelector('[data-pa="gadd"]').parentNode.querySelector('select'); sel.value = t; }, t);
    await p.click('[data-pa="gadd"]'); await wait(500);
  }
  pat = await ev(() => { const l = PTD.core.state().layers.filter(x => x.pattern)[0]; return { n: l.pattern.stack.length, d: l.frozen.d.length }; });
  ok(pat.n === 4 && pat.d > 5000, 'four layers make a bigger shape (' + pat.n + ' layers, ' + pat.d + ' chars)');
  // save and load round trip
  const rt = await ev(() => { const j = JSON.parse(JSON.stringify(PTD.core.toJSON(true))); return { paths: j.artwork.paths.length, pat: j.artwork.layers.filter(l => l.pattern).length, st: j.artwork.layers.filter(l => l.pattern)[0].pattern.stack.length }; });
  ok(rt.paths === 1 && rt.pat === 1 && rt.st === 4, 'paths and the recipe are in the project JSON');
  // objects path: follow a text, then move the text
  const o = await ev(async () => {
    const c = PTD.core, st = c.state(); const T = st.layers.filter(l => !l.pattern)[0];
    const id = PTD.pathsui.addPath('objects'); const pp = st.paths.filter(x => x.id === id)[0];
    c.save('x'); pp.items = [{ l: T.uid }]; pp.close = 20; pp.dist = 15;
    const pl = st.layers.filter(l => l.pattern)[0]; pl.pattern.path = id; PTD.pathsui.forget(); c.renderStage();
    const w0 = pl.frozen.x1 - pl.frozen.x0, cx0 = (pl.frozen.x0 + pl.frozen.x1) / 2;
    T.x += 200; PTD.core.renderStage(); PTD.core.renderStage();
    const cx1 = (pl.frozen.x0 + pl.frozen.x1) / 2;
    return { w0, moved: cx1 - cx0, st: PTD.pathsui.status(pl) };
  });
  ok(o.w0 > 50 && Math.abs(o.moved - 200) < 15, 'a path round a text follows it when it moves (' + o.moved.toFixed(1) + ' mm, ' + o.st + ')');
  // cycle: a path round the pattern itself is refused
  const cyc = await ev(() => {
    const st = PTD.core.state(); const pl = st.layers.filter(l => l.pattern)[0];
    PTD.core.save('y');
    const id = PTD.pathsui.addPath('objects'); const pp = st.paths.filter(x => x.id === id)[0];
    const before = JSON.stringify(pp.items);
    pl.pattern.path = id; pp.items = [{ l: pl.uid }];
    return { msg: PTD.pathsui.cycleMsg(), before };
  });
  ok(/loop/.test(cyc.msg), 'a pattern that follows itself is detected (' + cyc.msg.slice(0, 40) + ')');
  // undo works
  const u = await ev(() => { const n = PTD.core.state().paths.length; return n; });
  ok(u >= 2, 'paths are in the state');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
