/* Run with: node tests/eps.test.js
 * Checks the structure of the EPS written for Roland CutStudio (see js/eps.js). */
const E = require("../js/eps.js");
let failed = 0;
function ok(cond, msg) { if (!cond) { failed++; console.log("FAIL", msg); } else console.log("ok  ", msg); }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + " (" + a + " vs " + b + ")"); }
const body = (text) => { const l = text.split("\n"), a = l.indexOf("4 M q"), z = l.lastIndexOf("0 0 m"); return l.slice(a + 1, z).filter(s => s && s[0] !== "%"); };
const cmds = (text) => body(text).filter(Boolean).map(s => s.trim().split(/\s+/));

const sq = E.build([{ pts: [[0, 0], [25.4, 0], [25.4, 25.4], [0, 25.4]], closed: true }]);
const L = sq.text.split("\n");
ok(L[0] === "%!PS-Adobe-3.0 EPSF-3.0" && L[1] === "%%LanguageLevel: 2" && L[2] === "%%BoundingBox: -10000 -10000 10000 10000" && L[3] === "%%EndComments", "header lines");
ok(L.includes("%%PageBoundingBox: -10000 -10000 10000 10000") && L.includes("%%Page: 1 1") && L.includes("%%EndProlog"), "page lines");
ok(/^[\x09\x0a\x20-\x7e]*$/.test(sq.text), "plain ASCII only");
const tail = L.slice(L.lastIndexOf("0 0 m"));
ok(tail.join("|").startsWith("0 0 m|S Q|Q Q|showpage|%%Trailer|end|%%EOF"), "the file ends with the extra 0 0 m, S Q, Q Q, showpage, trailer, end, EOF");
ok(!/\bh\b/.test(body(sq.text).join(" ")), "no closepath command in the path");

// commands: only m, l, c with the right operand counts
const allowed = { m: 2, l: 2, c: 6 };
ok(cmds(sq.text).every(c => allowed[c[c.length - 1]] === c.length - 1), "only m (2 numbers), l (2) and c (6) are used");
// square: 25.4 mm = 72 pt, closed by repeating the first point with l
const c = cmds(sq.text);
ok(c.length === 5 && c[0].join(" ") === "0 72 m", "the square starts at its top left corner, y up: " + c[0].join(" "));
ok(c[1].join(" ") === "72 72 l" && c[2].join(" ") === "72 0 l" && c[3].join(" ") === "0 0 l", "units: 25.4 mm is 72 pt, and y points up: " + c.slice(1, 4).map(x => x.join(" ")).join(" | "));
ok(c[4].join(" ") === "0 72 l", "a closed path repeats its first point with lineto");
ok(sq.warnings.length === 0 && Math.abs(sq.widthMm - 25.4) < 1e-9, "no warnings for a normal drawing");
// y direction: the point with the smaller y (higher on screen) gets the larger PostScript y
const tri = cmds(E.build([{ pts: [[0, 0], [10, 20], [20, 0]], closed: true }]).text);
ok(+tri[0][1] > +tri[1][1], "a point higher on the screen has the larger PostScript y");

// circle: 4 curves, points on the circle
const ci = E.build([E.circle(50, 50, 25)]), cc = cmds(ci.text), curves = cc.filter(x => x[x.length - 1] === "c");
ok(curves.length === 4, "a circle is 4 curves: " + curves.length);
const k = E.PT_PER_MM, cx = 25 * k, cy = 25 * k, r = 25 * k;
ok(curves.every(v => Math.abs(Math.hypot(+v[4] - cx, +v[5] - cy) - r) < 0.002), "curve end points lie on the circle");
// radius error at the middle of each curve (t = 0.5)
let worst = 0; let p0 = cc[0].slice(0, 2).map(Number);
curves.forEach(v => { const q = v.slice(0, 6).map(Number), m = [0, 1].map(i => (p0[i] + 3 * q[i] + 3 * q[2 + i] + q[4 + i]) / 8); worst = Math.max(worst, Math.abs(Math.hypot(m[0] - cx, m[1] - cy) / r - 1)); p0 = [q[4], q[5]]; });
ok(worst < 0.0003, "Bezier radius error below 0.03 %: " + worst);
// arc: a quarter circle is one curve, three quarters is three
ok(cmds(E.build([{ ops: [["M", 10, 0], ["A", 0, 0, 10, 0, Math.PI / 2]] }]).text).filter(x => x[x.length - 1] === "c").length === 1, "a quarter arc is one curve");
ok(cmds(E.build([{ ops: [["M", 10, 0], ["A", 0, 0, 10, 0, -Math.PI * 1.5]] }]).text).filter(x => x[x.length - 1] === "c").length === 3, "a three quarter arc is three curves");

// edge cases
const em = E.build([]);
ok(em.warnings.length === 1 && /nothing to export/.test(em.warnings[0]) && em.text.includes("0 0 m") && body(em.text).length === 0, "an empty drawing gives a valid file and a warning");
const one = E.build([{ pts: [[5, 5]], closed: true }, { pts: [[0, 0], [10, 0]] }]);
ok(one.pathCount === 1 && one.warnings.some(w => /only one point/.test(w)), "a path with one point is skipped with a warning");
ok(cmds(one.text).length === 2, "an open line is m and l only");
const far = E.build([{ pts: [[0, 0], [4000, 0]] }]);
ok(far.warnings.some(w => /does not fit/.test(w)), "a drawing wider than 3527 mm warns");
const fine = E.build([{ pts: [[0, 0], [3000, 0]] }]);
ok(fine.warnings.length === 0, "a 3 m drawing fits the page");
const tiny = E.build([{ pts: [[0, 0], [0.0004, 0]] }]);
ok(tiny.warnings.length === 0 && /^0 0 m$|^0 0 m/.test(cmds(tiny.text)[0].join(" ")), "very small coordinates are written without error");
// rounding to 3 decimals, no -0, no exponent
const rd = E.build([{ pts: [[0, 0], [1.23456789, 0.00001]] }]).text;
ok(/\b3\.5\d{0,2} /.test(rd) && !/-0\b/.test(body(rd).join(" ")) && !/e[+-]/.test(body(rd).join(" ")), "numbers have at most 3 decimals, no -0 and no exponent");
// post matrix hook (future mirror): flipping y about the drawing height
const post = E.build([{ pts: [[0, 0], [25.4, 25.4]] }], { post: [1, 0, 0, -1, 0, 72] });
ok(cmds(post.text)[0].join(" ") === "0 0 m" && cmds(post.text)[1].join(" ") === "72 72 l", "the post matrix is applied last");
// the committed CutStudio test files are up to date
const fs = require("fs"), path = require("path"), gen = require("../scripts/make-cutstudio-tests.js").files();
Object.keys(gen).forEach(k => ok(fs.existsSync(path.join(__dirname, "cutstudio", k)) && fs.readFileSync(path.join(__dirname, "cutstudio", k), "utf8") === gen[k], "tests/cutstudio/" + k + " is up to date"));
Object.keys(gen).forEach(k => ok(cmds(gen[k]).every(c => allowed[c[c.length - 1]] === c.length - 1), k + " uses only m, l and c"));
process.exit(failed ? 1 : 0);
