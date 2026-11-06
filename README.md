# Poker Table Designer

A browser-based, CAD-like design tool for poker tables. It starts with the table cloth: lay out the logo, text, lines and cards in real millimetres, check them against one or more table outlines, mark the cloth with a layout sheet, and export cut files for a vinyl cutter. It also writes a Blender script for rendering pictures of the table. Later milestones cover the table structure itself (board, foam, rail).

> **Status: first complete version, mostly tested in headless Chromium only.** See [PROGRESS.md](PROGRESS.md) for what was and was not tested.

## For use with AI

If you work on this repository with an AI assistant (for example Claude), copy the text below into the chat as your first message:

> Look at this GitHub repository: https://github.com/anttiraisala/poker-table-designer (branch `master`). Read `CLAUDE.md` first: it holds the working rules and the design decisions, and you must follow it. Then read `PROGRESS.md` (status, what was tested, planned work, open questions), `REQUIREMENTS.md` (ideas and requirements not built yet) and `README.md` (usage). Then tell me in your own words where the project stands. Do not change anything until I explicitly ask you to.

To get the code on your own computer:

```
git clone https://github.com/anttiraisala/poker-table-designer.git
```

The default branch is `master`.

Notes for the assistant: the rules in `CLAUDE.md` bind you. In short: chat in the language the maintainer writes, write everything in the repository in English, never implement before the maintainer says so, and say plainly what was and was not tested (the tests run in headless Chromium only). The private Claude Artifact link is not stored in the repository: ask the maintainer for it when a release needs to publish it.

## Try it

- **Live:** https://anttiraisala.github.io/poker-table-designer/ (GitHub Pages, see "Enabling GitHub Pages" below)
- **Locally:** download the project and open `index.html` in a modern desktop browser, see "Run it on your computer" below.

## What it does

- **Millimetres, centre origin.** Everything is in real millimetres. The origin (0, 0) is the cloth centre mark; X grows to the right, Y grows downward. Lengths can be shown in mm, cm or inches. Texts, the lines and the hand are measured from the **artwork origin**, a free point that starts at the cloth centre; a button puts it, say, 300 mm in from the dealer edge of a table (a pink diamond marks it).
- **Tables.** Any number of top-down outlines over one shared artwork. An outline is made of lines and arcs: presets (stadium, rectangle, octagon, circle) with an optional dealer notch (scoop or box), or free outlines with draggable nodes and arc handles. Each table has a placement, a rail, a cloth wrap allowance (dashed line) and a player-area line with an optional gap. Convert buttons turn a stadium into an identical rectangle and back, and a squeezed stadium into a circle and back; when a conversion is not possible the panel says why. A real-cloth toggle shows the cloth size and the overhang; "Dim outside" darkens everything outside the tables.
- **Artwork.** Texts (Google script fonts or imported TTF/OTF files), two lines with a poker hand, drag with snapping, multi-select, clone, undo/redo, stacking order.
- **Measurements.** In the Guides and measurements tab choose a kind (point to point, horizontal, vertical, ray towards the table centre or along an axis, shortest distance, along a guide) and point at the canvas: a ghost shows what a click would add and its value, and the snap kind (node, middle, centre, corner, extreme, intersection, nearest) is named at the pointer. Measurements stay attached to the objects, follow them when they move, are saved with the project and are never cut. Lines are measured at their centre by default (a 100 mm gap between the card lines measures 100 mm whatever their thickness); the inner and outer edge can be chosen by pointing. Click a measurement to select it: drag an end point to attach it elsewhere, choose line centre or an edge (card lines and the player-area line) in the panel, press Delete to remove it. Drag the number to move the dimension line; a toolbar switch hides them. The accuracy of text edges is set by the text outline precision (default 10 pixels per mm). The toolbar Measure tool takes the same snap points; when its second point is set, the Pin button (or Enter) keeps the result as a lasting measurement. Tab cycles through the snap points at the pointer (end, middle, centre, intersection, quadrant of an arc, perpendicular foot, nearest).
- **Collapsible parts.** Each heading and each titled panel in every side tab has an arrow button at its left (▲ open, ▼ closed). Clicking something on the canvas selects it and scrolls its panel into view; it does not open it.
- **Roll guides.** In the Guides tab, + Vertical roll or + Horizontal roll adds a guide that also shows the vinyl roll: a blue, slightly transparent band (as wide as the cutting width of the cutter, adjustable) with blue edges across the whole screen, under the artwork and above the cloth. Its line and both edges snap like guides. Set the roll width of any guide to 0 to make it an ordinary guide again. Never cut.
- **Guides, measuring and constraints.** Vertical and horizontal guides measured from the cloth centre or from a table edge, snapping to guides, outline points, extreme edges, other items and an optional grid, a measure tool, and a linear constraint solver (fixed position, distance, minimum, maximum, equal spacing, symmetry, ratio) with driving or reference constraints. Contradicting constraints are refused and the ones involved are named.
- **Randomizer.** The Random tab shuffles the fonts, sizes and positions of your texts every few seconds, with a progress bar, and can also change the table shape. Words are never changed, texts stay inside the player area, the player-area line is shown and hidden at random (switch it off with a checkbox), and a whole run is one undo step. "Create casino" invents a casino name with 0 to 3 helper texts, fonts and positions from nothing.
- **Line outlines and view switches.** The player-area line, the lines and cards, and every text except the two big default ones have an outline by default (3 mm for new texts, up to 50 mm by hand, 0 to 4 mm for texts the randomizer makes): a margin in the cloth colour that cuts a hole in whatever lies below (and in the cut file). The toolbar switches the player-area line, the dealer line (marks the dealer notch) and the centre mark on and off, also while the randomizer runs.
- **JSON window.** The JSON button on the Artwork, Tables, Project and Settings tabs shows that part (artwork, tables with guides, or the whole project) as text with Copy, Paste, Apply, OK and Cancel. The toolbar can hide the table names on the canvas.
- **Players and the hand in progress.** The Tables panel can seat 1 to 12 players evenly along the outline between the rail and the player-area line, each with 2, 3 or 4 face-down cards and one to three chip stacks. A dealer button sits in front of a random player and a random Hold'em snapshot decides who has folded and who has bet. New arrangement reshuffles it. None of it is cut and the randomizer leaves it alone.
- **Random words and tables.** A box in the Random tab also invents new words every round; with it off the words stay as written. With "change table shape" on, the randomizer creates a table if you have deleted them all. Clicking a text on another tab opens the Artwork tab.
- **Casino name and name styles.** The project has its own casino name (field at the top of the Artwork tab); texts ticked "Part of the casino name" are your version of it. The Random tab row "Name style" (Vary, Set, value) can show it as written, split into separate texts (any number of neighbouring words, "of" and articles too) or as a monogram (initials as big letters side by side, the full name small above, below or over them with an outline). A style hides your name texts and makes its own; "Back to my own texts" undoes it. Your other texts keep their words; a box decides whether their fonts change too.
- **Random rows.** In the Random tab the player-area line, the dealer notch, the poker hand, the pot, the burn cards, the muck and the players (with number of players, cards per player and dealer is a player under them) each have Vary, Set and value boxes (by default the hand, pot, burn cards, muck and players are set to shown, the notch to off, the number of players varies and cards per player is set to 2) (tooltips explain them). Set wins over Vary.
- **Panels and lines.** Opening or closing a text panel keeps its header in place while the panels below move. The card lines are 380 mm long by default.
- **Circle and oval.** A circle table is locked to a round shape by default (Diameter and Radius). Untick the lock to give it separate X and Y diameters and make an oval. Corner radius cannot go below 0.
- **Scrubbing.** Drag sideways over any number field or its label to change the value (one step per pixel, Shift coarser, Alt finer); a plain click edits the text. Burn cards are drawn below the pot, and pot chips that overlap them rest on top of the cards in Blender.
- **Card sizes.** Poker (64 x 89 mm), or Custom. The gap between the lines never changes the card size; the hand is centred between the lines and overlaps them if they are closer together than the cards are tall. Chip diameter is set in millimetres.
- **Blender objects.** Chips, cards and the dealer button are real 3D objects in Blender with 0.1 mm gaps; the cloth texture leaves them out. The picture export has an option to include them.
- **Table summary.** Under the status bar each visible table has a line with its type, diameter (round) or width and height, and its roundings.
- **Casino names.** The inventor also makes possessive names ("Devil's Gambit"), "Seven of Spades" style names, famous hand names (Big Slick, Snowman) and themed names ("Black Devil"). More hand names can be added to `HANDS` in `js/random.js`. Names also come in plural and plural possessive forms ("Devils' Den"), as hand names ("Royal Flush", "Full House") and as "Pair of Kings", with the seven deadly sins ("Greedy Dragon", "Wrath Lounge") and in longer forms ("Club of Royal Flush", "The Devil's Saints"). The words of a name are placed in reading order: the first word is never below the next one.
- **Table decorations.** The Lines & cards panel can show a chip pile (pot), three burn cards and a muck of folded cards next to the hand, each with its own X/Y offset and size. They show in the picture and in Blender and are never cut. The randomizer does not touch them. The poker hand, burn cards, muck and pot always lie above all texts and lines, whatever the layer order.
- **Palette.** Named, editable colours; one cut layer per colour; flat or shaded preview.
- **Fonts.** Import font files, keep them inside the project, store the download link as a note, get a warning and a "Load font file" button when a font is missing, and freeze text to outlines (unfreezing keeps the original text and settings).
- **Layout sheet.** A large-print marking guide: drawing, centre cross, guide lines, outline points with arc radii and centres, artwork positions and check diagonals. Everything is measured from the centre, never chained. Download as HTML or SVG.
- **Export again.** After an export, hover the Export tab button at the top to get a small Export again button next to it, or use the toolbar one: it presses the export button you used last, with the current settings.
- **Fonts in the cut file.** Texts are cut as outlines. If a font has no imported file, the export fetches it from the internet (jsDelivr, then GitHub) into memory only; it is not saved in the project. If that fails the message says which text was not cut.
- **Exports.** Cut file (SVG, one layer per colour, mirror, rotate, X/Y correction factors, tolerance, strips), picture (PNG), and a Blender script (see [blender/README.md](blender/README.md)).
- **Files.** Project JSON and configuration JSON (both with a format name and version), opened and saved through file pickers and downloads, plus automatic saving in the browser. Old logo-editor settings files open too (as artwork only). **Save** in the toolbar opens a menu: the whole project, artwork only, or tables only (with guides and constraints); Ctrl+S saves the whole project. A partial file uses the same format and simply leaves the other parts out. **Open** loads everything a file contains and leaves the other parts as they are, so artwork and tables can be kept and swapped separately. The Artwork and Tables tabs have their own Open, Save and JSON buttons.

Click or drag to select and move. The mouse wheel zooms, the right button or Space plus drag pans (the cursor becomes an open hand), and Alt or Ctrl while dragging ignores snapping. Full list of controls is under the canvas.

## Run it on your computer

You do not need to install anything except a modern desktop browser (Chrome, Edge, Firefox or Safari). There is no build step and no server.

**Option A: download a ZIP (easiest, no Git needed)**

1. Open https://github.com/anttiraisala/poker-table-designer in your browser.
2. Click the green **Code** button, then **Download ZIP**.
3. Unzip the file. On Windows right-click it and choose **Extract All**; on macOS double-click it; on Linux use your archive tool. You get a folder called `poker-table-designer-master`.
4. Open that folder and **double-click `index.html`**. The program opens in your default browser. If it opens in the wrong browser, right-click `index.html` and choose **Open with**.
5. To get a newer version later, download the ZIP again and unzip it into a new folder. Your work is not lost: the program autosaves in the browser, and you can also use **Save** to keep project files (JSON) anywhere you like.

**Option B: clone with Git (easy to update)**

1. Install Git from https://git-scm.com if you do not have it.
2. In a terminal (Command Prompt, PowerShell, Terminal) run: `git clone https://github.com/anttiraisala/poker-table-designer.git`
3. Open the folder `poker-table-designer` and double-click `index.html`.
4. To update later, open a terminal in that folder and run `git pull`.

**Good to know**

- Run it from the unzipped folder, not from inside the ZIP file, or the scripts will not load.
- The program works without internet, but the first time you need them it fetches Google Fonts and opentype.js (freezing text to outlines) from the internet. The cut export needs no network for its geometry: overlaps, outline halos and the blade offset are computed by the bundled Clipper library (`js/clipper.js`). Fonts you have not loaded show a fallback font until you are online or import the font file on the **Fonts** tab.
- Autosave lives in the browser profile and the folder address (a `file://` address). If you move the folder or switch browser, use **Save** and **Open** to carry the project over.
- If a browser blocks something when opened from a file, start a tiny local server instead: open a terminal in the folder, run `python3 -m http.server 8000` and visit http://localhost:8000 in the browser. This needs Python 3.

## Enabling GitHub Pages

Repository **Settings** → **Pages** → **Build and deployment** → Source: **Deploy from a branch** → Branch: `master`, folder `/ (root)` → **Save**. The page appears at the address above after about a minute.

## Projects, tabs and word lists

Every project is a tab above the canvas, with its own undo history. Use **+ New project** (it always opens a new tab), **Duplicate tab**, **Open in new tab**, the arrows (or drag a tab) to reorder, and × to close (an untouched tab closes at once, others ask first). The browser keeps an automatic copy of every tab.

The **settings** (toolbar button Settings) hold what all projects share: units, snapping, the cutters, the heat press size, favourite fonts and your own universal words. A **project** file holds everything else, including the palette, the randomizer options, the view switches and the casino-name words of that project.

The casino names come from word lists. The **universal words** ship with the program and can be replaced by your own list (Random tab, "Words for the casino names": edit as JSON, save, open, or reset to the shipped list). Each project can add its own **project words** and can switch the universal words off, so a project can have, for example, only the one name it should always get. Importing words into the universal window asks where they go: replace the universal list, add to it, or copy them into every open project. Write every form you want as its own word; there are no grammar rules.

## Fonts

Google Fonts are loaded at runtime. Third-party font files must not be committed unless their licence allows redistribution. One exception, chosen by the maintainer: [Porcelain](fonts/porcelain/NOTICE.md) is included so it can always be fetched from here (Fonts tab, Load Porcelain, works when the page is served from GitHub Pages). Its licence is unverified; see the notice.

## Working on the project

- [CLAUDE.md](CLAUDE.md) holds the working rules, the code layout and the design decisions. It is written for AI assistants and is useful for humans too.
- [PROGRESS.md](PROGRESS.md) lists milestones, what is tested, open work and ideas.
- [REQUIREMENTS.md](REQUIREMENTS.md) is the list of ideas and requirements that are discussed but not built yet (what was said, how it could be built, what is open).
- **Help.** Every button has a tooltip. F1 (or the Help button) opens the help window at the topic of what you are doing. In the Guides and measurements panel, Generate example adds a random measurement slowly, with a visible pointer, so you can watch how it is done; Undo removes it. The help window has the same examples for each measurement kind, the Measure tool with Pin, and placing a guide. Any key or click stops an example.
- **Settings button (toolbar).** The settings file (Save, Open, Reset settings, Settings JSON) is here, apart from the project.
- **Cutters button (toolbar).** Your cutters (add, copy, delete, reorder; cutting width, longest cut, thinnest detail; Cutters JSON and files), the heat press size and the calibration. Download the calibration images (a zip with 14 files: several test strips of different lengths in one file, horizontal and vertical, SVG, EPS for Roland CutStudio, PNG and JPG at 300 and 254 dpi), cut them, measure the kept pieces with a caliper (the measuring guide window or PDF shows what to measure) and type the sizes: the tab works out a correction factor for X and Y and the blade offset. Without numbers nothing is corrected.
- **Export tab, cut file.** SVG or EPS (one file per colour in a zip), with filters (texts, upper and lower card line, player-area line, only the selected elements, keep the position), named jobs, a size (scale) for X and Y with Fit to roll width and Fit to the heat press, the cutter's calibration correction and blade offset, and warnings for a design that is too wide or has details too thin. The boolean work (overlaps are knocked out, text outlines are round) and the blade offset are done by the bundled Clipper library, so they need no network; only the font files of Google fonts may be fetched from the internet when a text has to be turned into outlines.
- Tests: `node tests/geom.test.js`, `node tests/solver.test.js`, `node tests/eps.test.js`, `node tests/calfit.test.js`, and the browser tests `tests/e2e.js`, `tests/e2e-more.js`, `tests/e2e-mocks.js`, `tests/e2e-parts.js`, `tests/e2e-extras.js`, `tests/e2e-scene.js`, `tests/e2e-origin.js`, `tests/e2e-convert.js`, `tests/e2e-shapes.js` and `tests/e2e-words.js`, `tests/e2e-measure.js`, `tests/e2e-calibration.js`, `tests/e2e-help.js`, `tests/e2e-names.js`, `tests/e2e-cutters.js`, `tests/e2e-fontfetch.js` (they need Playwright with Chromium, which is not a project dependency).
- `scripts/make-artifact.py` converts `index.html` into one self-contained file in the format the Claude Artifact tool expects, so the same code can also run inside a Claude chat.
- `scripts/make-words-js.py` regenerates `js/words-basic.js` from `data/words-basic.json` after the shipped casino-name words change.
- `scripts/make-blender-js.py` regenerates `js/blender-template.js` after the Blender template in `blender/src/` changes.

## License

MIT, see [LICENSE](LICENSE). Third-party fonts keep their own licences. `js/clipper.js` is the JavaScript port of Angus Johnson's Clipper library 6.4.2 (from github.com/junmer/clipper-lib), unchanged, under the Boost Software Licence (the licence notice is in the file header).

## EPS for Roland CutStudio

Roland CutStudio cannot import SVG, so the calibration zip contains `calibration-horizontal.eps` and `calibration-vertical.eps`: thin cut lines only (no fills, groups, clipping or text) in the crude EPS style that CutStudio reads (`m`, `l` and `c` commands only, closed paths closed by repeating the first point, an extra `0 0 m` at the end). The drawing is in real size (mm converted to points), not upside down, and sits with its lower left corner at 0 0. The writer is `js/eps.js`; arcs become cubic curves.

Open risks (nothing here has been opened in a real CutStudio yet):

* The EPS template is written from scratch with the same structure as the Inkscape plugin `inkscape-roland-cutstudio` (GPL-2.0-or-later; this project is MIT, so nothing was copied). CutStudio's reader is crude and may depend on details of the plugin's template that are not reproduced. If a file does not import, tell us: the fallback is to use the plugin's template as it is in a separate GPL-licensed file.
* Size and direction: checked only by unit tests (25.4 mm is 72 pt, y up). A real import must confirm the size and that nothing is mirrored or upside down.
* The last line of a file: the extra `0 0 m` is there, but only CutStudio can show that the last path is cut.
* The line width (0.5 mm) is only a picture; the cutter follows the centre line.
* Files are limited to +-10000 pt (about +-3.5 m) around the lower left corner; larger drawings give a warning.
* Not built: mirroring, crop marks (print and cut), EPS in the normal cut export.

Test files for CutStudio are in `tests/cutstudio/` (square, circle, triangle, arc, line, an L for direction, the calibration strip) with a short test guide. Run `node scripts/make-cutstudio-tests.js` to regenerate them.
