/* Writes the small EPS test set for Roland CutStudio into tests/cutstudio/.
 * Run: node scripts/make-cutstudio-tests.js   (tests/eps.test.js checks that the committed files are up to date) */
const fs = require("fs"), path = require("path");
const E = require("../js/eps.js");
global.window = global.window || { PTD: {} };
require("../js/calibration.js");
const K = global.window.PTD.calibration;

/* All shapes in millimetres, y down (the program's own coordinates). */
function files() {
  const out = {};
  out["01-square-50mm.eps"] = E.build([{ pts: [[0, 0], [50, 0], [50, 50], [0, 50]], closed: true }]);
  out["02-circle-50mm.eps"] = E.build([E.circle(25, 25, 25)]);
  out["03-triangle-apex-up.eps"] = E.build([{ pts: [[25, 0], [50, 50], [0, 50]], closed: true }]);
  out["04-quarter-arc-r50.eps"] = E.build([{ ops: [["M", 50, 0], ["A", 0, 0, 50, 0, Math.PI / 2]] }]);   /* open arc, centre at the top left corner of its box, bulging to the lower right */
  out["05-line-100mm.eps"] = E.build([{ pts: [[0, 0], [100, 0]] }]);
  out["06-letter-L-orientation.eps"] = E.build([{ pts: [[0, 0], [20, 0], [20, 60], [60, 60], [60, 80], [0, 80]], closed: true }]);
  out["07-calibration-strip-horizontal.eps"] = E.build([{ pts: K.shape("horizontal", 480).pts, closed: true }]);
  const res = {};
  Object.keys(out).forEach(k => { res[k] = out[k].text; });
  return res;
}
module.exports = { files };
if (require.main === module) {
  const dir = path.join(__dirname, "..", "tests", "cutstudio");
  fs.mkdirSync(dir, { recursive: true });
  const f = files();
  Object.keys(f).forEach(k => fs.writeFileSync(path.join(dir, k), f[k]));
  console.log("wrote " + Object.keys(f).length + " files to " + dir);
}
