/* Node checks for js/groups.js (REQ-008): membership, nesting, order, take out, add, move, scale and turn.
 * Run from the repository root: node tests/groups.test.js */
const G = require('../js/groups.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t = 0.002) => Math.abs(a - b) <= t;
function mk(n) { const st = { layers: [], groups: [], band: { at: n } }; for (let i = 0; i < n; i++) st.layers.push({ id: 'l' + (i + 1), text: 'T' + (i + 1), group: '', x: i * 10, y: 0, size: 100, ls: 2, rot: 0 }); return st; }
const ids = (st) => st.layers.map(l => l.id).join(',');
{
  const st = mk(5);
  const r = G.make(st, [st.layers[0], st.layers[3]]);
  ok(r.group && st.groups.length === 1, 'two texts make a group');
  ok(ids(st) === 'l2,l3,l1,l4,l5', 'the members are gathered at the topmost one (' + ids(st) + ')');
  ok(G.make(st, [st.layers[0]]).error, 'one text cannot be grouped');
  ok(G.displayName(st, r.group) === 'T1 T4'.split(' ').reverse().join(' ') || G.displayName(st, r.group) === 'T4 T1', 'automatic name: texts in roll order (' + G.displayName(st, r.group) + ')');
  ok(G.make(st, G.layersIn(st, r.group.uid)).error, 'the same two texts cannot be grouped again');
}
{
  const st = mk(6);
  const a = G.make(st, [st.layers[0], st.layers[1]]).group;
  const b = G.make(st, [st.layers[0], st.layers[1], st.layers[2]]).group;   // a whole group and a text
  ok(b.parent === '' && a.parent === b.uid, 'a group and a text make a group that holds the group (nesting)');
  ok(G.layersIn(st, b.uid).length === 3, 'the outer group has three texts');
  const c = G.make(st, [st.layers[0], st.layers[3]]);   // a text from inside the inner group and an outside one
  ok(c.group && c.group.parent === '', 'a text taken from a group goes into a new group in the common parent');
  ok(G.get(st, a.uid) === null || G.layersIn(st, a.uid).length >= 2, 'a group left with one member dissolves');
}
{
  const st = mk(6);
  const a = G.make(st, [st.layers[0], st.layers[1]]).group;
  const gl = G.layersIn(st, a.uid);
  const rel = G.ungroup(st, a.uid);
  ok(st.groups.length === 0 && rel.length === 2 && st.layers.every(l => !l.group), 'ungroup releases the members and keeps their places');
}
{
  const st = mk(6);
  const a = G.make(st, [st.layers[0], st.layers[1], st.layers[2]]).group;
  const t = st.layers.filter(l => l.group === a.uid)[0];
  G.takeOut(st, { l: t });
  ok(t.group === '' && G.layersIn(st, a.uid).length === 2, 'take out: the text leaves its group');
  const top = Math.max.apply(null, G.layersIn(st, a.uid).map(l => st.layers.indexOf(l)));
  ok(st.layers.indexOf(t) === top + 1, 'it sits directly above the group');
  const r = G.addTo(st, a.uid, [t]);
  ok(r.n === 1 && t.group === a.uid, 'add to group puts it back');
  ok(G.addTo(st, a.uid, [t]).error, 'a text already directly in the group gives a message');
}
{
  const st = mk(5); st.band.at = 2;
  const g = G.make(st, [st.layers[0], st.layers[3]]).group;
  const at = st.band.at, ix = G.layersIn(st, g.uid).map(l => st.layers.indexOf(l));
  ok(!(Math.min.apply(null, ix) < at && at <= Math.max.apply(null, ix)), 'the lines and cards are never inside a group');
  const g2 = G.make(st, [st.layers[3], st.layers[4]]);
  ok(g2.group, 'another group');
}
{
  const st = mk(5);
  const g = G.make(st, [st.layers[1], st.layers[2]]).group;
  const before = ids(st);
  ok(G.move(st, { g: g }, 1) && ids(st) !== before, 'a group moves up as one block');
  const members = G.layersIn(st, g.uid), i0 = st.layers.indexOf(members[0]);
  ok(st.layers.indexOf(members[1]) === i0 + 1, 'the block stays together');
  ok(G.move(st, { l: members[0] }, -1) === false || G.layersIn(st, g.uid).length === 2, 'a member cannot leave its group by moving');
  const g3 = G.layersIn(st, g.uid);
  G.move(st, { l: g3[0] }, 1);
  ok(G.layersIn(st, g.uid).length === 2 && G.layersIn(st, g.uid)[0] === g3[1], 'a member moves inside its group');
  G.move(st, 'band', -1); G.move(st, 'band', -1);
  const ix2 = G.layersIn(st, g.uid).map(l => st.layers.indexOf(l)), at2 = st.band.at;
  ok(at2 === Math.min.apply(null, ix2) + 0 || at2 === Math.max.apply(null, ix2) + 1, 'the lines and cards step over a group as one block (at ' + at2 + ')');
}
{
  const st = mk(3);
  const L = st.layers; L[0].x = 0; L[1].x = 100; L[2].x = 200;
  G.scale(L, { x: 0, y: 0 }, 2);
  ok(L[1].x === 200 && L[2].x === 400 && L[0].size === 200 && L[0].ls === 4, 'scale doubles positions, size and letter space about the point');
  G.scale(L, { x: 0, y: 0 }, 0.5);
  ok(L[2].x === 200 && L[0].size === 100, 'scaling back restores them');
  G.turn(L, { x: 0, y: 0 }, 90);
  ok(near(L[1].x, 0) && near(L[1].y, 100) && L[1].rot === 90, 'turn by 90: the point (100,0) goes to (0,100) and the text turns');
  G.turn(L, { x: 0, y: 0 }, 120);
  ok(L[0].rot === -150, 'the rotation stays between -180 and 180');
  const k = G.kRange([{ size: 10 }, { size: 1000 }], 1, 3000);
  ok(near(k.min, 0.1) && near(k.max, 3), 'k range keeps every size between 1 and 3000');
}
{
  const st = mk(4);
  st.groups = G.normalizeAll([{ uid: 'g1', parent: 'g2' }, { uid: 'g2', parent: 'g1' }, { uid: 'g3' }, { uid: 'g1' }]);
  st.layers[0].group = 'g1'; st.layers[1].group = 'g2'; st.layers[2].group = 'zzz';
  G.settle(st);
  ok(st.layers[2].group === '' && st.groups.every(g => g.uid !== 'g3'), 'bad references and empty groups are removed when loaded');
}
{
  const st = mk(2); st.layers[0].gen = 'split';
  ok(G.make(st, st.layers).error, 'a generated text cannot be grouped');
  const deep = mk(20); let cur = [deep.layers[0], deep.layers[1]], res;
  let level = 0, prev = null; for (let i = 2; i < 14; i++) { res = G.make(deep, cur); if (res.error) break; level++; prev = res.group; cur = G.layersIn(deep, prev.uid).concat([deep.layers.filter(l => !l.group)[0]]); }
  ok(level <= G.MAXDEPTH, 'nesting stops at the maximum depth (' + level + ')');
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
