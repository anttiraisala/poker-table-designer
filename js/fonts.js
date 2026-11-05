/* Fonts: Google Fonts by name, font files imported by the user, and freezing text to outlines.
 *
 * Imported files are registered with the browser (FontFace) and kept as binary data so they can be
 * embedded in the saved project and turned into outlines. Outlines need opentype.js, which is loaded
 * from a CDN the first time it is needed. */
(function (PTD) {
  "use strict";
  var F = {};
  var C = function () { return PTD.core; };

  F.FAVS = ["Mea Culpa", "Josefin Sans", "Ballet", "Imperial Script", "Herr Von Muellerhoff", "Monsieur La Doulaise"];
  F.LIST = [
    "Mea Culpa", "Ballet", "Imperial Script", "Herr Von Muellerhoff", "Monsieur La Doulaise",
    "Allison", "Babylonica", "Beau Rivage", "Birthstone", "Birthstone Bounce", "Bonheur Royale", "Carattere", "Cherish",
    "Comforter", "Comforter Brush", "Corinthia", "Dr Sugiyama", "Eagle Lake", "Ephesis", "Estonia", "Euphoria Script",
    "Explora", "Fleur De Leah", "Fuggles", "Gwendolyn", "Grey Qo", "Hurricane", "Inspiration", "Ingrid Darling",
    "Island Moments", "Kolker Brush", "Licorice", "Love Light", "Lovers Quarrel", "Luxurious Script", "Meddon",
    "Moon Dance", "Mr De Haviland", "Mr Dafoe", "Mrs Saint Delafield", "Mrs Sheppards", "Ms Madi", "Oooh Baby",
    "Passions Conflict", "Qwigley", "Qwitcher Grypen", "Ruthie", "Send Flowers", "Sassy Frass", "Splash", "Square Peg",
    "Stalemate", "Style Script", "The Nautigal", "Updock", "Vujahday Script", "Water Brush", "Waterfall", "Whisper",
    "WindSong", "Lavishly Yours", "Alex Brush", "Allura", "Arizonia", "Bilbo", "Bilbo Swash Caps", "Great Vibes",
    "Italianno", "Petit Formal Script", "Pinyon Script", "Rouge Script", "Tangerine", "Parisienne", "Sacramento",
    "Playball", "Yesteryear", "Aguafina Script", "Clicker Script", "Devonshire", "Engagement", "Felipa", "Kristi",
    "Marck Script", "Meie Script", "Montez", "Niconne", "Norican", "Ole", "Rochester", "Sevillana", "Shalimar", "Sofia",
    "Zeyada", "Dancing Script", "Cookie", "Courgette", "Satisfy", "Seaweed Script", "Charm", "Charmonman", "Redressed",
    "Damion", "Rancho", "Fondamento", "Berkshire Swash", "Grand Hotel", "Molle",
    "Josefin Sans", "Cinzel", "Cinzel Decorative", "Cormorant Garamond", "Playfair Display", "Montserrat", "Raleway",
    "Marcellus", "Italiana", "Poiret One", "Limelight", "Abril Fatface", "Bodoni Moda", "Lato", "Oswald"
  ];
  var AXES = {
    "Josefin Sans": "wght@100..700", "Cormorant Garamond": "wght@300..700", "Cinzel": "wght@400..900",
    "Montserrat": "wght@100..900", "Raleway": "wght@100..900", "Playfair Display": "wght@400..900"
  };

  F.data = {};          /* family -> {buf: ArrayBuffer, fileName} for imported files */
  var fontState = {};   /* family -> "loading" | "ok" | "fail" */

  function entries() { return C().state().fonts; }
  function entry(name) { return entries().filter(function (f) { return f.family === name; })[0]; }
  F.entry = entry;
  F.isImported = function (name) { return !!entry(name); };
  F.allNames = function () {
    var mine = entries().map(function (f) { return f.family; });
    return mine.concat(F.LIST.filter(function (n) { return mine.indexOf(n) < 0; }));
  };

  /* "ok", "loading", "fail" (Google font not found) or "missing" (an imported file is not loaded) */
  F.status = function (name) {
    var e = entry(name);
    if (e && !F.data[name]) return "missing";
    return fontState[name] || "";
  };

  function changed() { if (C().afterFont) C().afterFont(); }

  function tryLoad(name, axis) {
    var fam = encodeURIComponent(name).replace(/%20/g, "+") + (axis ? ":" + axis : "");
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=" + fam + "&display=swap";
    link.onload = function () {
      document.fonts.load('64px "' + name + '"', "Molino Royale").then(function (f) {
        fontState[name] = f.length ? "ok" : "fail"; changed();
      }).catch(function () { fontState[name] = "fail"; changed(); });
    };
    link.onerror = function () {
      link.remove();
      if (axis) tryLoad(name, null); else { fontState[name] = "fail"; changed(); }
    };
    document.head.appendChild(link);
  }
  F.load = function (name) {
    name = (name || "").trim();
    if (!name) return;
    if (entry(name)) { changed(); return; }
    if (fontState[name]) { changed(); return; }
    fontState[name] = "loading"; changed();
    tryLoad(name, AXES[name]);
  };

  /* ---- imported files ---- */
  function toB64(buf) {
    var bytes = new Uint8Array(buf), s = "", chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }
  function fromB64(b64) {
    var s = atob(b64), bytes = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  }
  function register(family, buf, fileName) {
    F.data[family] = { buf: buf, fileName: fileName };
    fontState[family] = "loading";
    var face;
    try { face = new FontFace(family, buf.slice(0)); } catch (e) { fontState[family] = "fail"; return Promise.resolve(false); }
    return face.load().then(function (f) {
      document.fonts.add(f); fontState[family] = "ok"; changed(); return true;
    }, function () { fontState[family] = "fail"; changed(); return false; });
  }
  function cleanFamily(fileName) {
    var base = fileName.replace(/\.[^.]+$/, "").replace(/^\d+[-_ ]+/, "").replace(/[-_]+/g, " ").trim();
    return base.toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }) || "Imported font";
  }
  /* Family name from the font's own name table (TTF/OTF); "" if it cannot be read. */
  function familyFromFont(buf) {
    try {
      var dv = new DataView(buf), num = dv.getUint16(4), off = 12, tag, i;
      if (dv.getUint32(0) === 0x74746366) return "";   /* font collections: use the file name */
      for (i = 0; i < num; i++, off += 16) {
        tag = String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
        if (tag === "name") break;
      }
      if (i === num) return "";
      var t = dv.getUint32(off + 8), count = dv.getUint16(t + 2), strOff = t + dv.getUint16(t + 4), best = "", bestScore = -1;
      for (i = 0; i < count; i++) {
        var r = t + 6 + i * 12, plat = dv.getUint16(r), id = dv.getUint16(r + 6), len = dv.getUint16(r + 8), o = strOff + dv.getUint16(r + 10);
        if (id !== 1 && id !== 16) continue;
        var str = "", k;
        if (plat === 3 || plat === 0) for (k = 0; k + 1 < len; k += 2) str += String.fromCharCode(dv.getUint16(o + k));
        else if (plat === 1) for (k = 0; k < len; k++) str += String.fromCharCode(dv.getUint8(o + k));
        else continue;
        str = str.trim();
        var score = (id === 16 ? 2 : 1) + (plat === 3 ? 4 : 0);
        if (str && score > bestScore) { best = str; bestScore = score; }
      }
      return best;
    } catch (e) { return ""; }
  }
  /* Reads a font file the user picked. If familyHint is given the data goes to that (missing) font. */
  F.importFile = function (file, familyHint) {
    return new Promise(function (resolve, reject) {
      var rd = new FileReader();
      rd.onerror = function () { reject(new Error("Could not read that file.")); };
      rd.onload = function () {
        var buf = rd.result, family = familyHint || familyFromFont(buf) || cleanFamily(file.name);
        var e = entry(family);
        if (!e) entries().push({ family: family, fileName: file.name, url: "", bytes: buf.byteLength });
        else { e.fileName = file.name; e.bytes = buf.byteLength; }
        register(family, buf, file.name).then(function (okay) {
          if (!okay) reject(new Error("The browser could not use that font file."));
          else resolve(family);
        });
      };
      rd.readAsArrayBuffer(file);
    });
  };
  /* Saved projects carry the font files as base64. */
  F.toProject = function () {
    return entries().map(function (e) {
      var o = { family: e.family, fileName: e.fileName, url: e.url || "", bytes: e.bytes || 0 };
      if (F.data[e.family]) o.dataBase64 = toB64(F.data[e.family].buf);
      return o;
    });
  };
  F.fromProject = function (list) {
    var metas = [];
    (list || []).forEach(function (o) {
      if (!o || !o.family) return;
      metas.push({ family: String(o.family), fileName: String(o.fileName || ""), url: String(o.url || ""), bytes: Number(o.bytes) || 0 });
      if (o.dataBase64) { try { register(String(o.family), fromB64(o.dataBase64), String(o.fileName || "")); } catch (e) {} }
    });
    return metas;
  };
  /* Font data for autosave, kept apart from the project text because it is large. */
  F.dataForStorage = function () {
    var o = {};
    Object.keys(F.data).forEach(function (k) { o[k] = { fileName: F.data[k].fileName, b64: toB64(F.data[k].buf) }; });
    return o;
  };
  F.restoreStorage = function (o) {
    Object.keys(o || {}).forEach(function (k) { try { register(k, fromB64(o[k].b64), o[k].fileName); } catch (e) {} });
  };
  F.remove = function (family) {
    var list = entries(), i = list.findIndex(function (f) { return f.family === family; });
    if (i >= 0) list.splice(i, 1);
    delete F.data[family]; delete fontState[family];
  };

  /* ---- outlines (opentype.js) ---- */
  var OT_URL = "https://cdnjs.cloudflare.com/ajax/libs/opentype.js/1.3.4/opentype.min.js";
  F.libState = function () { return window.opentype ? "loaded" : "not loaded yet"; };
  F.loadLib = function () {
    return new Promise(function (resolve, reject) {
      if (window.opentype) { resolve(window.opentype); return; }
      var s = document.createElement("script");
      s.src = OT_URL;
      s.onload = function () { window.opentype ? resolve(window.opentype) : reject(new Error("opentype.js did not start.")); };
      s.onerror = function () { reject(new Error("Could not load opentype.js. Outlines need an internet connection the first time.")); };
      document.head.appendChild(s);
    });
  };
  /* The pieces of a text: every character with the size it is drawn at (bigger first letters). */
  F.charSizes = function (l, full) {
    var out = [], big = true;
    Array.from(full).forEach(function (ch) {
      var space = /\s/.test(ch), size = l.size;
      if (l.cap && l.capScale > 0 && l.capScale !== 1 && !space && big) { size = l.size * l.capScale; big = false; }
      out.push({ ch: ch, size: size });
      if (space && l.capAll) big = true;
    });
    return out;
  };
  /* Returns {d, x0, y0, x1, y1} with the baseline at y = 0 and the text centred on x = 0. */
  F.outline = function (ot, font, l) {
    var full = l.upper ? l.text.toUpperCase() : l.text, parts = F.charSizes(l, full);
    var upm = font.unitsPerEm || 1000, x = 0, glyphs = [], prev = null;
    parts.forEach(function (p) {
      var g = font.charToGlyph(p.ch), k = prev ? font.getKerningValue(prev, g) * p.size / upm : 0;
      x += k;
      glyphs.push({ g: g, x: x, size: p.size });
      x += g.advanceWidth * p.size / upm + (l.ls || 0);
      prev = g;
    });
    var width = x - (l.ls || 0), path = new ot.Path();
    glyphs.forEach(function (it) {
      var gp = it.g.getPath(it.x - width / 2, 0, it.size);
      gp.commands.forEach(function (c) { path.commands.push(c); });
    });
    var bb = path.getBoundingBox();
    return { d: path.toPathData(2), x0: bb.x1, y0: bb.y1, x1: bb.x2, y1: bb.y2 };
  };
  /* ---- fetching a font file for the outlines of an export (kept in memory only) ----
   * A Google font is shown by name, but its outlines need the font file. When the file was not imported, an export tries to
   * fetch it from several places in turn. What it gets is kept only in memory (`F.fetched`): it is not saved in the project
   * and is gone when the page is closed. */
  F.fetched = {};
  F.fetchTimeoutMs = 12000;
  var STYLE_NAMES = { 100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" };
  function fkey(l) { return l.font + "|" + (Number(l.weight) || 400) + "|" + (l.italic ? 1 : 0); }
  F.fetchedFor = function (l) { return F.fetched[fkey(l)] || null; };
  /* The addresses to try, in order: Fontsource files (WOFF, via jsDelivr), the Google Fonts repository (TTF, via jsDelivr),
   * then the same TTF files straight from GitHub. */
  F.fontSources = function (l) {
    var fam = String(l.font || ""), id = fam.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), nospace = fam.replace(/[^A-Za-z0-9]/g, ""), dir = nospace.toLowerCase();
    var w = Math.round((Number(l.weight) || 400) / 100) * 100; if (!STYLE_NAMES[w]) w = 400;
    var it = !!l.italic, out = [];
    function add(kind, url) { if (out.every(function (o) { return o.url !== url; })) out.push({ kind: kind, url: url }); }
    [[w, it], [w, false], [400, it], [400, false]].forEach(function (p) {
      add("Fontsource", "https://cdn.jsdelivr.net/npm/@fontsource/" + id + "/files/" + id + "-latin-" + p[0] + "-" + (p[1] ? "italic" : "normal") + ".woff");
    });
    var names = [], sn = STYLE_NAMES[w] + (it ? "Italic" : ""), rn = it ? "Italic" : "Regular";
    [sn, rn, "Regular"].forEach(function (s) { if (names.indexOf(nospace + "-" + s + ".ttf") < 0) names.push(nospace + "-" + s + ".ttf"); });
    names.push(nospace + (it ? "-Italic" : "") + "[wght].ttf");
    [["jsDelivr", "https://cdn.jsdelivr.net/gh/google/fonts@main/"], ["GitHub", "https://raw.githubusercontent.com/google/fonts/main/"]].forEach(function (host) {
      ["ofl", "apache", "ufl"].forEach(function (lic) {
        names.forEach(function (n) { if (lic === "ofl" || n === nospace + "-Regular.ttf") add(host[0], host[1] + lic + "/" + dir + "/" + encodeURI(n)); });
      });
    });
    return out;
  };
  /* Tries every source until one gives a font file that opentype.js can read. Resolves to {buf, fileName, source} or to
   * {buf: null, tried: n}; never rejects. */
  F.fetchFont = function (l) {
    var have = F.fetchedFor(l); if (have) return Promise.resolve(have);
    var key = fkey(l), list = F.fontSources(l), tried = 0;
    F._pending = F._pending || {};
    if (F._pending[key]) return F._pending[key];
    function one(i, ot) {
      if (i >= list.length) return Promise.resolve({ buf: null, tried: tried });
      var src = list[i], ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, F.fetchTimeoutMs);
      tried++;
      return fetch(src.url, ctl ? { signal: ctl.signal } : undefined).then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.arrayBuffer();
      }).then(function (buf) {
        clearTimeout(timer);
        if (!buf || buf.byteLength < 1000) throw new Error("too small");
        var f = ot.parse(buf.slice(0));
        if (!f || !(f.numGlyphs > 0)) throw new Error("no glyphs");
        var got = { buf: buf, fileName: src.url.split("/").pop(), source: src.kind, url: src.url };
        F.fetched[key] = got; return got;
      }).catch(function () { clearTimeout(timer); return one(i + 1, ot); });
    }
    var p = F.loadLib().then(function (ot) { return one(0, ot); }, function () { return { buf: null, tried: 0, noLib: true }; }).then(function (r) { delete F._pending[key]; return r; });
    F._pending[key] = p; return p;
  };
  F.freeze = function (l) {
    var d = F.data[l.font] || F.fetchedFor(l);
    if (!d) return Promise.reject(new Error("Only imported font files can be turned into outlines. Import the font file on the Fonts tab first."));
    return F.loadLib().then(function (ot) {
      var font = ot.parse(d.buf.slice(0));
      var o = F.outline(ot, font, l);
      if (!o.d) throw new Error("The font has no outlines for this text.");
      l.frozen = o;
      return o;
    });
  };

  /* ---- panel ---- */
  F.panelHTML = function () {
    var core = C(), st = core.state(), esc = core.esc;
    var used = {};
    st.layers.forEach(function (l) { used[l.font] = true; });
    var h = '<h3 class="sec">Imported font files</h3>';
    if (!st.fonts.length) h += '<p class="small">No font files imported. Google Fonts work by name and need no file. Import a TTF or OTF file for fonts that are not on Google Fonts, to keep a font inside the project, or to turn text into outlines.</p>';
    st.fonts.forEach(function (e) {
      var s = F.status(e.family);
      var txt = s === "missing" ? "Not loaded. Load the font file again." : s === "ok" ? "Loaded" + (e.bytes ? " · " + Math.round(e.bytes / 1024) + " kB" : "") : s === "fail" ? "The browser could not use this file." : "Loading…";
      h += '<div class="panel"><div class="body">' +
        '<div class="colorrow"><b style="font-weight:400;font-size:1.05rem;font-family:\'' + esc(e.family) + '\',sans-serif">' + esc(e.family) + '</b>' +
        '<span class="small">' + esc(e.fileName || "") + '</span></div>' +
        '<div class="fstat' + (s === "ok" ? "" : " bad") + '">' + esc(txt) + (used[e.family] ? " · used by the artwork" : "") + '</div>' +
        '<label class="fld"><span>Source URL (informational only)</span><input type="text" data-scope="font:' + esc(e.family) + '" data-key="url" placeholder="Where the file was downloaded from" autocomplete="off" spellcheck="false"></label>' +
        '<div class="btnrow"><button class="btn" type="button" data-act="fontfile" data-family="' + esc(e.family) + '">' + (s === "missing" ? "Load font file" : "Replace file") + '</button>' +
        '<button class="btn" type="button" data-act="fontremove" data-family="' + esc(e.family) + '"' + (used[e.family] ? ' disabled title="Used by the artwork"' : '') + '>Remove</button></div>' +
        '</div></div>';
    });
    h += '<div class="btnrow"><button class="btn gold" type="button" data-act="fontimport">Import font file…</button><button class="btn" type="button" data-act="fontporcelain" title="Fetches fonts/porcelain/PORCELAIN.TTF from this site">Load Porcelain</button></div>' +
      '<h3 class="sec">Outlines</h3><p class="small">“Freeze to outlines” on a text turns it into exact geometry, so it no longer depends on any font. Unfreeze brings the live text back with all its settings. Outlines are made with opentype.js (' + F.libState() + '), which is loaded from a CDN on first use, and need the imported font file. Use TTF or OTF files; WOFF2 cannot be read.</p>' +
      '<div class="msg" id="fontMsg" aria-live="polite"></div>';
    return h;
  };

  PTD.fonts = F;
})(window.PTD = window.PTD || {});
