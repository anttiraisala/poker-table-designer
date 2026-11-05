/* Unit tests for the calibration maths (js/calfit.js) and the PDF writer (js/pdf.js). Run: node tests/calfit.test.js */
const F = require('../js/calfit.js'), P = require('../js/pdf.js'), cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t) => Math.abs(a - b) <= (t || 1e-9);

ok(F.spanNominal(480) === 460 && F.spanNominal(100) === 80 && F.spanNominal(250) === 240, 'the nominal block span of a strip');

// nothing entered: no correction
let r = F.fit([{ len: 480 }], 'detail');
ok(r.n === 0 && r.f === 1 && r.d === 0, 'no numbers means factor 1 and no blade offset');

// simple mode: one overall length, offset taken as 0
r = F.fit([{ len: 100, outer: 99 }, { len: 480, outer: 478 }], 'simple', 1);
ok(r.n === 1 && near(r.a, 478 / 480) && near(r.f, 480 / 478) && r.d === 0 && !r.separated, 'simple mode uses only the chosen strip: a = measured / nominal, kerf 0');
r = F.fit([{ len: 100, outer: 99 }, { len: 480, outer: 478 }], 'simple', 0);
ok(near(r.a, 0.99), 'simple mode can use another strip');

// exact data from a=0.998, d=0.1 (kept pieces come out 0.2 mm bigger per direction)
const a = 0.998, d = 0.1, mk = L => ({ len: L, outer: a * L + 2 * d, span: a * F.spanNominal(L), block: a * 10 + 2 * d, gap: a * 10 - 2 * d });
r = F.fit([mk(100), mk(250), mk(480)], 'detail');
ok(near(r.a, a, 1e-9) && near(r.d, d, 1e-9) && r.separated, 'exact detailed numbers give back the scale and the blade offset');
ok(r.maxResid < 1e-9 && r.n === 12, 'and the leftovers are zero (12 numbers)');
ok(near(r.f, 1 / a, 1e-9), 'the correction factor is 1 / a');

// only block and gap: still separable
r = F.fit([{ len: 480, block: a * 10 + 2 * d, gap: a * 10 - 2 * d }], 'detail');
ok(near(r.a, a, 1e-9) && near(r.d, d, 1e-9), 'block width and gap width alone give both');
// only span: pure scale
r = F.fit([{ len: 480, span: 459 }], 'detail');
ok(near(r.a, 459 / 460) && r.d === 0, 'the span alone gives the pure scale');
// two overall lengths separate scale and offset
r = F.fit([{ len: 100, outer: a * 100 + 2 * d }, { len: 480, outer: a * 480 + 2 * d }], 'detail');
ok(near(r.a, a, 1e-9) && near(r.d, d, 1e-9), 'two overall lengths of different size separate scale and offset');
// noisy data shows leftovers and a warning
const noisy = mk(250); noisy.outer += 0.5;
r = F.fit([mk(100), noisy, mk(480)], 'detail');
ok(r.maxResid > 0.1 && r.warn.indexOf('do not fit') >= 0, 'a wrong number shows as a leftover and a warning');
r = F.fit([{ len: 480, outer: 600 }], 'simple', 0);
ok(r.warn.indexOf('10 %') >= 0, 'an impossible scale is flagged');

// forms
const f = F.forms(1.0042, 480);
ok(near(f.percent, 0.42, 1e-9) && near(f.mm, 2.016, 1e-9), 'factor, percent and millimetres over the reference length');
ok(near(F.fromPercent(0.42), 1.0042) && near(F.fromMm(2.016, 480), 1.0042), 'and back');
const k = F.kerf({ separated: true, d: 0.1 }, { separated: true, d: 0.14 });
ok(near(k.d, 0.12) && near(k.diff, 0.04) && k.n === 2, 'the blade offset of both directions is their mean and the difference is shown');
ok(F.kerf({ separated: false, d: 0 }, null).n === 0, 'no separated offset means none');

// PDF
const pdf = P.build([{ w: 200, h: 100, ops: [{ t: 'line', x1: 0, y1: 0, x2: 100, y2: 50 }, { t: 'rect', x: 5, y: 5, w: 20, h: 10, stroke: '#ff0000' }, { t: 'poly', pts: [[0, 0], [10, 0], [5, 8]], fill: '#00ff00' }, { t: 'text', x: 10, y: 40, s: 'Hello (a) \\ × €', size: 12, bold: true }] }], { title: 'T' });
ok(pdf.startsWith('%PDF-1.4') && pdf.trim().endsWith('%%EOF') && /[\x00-\x7f]*/.test(pdf) && !/[^\x00-\x7f]/.test(pdf), 'the PDF is plain ASCII with header and trailer');
const sx = +/startxref\n(\d+)/.exec(pdf)[1];
ok(pdf.substr(sx, 4) === 'xref', 'startxref points at the xref table');
const xr = pdf.substr(sx).split('\n'), count = +xr[1].split(' ')[1];
let offsOk = true;
for (let i = 1; i < count; i++) { const off = +xr[2 + i].slice(0, 10); if (pdf.substr(off, (i + ' 0 obj').length) !== i + ' 0 obj') offsOk = false; }
ok(offsOk && count >= 8, 'every xref offset points at its object');
ok(pdf.indexOf('(Hello \\(a\\) \\\\ \\327 ?)') > 0, 'text is escaped and written in WinAnsi');
try {
  const f1 = path.join(os.tmpdir(), 'ptd-test.pdf'); fs.writeFileSync(f1, pdf, 'latin1');
  const q = cp.spawnSync('qpdf', ['--check', f1]);
  if (!q.error) ok(q.status === 0, 'qpdf accepts the file' + (q.status ? ': ' + q.stderr + q.stdout : ''));
  const t = cp.spawnSync('pdftotext', [f1, '-']);
  if (!t.error) ok(/Hello \(a\)/.test(t.stdout.toString()), 'pdftotext reads the text back');
} catch (e) { console.log('(PDF tools not available)'); }
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
