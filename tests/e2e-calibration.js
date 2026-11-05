/* Browser checks for the calibration images (Project tab, "Calibration images").
 * Run from the repository root: NODE_PATH=$(npm root -g) node tests/e2e-calibration.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(800);
  const ev = (f, a) => p.evaluate(f, a);

  // ---- geometry
  const g = await ev(() => { const K = PTD.calibration, pts = K.polygon(480); let a = 0; for (let i = 0; i < pts.length; i++) { const q = pts[(i + 1) % pts.length]; a += pts[i][0] * q[1] - q[0] * pts[i][1]; } return { area: Math.abs(a) / 2, n: pts.length, first: pts[1], v: K.shape('vertical', 480) }; });
  ok(g.area === 4800 + 24 * 100 + 5 * 25, 'the strip area is the bar plus 24 blocks plus 5 feet: ' + g.area);
  ok(g.v.w === 20 && g.v.h === 480, 'the vertical strip is the horizontal one turned: ' + g.v.w + ' x ' + g.v.h);

  // ---- files
  const files = await ev(async () => { const f = await PTD.calibration.build(); return f.map(x => ({ name: x.name, len: x.data.length })); });
  const names = files.map(f => f.name);
  ok(files.length === 12, '12 files: ' + names.join(', '));
  ['horizontal', 'vertical'].forEach(o => {
    ok(names.includes(`calibration-${o}-filled.svg`) && names.includes(`calibration-${o}-outline.svg`), o + ': two SVG files');
    [300, 254].forEach(d => ok(names.includes(`calibration-${o}-${d}dpi.png`) && names.includes(`calibration-${o}-${d}dpi.jpg`), `${o}: PNG and JPG at ${d} dpi`));
  });
  const svg = await ev(() => { const K = PTD.calibration, s = K.shape('horizontal', 480); return { f: K.svg(s, false), o: K.svg(s, true) }; });
  ok(/width="480mm" height="20mm"/.test(svg.f) && /fill="#000"/.test(svg.f) && !/stroke-width/.test(svg.f), 'the filled SVG is solid black and in millimetres');
  ok(/fill="none"/.test(svg.o) && /stroke-width="0.01"/.test(svg.o), 'the outline SVG is a 0.01 mm hairline without fill');

  // ---- bitmaps: size, pure black and white, dpi metadata
  const bm = await ev(async () => {
    const out = {}, files = await PTD.calibration.build();
    for (const f of files) {
      if (!/\.png$/.test(f.name)) { if (/\.jpg$/.test(f.name)) { const d = f.data; out[f.name] = { jfif: d[0] === 255 && d[1] === 216 && d[13] === 1 ? (d[14] << 8 | d[15]) : -1 }; } continue; }
      const d = f.data, dv = new DataView(d.buffer, d.byteOffset);
      const img = await createImageBitmap(new Blob([d], { type: 'image/png' }));
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const c = cv.getContext('2d'); c.drawImage(img, 0, 0);
      const px = c.getImageData(0, 0, img.width, img.height).data; let odd = 0, black = 0;
      for (let i = 0; i < px.length; i += 4) { const v = px[i]; if ((v !== 0 && v !== 255) || px[i + 1] !== v || px[i + 2] !== v) odd++; if (v === 0) black++; }
      let phys = null; for (let o = 8; o < d.length;) { const len = dv.getUint32(o), t = String.fromCharCode(d[o + 4], d[o + 5], d[o + 6], d[o + 7]); if (t === 'pHYs') phys = dv.getUint32(o + 8); o += 12 + len; }
      out[f.name] = { w: img.width, h: img.height, odd, black, phys, corner: px[0] };
    }
    return out;
  });
  const h254 = bm['calibration-horizontal-254dpi.png'], v300 = bm['calibration-vertical-300dpi.png'];
  ok(h254.w === 4900 && h254.h === 300, 'horizontal 254 dpi bitmap is 10 pixels per mm with a 5 mm margin: ' + h254.w + ' x ' + h254.h);
  ok(v300.w === Math.round(30 * 300 / 25.4) && v300.h === Math.round(490 * 300 / 25.4), 'vertical 300 dpi bitmap size: ' + v300.w + ' x ' + v300.h);
  ok(Object.keys(bm).filter(k => /png$/.test(k)).every(k => bm[k].odd === 0), 'PNG pixels are strictly black or white');
  ok(h254.corner === 255 && h254.black > 40000, 'the margin is white and the strip is black: ' + h254.black);
  ok(h254.phys === Math.round(254 / 0.0254) && v300.phys === Math.round(300 / 0.0254), 'PNG files carry their dpi: ' + h254.phys + ', ' + v300.phys);
  ok(bm['calibration-horizontal-254dpi.jpg'].jfif === 254 && bm['calibration-vertical-300dpi.jpg'].jfif === 300, 'JPG files carry their dpi');

  // ---- zip
  const z = await ev(async () => { const f = await PTD.calibration.build(), blob = PTD.calibration.zip(f), u = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(u.buffer); let eocd = u.length - 22; return { sig: dv.getUint32(0, true), count: dv.getUint16(eocd + 10, true), eocd: dv.getUint32(eocd, true), size: u.length, total: f.reduce((s, x) => s + x.data.length, 0) }; });
  ok(z.sig === 0x04034b50 && z.eocd === 0x06054b50 && z.count === 12, 'the zip has 12 entries and valid signatures');
  const zipOk = await ev(async () => { const f = await PTD.calibration.build(); const u = new Uint8Array(await PTD.calibration.zip(f).arrayBuffer()); let s = ''; for (let i = 0; i < Math.min(u.length, 200); i++) s += String.fromCharCode(u[i]); return s.includes('calibration-horizontal'); });
  ok(zipOk, 'file names are stored in the zip');

  // ---- panel, settings and the real download
  await p.click('#tabs button[data-tab="settings"]');
  ok(await p.isVisible('[data-act="calibdl"]') && await p.isVisible('[data-scope="cutter"][data-key="name"]') && await p.isVisible('[data-act="csave"]'), 'the Settings tab has the cutter, the calibration download and the settings file buttons');
  await p.click('#tabs button[data-tab="project"]');
  ok(!(await p.isVisible('[data-act="calibdl"]')) && !(await p.isVisible('[data-act="csave"]')), 'the Project tab no longer has them');
  await p.click('#tabs button[data-tab="settings"]');
  await p.fill('[data-scope="calib"][data-key="lengthMm"]', '300'); await p.dispatchEvent('[data-scope="calib"][data-key="lengthMm"]', 'change');
  ok((await ev(() => PTD.core.cfg().calib.lengthMm)) === 300, 'the strip length is a setting');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click('[data-act="calibdl"]')]);
  ok(dl.suggestedFilename() === 'calibration-images.zip', 'the button downloads calibration-images.zip: ' + dl.suggestedFilename());
  const zp = require('path').join(require('os').tmpdir(), 'ptd-calib-test.zip'); await dl.saveAs(zp);
  const t = require('child_process').spawnSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip(), len(z.namelist()))', zp]).stdout.toString().trim();
  ok(t === 'None 12', 'Python reads the downloaded zip and every CRC is correct: ' + t);
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
