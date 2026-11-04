/* Word lists for the casino-name inventor.
 * Three sources, merged at run time into one bank in which every list holds unique words:
 *   1. the shipped basic words (js/words-basic.js, generated from data/words-basic.json),
 *   2. the universal words: the basic words, or the user's own copy that replaces them (kept in the settings),
 *   3. the project words (kept in the project), with a switch that says whether the universal words are used at all.
 * A project that does not use the universal words and holds only a few full names makes the inventor use only those. */
(function (PTD) {
  "use strict";
  var W = {};
  var FORMAT = "poker-table-designer-words";
  var LISTS = ["fullNames", "helpers", "adjectives", "nouns", "places", "names", "suffixes", "pluralNouns", "pluralMostly", "pluralOwners",
    "ranks", "ranksPlural", "suitsPlural", "phrases", "pairOf", "containers", "ofObjects", "themedPlural", "theOwners", "theHeads", "suffixed", "articledAdjectives", "block"];
  var MAPS = ["owners", "heads", "articled"];          /* name -> list of words */
  var ENTRIES = ["themed", "ofTitles"];                 /* lists of objects with lists inside */
  var MAX_WORDS = 5000, MAX_LEN = 80;
  W.LISTS = LISTS; W.MAPS = MAPS; W.ENTRIES = ENTRIES;

  function clean(arr) {
    var out = [], seen = {};
    (Array.isArray(arr) ? arr : []).forEach(function (w) {
      if (typeof w !== "string") return;
      w = w.replace(/\s+/g, " ").trim();
      if (!w || w.length > MAX_LEN) return;
      var k = w.toLowerCase();
      if (seen[k] || out.length >= MAX_WORDS) return;
      seen[k] = true; out.push(w);
    });
    return out;
  }
  function cleanMap(o) {
    var out = {};
    if (o && typeof o === "object" && !Array.isArray(o)) Object.keys(o).slice(0, 200).forEach(function (k) {
      var key = String(k).replace(/\s+/g, " ").trim().slice(0, 40), l = clean(o[k]);
      if (key && l.length) out[key] = clean((out[key] || []).concat(l));
    });
    return out;
  }
  function cleanEntries(arr, keys) {
    var out = [];
    (Array.isArray(arr) ? arr : []).slice(0, 500).forEach(function (e) {
      if (!e || typeof e !== "object") return;
      var o = {}, any = true;
      keys.forEach(function (k) {
        var v = e[k];
        if (v === "@adjectives") { o[k] = "@adjectives"; return; }
        o[k] = clean(v);
        if (!o[k].length) any = false;
      });
      if (any) out.push(o);
    });
    return out;
  }
  /* Makes a clean words document from anything: unknown keys are dropped, every list is trimmed and unique. */
  W.normalize = function (o) {
    o = o && typeof o === "object" ? o : {};
    var d = { format: FORMAT, version: 1, name: String(o.name || "").slice(0, 80) };
    LISTS.forEach(function (k) { d[k] = clean(o[k]); });
    MAPS.forEach(function (k) { d[k] = cleanMap(o[k]); });
    d.themed = cleanEntries(o.themed, ["adjectives", "nouns"]);
    d.ofTitles = cleanEntries(o.ofTitles, ["left", "right"]);
    return d;
  };
  W.empty = function () { return W.normalize({}); };
  W.count = function (d) {
    var n = 0;
    LISTS.forEach(function (k) { n += d[k].length; });
    MAPS.forEach(function (k) { Object.keys(d[k]).forEach(function (g) { n += d[k][g].length; }); });
    return n;
  };

  var basicDoc = null;
  W.basic = function () {
    if (!basicDoc) basicDoc = W.normalize(PTD.wordsBasic || {});
    return basicDoc;
  };
  /* The universal words: the user's replacement from the settings if there is one, else the basic words. */
  W.universal = function () {
    var c = PTD.core && PTD.core.cfg ? PTD.core.cfg() : null;
    return c && c.words ? W.normalize(c.words) : W.basic();
  };

  function concatUnique(a, b) { return clean((a || []).concat(b || [])); }
  /* Merges documents into one bank. Lists are concatenated and made unique. "@adjectives" in a themed entry means
   * all adjectives of the bank. */
  W.merge = function (docs) {
    var bank = W.empty();
    docs.forEach(function (d) {
      if (!d) return;
      LISTS.forEach(function (k) { bank[k] = concatUnique(bank[k], d[k]); });
      MAPS.forEach(function (k) { Object.keys(d[k] || {}).forEach(function (g) { bank[k][g] = concatUnique(bank[k][g], d[k][g]); }); });
      ENTRIES.forEach(function (k) {
        (d[k] || []).forEach(function (e) {
          var s = JSON.stringify(e);
          if (!bank[k].some(function (x) { return JSON.stringify(x) === s; })) bank[k].push(JSON.parse(s));
        });
      });
    });
    bank.themed = bank.themed.map(function (e) { return { adjectives: e.adjectives === "@adjectives" ? bank.adjectives.slice() : e.adjectives, nouns: e.nouns }; })
      .filter(function (e) { return e.adjectives.length && e.nouns.length; });
    return bank;
  };

  /* The words of a project: { useUniversal: true, ...lists }. */
  W.defaultProject = function () { return { useUniversal: true, words: W.empty() }; };
  W.normProject = function (p) {
    p = p && typeof p === "object" ? p : {};
    var src = p.words && typeof p.words === "object" && !Array.isArray(p.words) ? p.words : p;   /* the live form is { useUniversal, words }, the file form is flat */
    return { useUniversal: p.useUniversal !== false, words: W.normalize(src) };
  };
  W.projectJSON = function (p) {
    var q = W.normProject(p), o = Object.assign({ useUniversal: q.useUniversal }, q.words);
    return o;
  };

  var memo = { key: "", bank: null };
  /* The bank for the current project: universal words (if used) plus the project's own. */
  W.bank = function (st) {
    st = st || PTD.core.state();
    var p = W.normProject(st.words), docs = [];
    if (p.useUniversal) docs.push(W.universal());
    docs.push(p.words);
    var key = JSON.stringify(docs);
    if (memo.key !== key) { memo.key = key; memo.bank = W.merge(docs); }
    return memo.bank;
  };

  /* Checks pasted or loaded text and returns { doc, problems }. A words file must at least be an object. */
  W.parse = function (text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { return { doc: null, problems: ["This is not valid JSON: " + e.message] }; }
    if (!o || typeof o !== "object" || Array.isArray(o)) return { doc: null, problems: ["The words must be a JSON object."] };
    var d = W.normalize(o), problems = [];
    if (o.format && o.format !== FORMAT) problems.push("The format is \"" + o.format + "\", expected \"" + FORMAT + "\".");
    Object.keys(o).forEach(function (k) {
      if (["format", "version", "name", "useUniversal"].indexOf(k) < 0 && LISTS.concat(MAPS, ENTRIES).indexOf(k) < 0) problems.push("Unknown key \"" + k + "\" is ignored.");
    });
    return { doc: d, useUniversal: o.useUniversal, problems: problems };
  };
  W.FORMAT = FORMAT;
  PTD.words = W;
})(window.PTD = window.PTD || {});
