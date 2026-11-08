/* Groups of texts (REQ-008). A group is a named set of texts and other groups (groups nest). It stores only its members: a text has
 * `group` (the uid of its group or ""), a group has `parent` (the uid of the group it is in or ""). Moving, scaling or turning a group
 * changes the x, y, size, ls and rot of every text in it directly (the transform is baked in), so there is no group frame and
 * everything that follows a text (control points, measurements, snapping, exports) works as before.
 * The texts of a group are always next to each other in the stack (state.layers); `settle` makes that true again after a change.
 * This file has no DOM and is tested in Node (tests/groups.test.js). `st` is the state: { layers, groups, band }. */
(function (PTD) {
  "use strict";
  var G = {};
  var MAXDEPTH = 8;   /* the deepest nesting: a group in a group in a group ... (8 levels) */
  G.MAXDEPTH = MAXDEPTH;
  function arr(st) { return st.groups || (st.groups = []); }
  function r3(v) { return Math.round(v * 1000) / 1000; }

  G.get = function (st, uid) { return uid ? (arr(st).filter(function (g) { return g.uid === uid; })[0] || null) : null; };
  /* The groups a text is in, the innermost first. */
  G.chain = function (st, l) {
    var out = [], g = G.get(st, l && l.group), n = 0;
    while (g && n++ < 64) { out.push(g); g = G.get(st, g.parent); }
    return out;
  };
  G.top = function (st, l) { var c = G.chain(st, l); return c.length ? c[c.length - 1] : null; };
  G.depth = function (st, g) { var n = 0, p = G.get(st, g.parent); while (p && n < 64) { n++; p = G.get(st, p.parent); } return n; };
  G.inGroup = function (st, l, uid) { return G.chain(st, l).some(function (g) { return g.uid === uid; }); };
  G.layersIn = function (st, uid) { return st.layers.filter(function (l) { return G.inGroup(st, l, uid); }); };
  G.subgroups = function (st, uid) { return arr(st).filter(function (g) { return (g.parent || "") === uid; }); };
  /* All groups below uid (any depth). */
  G.descendants = function (st, uid) {
    var out = [], todo = [uid], n = 0;
    while (todo.length && n++ < 1000) { var u = todo.pop(); G.subgroups(st, u).forEach(function (g) { out.push(g); todo.push(g.uid); }); }
    return out;
  };
  function height(st, g) { var h = 0; G.subgroups(st, g.uid).forEach(function (c) { h = Math.max(h, 1 + height(st, c)); }); return h; }

  /* The name shown for a group: its own name, or (automatic) the texts in it in roll order (top to bottom), cut at 24 characters. */
  G.displayName = function (st, g) {
    if (!g.nameAuto && g.name) return g.name;
    var texts = G.layersIn(st, g.uid).slice().reverse().map(function (l) { return String(l.text || "").trim(); }).filter(Boolean).join(" ");
    if (!texts) return "Group " + (g.autoNo || 1);
    return texts.length > 24 ? texts.slice(0, 24).replace(/\s+$/, "") + "…" : texts;
  };
  function newUid(st) {
    var n = 1, used = {}; arr(st).forEach(function (g) { used[g.uid] = 1; });
    while (used["g" + n]) n++;
    return "g" + n;
  }
  function newAutoNo(st) {
    var used = {}; arr(st).forEach(function (g) { if (g.autoNo) used[g.autoNo] = 1; });
    var n = 1; while (used[n]) n++;
    return n;
  }
  /* One group from saved data (no checks against the texts: `prune` does that). */
  G.normalize = function (o, i) {
    o = o || {};
    var autoNo = Math.round(Number(o.autoNo)); if (!(autoNo >= 1)) autoNo = i + 1;
    var name = String(o.name == null ? "" : o.name);
    return { uid: String(o.uid || ""), name: name, nameAuto: o.nameAuto === undefined ? !name : !!o.nameAuto || !name,
      autoNo: autoNo, open: o.open !== false, parent: String(o.parent || "") };
  };
  G.normalizeAll = function (list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (o, i) {
      var g = G.normalize(o, i);
      if (!g.uid || seen[g.uid]) return;
      seen[g.uid] = 1; out.push(g);
    });
    return out;
  };

  /* Removes what cannot stand: references to groups that do not exist, loops, empty groups and groups with a single member
   * (a group needs at least two members: texts or groups). Returns true when something changed. */
  G.prune = function (st) {
    var changed = false, guard = 0;
    var list = arr(st);
    st.layers.forEach(function (l) { if (typeof l.group !== "string") { l.group = String(l.group || ""); } });
    while (guard++ < 200) {
      var again = false, byUid = {};
      st.groups = list = arr(st).filter(function (g) { if (!g.uid || byUid[g.uid]) { again = true; return false; } byUid[g.uid] = g; return true; });
      st.layers.forEach(function (l) { if (l.group && !byUid[l.group]) { l.group = ""; again = true; } });
      list.forEach(function (g) {
        if (g.parent && (!byUid[g.parent] || g.parent === g.uid)) { g.parent = ""; again = true; }
      });
      list.forEach(function (g) {   /* a loop of parents: cut it at this group */
        var p = byUid[g.parent], n = 0;
        while (p && n++ < list.length + 2) { if (p.uid === g.uid) { g.parent = ""; again = true; break; } p = byUid[p.parent]; }
      });
      if (!again) {
        for (var i = 0; i < list.length; i++) {
          var g = list[i], kids = [];
          st.layers.forEach(function (l) { if (l.group === g.uid) kids.push({ l: l }); });
          list.forEach(function (c) { if (c.parent === g.uid) kids.push({ g: c }); });
          if (kids.length >= 2) continue;
          kids.forEach(function (k) { if (k.l) k.l.group = g.parent; else k.g.parent = g.parent; });
          st.groups = list = list.filter(function (x) { return x !== g; });
          again = true; break;
        }
      }
      if (!again) break;
      changed = true;
    }
    return changed;
  };

  /* Puts the texts in an order that keeps every group together. A group sits where its topmost text is, inside it the members keep
   * their order. The lines and cards (st.band.at) keep their place above the same text, outside every group. Returns true when
   * the order of the texts changed. */
  G.settle = function (st) {
    G.prune(st);
    var old = st.layers.slice(), idx = {}, anchor = st.band ? (st.layers[st.band.at] || null) : null;
    old.forEach(function (l, i) { idx[l.id] = i; });
    function build(parent) {
      var items = [];
      old.forEach(function (l) { if ((l.group || "") === parent) items.push({ l: l, key: idx[l.id] }); });
      arr(st).forEach(function (g) { if ((g.parent || "") === parent) { var sub = build(g.uid); items.push({ sub: sub, key: sub.key }); } });
      items.sort(function (a, b) { return a.key - b.key; });
      return { items: items, key: items.length ? items[items.length - 1].key : -1 };
    }
    var out = [];
    (function flat(node) { node.items.forEach(function (it) { if (it.l) out.push(it.l); else flat(it.sub); }); })(build(""));
    var changed = out.length !== old.length || out.some(function (l, i) { return l !== old[i]; });
    if (out.length === old.length) st.layers = out;
    if (st.band) {
      st.band.at = anchor ? Math.max(0, st.layers.indexOf(anchor)) : st.layers.length;
      G.fixBand(st, 0);
    }
    return changed;
  };
  /* The lines and cards never sit inside a group: if the position is between two texts of a top-level group, it goes to the
   * nearer edge (dir > 0: above the group, dir < 0: below it, 0: the nearer one). */
  G.fixBand = function (st, dir) {
    if (!st.band) return;
    arr(st).forEach(function (g) {
      if (g.parent) return;
      var ix = G.layersIn(st, g.uid).map(function (l) { return st.layers.indexOf(l); });
      if (!ix.length) return;
      var lo = Math.min.apply(null, ix), hi = Math.max.apply(null, ix), at = st.band.at;
      if (lo < at && at <= hi) st.band.at = dir > 0 ? hi + 1 : dir < 0 ? lo : (at - lo <= hi + 1 - at ? lo : hi + 1);
    });
  };

  /* The units of a selection of texts: a group whose texts are all selected counts as one unit (the outermost such group),
   * any other selected text is a unit of its own. `skipUid` leaves out the texts of that group (used by addTo). */
  G.units = function (st, layers, skipUid) {
    var sel = {}; layers.forEach(function (l) { sel[l.id] = 1; });
    var units = [], seen = {};
    layers.forEach(function (l) {
      if (skipUid && G.inGroup(st, l, skipUid)) return;
      var unit = { l: l }, key = "l:" + l.id;
      G.chain(st, l).forEach(function (g) {   /* innermost to outermost: the last fully selected one wins */
        if (skipUid && (g.uid === skipUid || G.descendants(st, g.uid).some(function (d) { return d.uid === skipUid; }))) return;
        if (G.layersIn(st, g.uid).every(function (x) { return sel[x.id]; })) { unit = { g: g }; key = "g:" + g.uid; }
      });
      if (seen[key]) return;
      seen[key] = 1; units.push(unit);
    });
    return units;
  };
  function parentOfUnit(u) { return u.l ? u.l.group || "" : u.g.parent || ""; }
  function ancestors(st, u) {
    var out = [], g = G.get(st, parentOfUnit(u)), n = 0;
    while (g && n++ < 64) { out.push(g.uid); g = G.get(st, g.parent); }
    return out;
  }
  function setParent(u, uid) { if (u.l) u.l.group = uid; else u.g.parent = uid; }
  function unitHeight(st, u) { return u.g ? 1 + height(st, u.g) : 0; }
  function groupable(l) { return !l.gen; }

  /* A new group of the selected texts. Returns { group } or { error }. The new group sits in the deepest group that holds all the units. */
  G.make = function (st, layers) {
    if (layers.some(function (l) { return !groupable(l); })) return { error: "A text made by a name style cannot be grouped (the style replaces it)." };
    var units = G.units(st, layers);
    if (units.length < 2) return { error: layers.length > 1 ? "These texts already form one group." : "Select two or more texts to group them." };
    var common = null;
    units.forEach(function (u) { var a = ancestors(st, u); common = common === null ? a : common.filter(function (x) { return a.indexOf(x) >= 0; }); });
    var parent = common && common.length ? common[0] : "";
    var d = parent ? G.depth(st, G.get(st, parent)) + 1 : 0, deep = 0;
    units.forEach(function (u) { deep = Math.max(deep, unitHeight(st, u)); });
    if (d + 1 + deep > MAXDEPTH) return { error: "Groups can be nested " + MAXDEPTH + " levels deep at most." };
    var g = { uid: newUid(st), name: "", nameAuto: true, autoNo: newAutoNo(st), open: true, parent: parent };
    arr(st).push(g);
    units.forEach(function (u) { setParent(u, g.uid); });
    G.settle(st);
    return { group: G.get(st, g.uid) || g };
  };
  /* Dissolves a group: its members move to the group it was in. Returns the texts that were in it. */
  G.ungroup = function (st, uid) {
    var g = G.get(st, uid); if (!g) return [];
    var members = G.layersIn(st, uid);
    st.layers.forEach(function (l) { if (l.group === uid) l.group = g.parent; });
    arr(st).forEach(function (c) { if (c.parent === uid) c.parent = g.parent; });
    st.groups = arr(st).filter(function (x) { return x !== g; });
    G.settle(st);
    return members;
  };
  /* A text or a whole group leaves its group: it goes to the group above (or to the top level), directly above the group it left. */
  G.takeOut = function (st, ref) {
    var u = ref.l ? { l: ref.l } : { g: ref.g };
    var P = G.get(st, parentOfUnit(u));
    if (!P) return false;
    var mine = u.l ? [u.l] : G.layersIn(st, u.g.uid);
    var rest = G.layersIn(st, P.uid).filter(function (l) { return mine.indexOf(l) < 0; });
    setParent(u, P.parent || "");
    if (rest.length) {   /* put the texts above the group: right after its topmost remaining text */
      var layers = st.layers.filter(function (l) { return mine.indexOf(l) < 0; });
      var topAt = Math.max.apply(null, rest.map(function (l) { return layers.indexOf(l); }));
      layers.splice.apply(layers, [topAt + 1, 0].concat(mine));
      st.layers = layers;
      if (st.band) { /* settle keeps the lines and cards above the same text */ }
    }
    G.settle(st);
    return true;
  };
  /* The selection joins a group. Returns { n } (units moved) or { error }. */
  G.addTo = function (st, uid, layers) {
    var target = G.get(st, uid); if (!target) return { error: "That group no longer exists." };
    if (layers.some(function (l) { return !groupable(l); })) return { error: "A text made by a name style cannot be grouped (the style replaces it)." };
    var units = G.units(st, layers, uid).filter(function (u) { return parentOfUnit(u) !== uid; });
    if (!units.length) return { error: "Select texts or groups outside this group to add them." };
    var d = G.depth(st, target) + 1, deep = 0;
    units.forEach(function (u) { deep = Math.max(deep, unitHeight(st, u)); });
    if (d + deep > MAXDEPTH - 1) return { error: "Groups can be nested " + MAXDEPTH + " levels deep at most." };
    units.forEach(function (u) { setParent(u, uid); });
    G.settle(st);
    return { n: units.length };
  };

  /* Moves a text, a group or the lines and cards one step in the stack, among the things next to it (a group moves as one block;
   * a text inside a group moves inside the group only). dir: +1 up (in front), -1 down. Returns true when something moved. */
  G.move = function (st, ref, dir) {
    var parent = ref === "band" ? "" : (ref.l ? ref.l.group || "" : ref.g.parent || "");
    function layersOfItem(it) { return it.l ? [it.l] : G.layersIn(st, it.g.uid); }
    var items = [];
    st.layers.forEach(function (l) {
      var chain = G.chain(st, l), p = (l.group || ""), unit = null;
      if (p === parent) unit = { l: l };
      else {
        for (var i = 0; i < chain.length; i++) if ((chain[i].parent || "") === parent) { unit = { g: chain[i] }; break; }
        if (!unit) return;
        if (G.chain(st, l).indexOf(unit.g) < 0) return;
      }
      if (!items.some(function (x) { return (x.l && x.l === unit.l) || (x.g && x.g === unit.g); })) items.push(unit);
    });
    var bandAt = null;
    if (parent === "" && st.band) {
      var before = 0; items.forEach(function (it) { if (Math.max.apply(null, layersOfItem(it).map(function (l) { return st.layers.indexOf(l); })) < st.band.at) before++; });
      bandAt = before; items.splice(before, 0, { band: true });
    }
    var i = -1;
    items.forEach(function (it, k) { if (ref === "band" ? it.band : (ref.l ? it.l === ref.l : it.g === ref.g)) i = k; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return false;
    var t = items[i]; items[i] = items[j]; items[j] = t;
    var rebuilt = [], pos = 0, newAt = null;
    if (parent === "") {
      items.forEach(function (it) { if (it.band) newAt = rebuilt.length; else layersOfItem(it).forEach(function (l) { rebuilt.push(l); }); });
      if (st.band) st.band.at = newAt;
      st.layers = rebuilt;
    } else {
      /* inside a group: the texts of the group take the same slots as before */
      var slots = [], inP = {}; G.layersIn(st, parent).forEach(function (l) { inP[l.id] = 1; });
      st.layers.forEach(function (l, k) { if (inP[l.id]) slots.push(k); });
      var order = []; items.forEach(function (it) { layersOfItem(it).forEach(function (l) { order.push(l); }); });
      var copy = st.layers.slice(); slots.forEach(function (k, n) { copy[k] = order[n]; });
      var anchor = st.band ? st.layers[st.band.at] || null : null;
      st.layers = copy;
      if (st.band) st.band.at = anchor ? st.layers.indexOf(anchor) : st.layers.length;
    }
    return true;
  };

  /* ---- the transform of a set of texts (positions are in artwork coordinates, relative to the artwork origin) ---- */
  /* Scales about the point F by k: positions move away from F, size and letter space scale. */
  G.scale = function (layers, F, k) {
    layers.forEach(function (l) {
      var c = G.pc ? G.pc(l) : 0;   /* the turning point lies c below the position point; it moves like a point, the position follows */
      l.x = r3(F.x + k * (l.x - F.x)); l.y = r3(F.y + k * (l.y + c - F.y) - k * c);
      l.size = r3(l.size * k); l.ls = r3((Number(l.ls) || 0) * k);
    });
  };
  /* Turns about the point C by deg degrees (clockwise on the screen, like the rotation of a text). */
  G.turn = function (layers, C, deg) {
    var a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    layers.forEach(function (l) {
      var c = G.pc ? G.pc(l) : 0, dx = l.x - C.x, dy = l.y + c - C.y;
      l.x = r3(C.x + dx * ca - dy * sa); l.y = r3(C.y + dx * sa + dy * ca - c);
      var r = (Number(l.rot) || 0) + deg; r = ((r % 360) + 360) % 360; if (r > 180) r -= 360;
      l.rot = r3(r);
    });
  };
  /* The range of k that keeps every size in [min, max]. */
  G.kRange = function (layers, min, max) {
    var lo = 0, hi = Infinity;
    layers.forEach(function (l) { if (l.size > 0) { lo = Math.max(lo, min / l.size); hi = Math.min(hi, max / l.size); } });
    return { min: lo, max: hi };
  };

  PTD.groups = G;
  if (typeof module !== "undefined" && module.exports) module.exports = G;
})(typeof window !== "undefined" ? (window.PTD = window.PTD || {}) : (global.PTD = global.PTD || {}));
