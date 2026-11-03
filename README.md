# Poker Table Designer

A browser-based, CAD-like design tool for poker tables. It starts with the table cloth: lay out the logo, text, lines and cards in real millimetres, check them against one or more table outlines, mark the cloth with a layout sheet, and export cut files for a vinyl cutter. It also writes a Blender script for rendering pictures of the table. Later milestones cover the table structure itself (board, foam, rail).

> **Status: first complete version, mostly tested in headless Chromium only.** See [PROGRESS.md](PROGRESS.md) for what was and was not tested.

## Try it

- **Live:** https://anttiraisala.github.io/poker-table-designer/ (GitHub Pages, see "Enabling GitHub Pages" below)
- **Locally:** open `index.html` in a modern desktop browser. There is no build step, no server and no dependencies. Google Fonts, opentype.js and Paper.js are loaded from the internet when needed.

## What it does

- **Millimetres, centre origin.** Everything is in real millimetres. The origin (0, 0) is the cloth centre mark; X grows to the right, Y grows downward. Lengths can be shown in mm, cm or inches.
- **Tables.** Any number of top-down outlines over one shared artwork. An outline is made of lines and arcs: presets (stadium, rectangle, octagon, circle) with an optional dealer notch (scoop or box), or free outlines with draggable nodes and arc handles. Each table has a placement, a rail, a cloth wrap allowance (dashed line) and a player-area line with an optional gap. A real-cloth toggle shows the cloth size and the overhang; "Dim outside" darkens everything outside the tables.
- **Artwork.** Texts (Google script fonts or imported TTF/OTF files), two lines with a poker hand, drag with snapping, multi-select, clone, undo/redo, stacking order.
- **Guides, measuring and constraints.** Vertical and horizontal guides measured from the cloth centre or from a table edge, snapping to guides, outline points, extreme edges, other items and an optional grid, a measure tool, and a linear constraint solver (fixed position, distance, minimum, maximum, equal spacing, symmetry, ratio) with driving or reference constraints. Contradicting constraints are refused and the ones involved are named.
- **Randomizer.** The Random tab shuffles the fonts, sizes and positions of your texts every few seconds, with a progress bar, and can also change the table shape. Words are never changed, texts stay inside the player area, the player-area line is shown and hidden at random (switch it off with a checkbox), and a whole run is one undo step. "Create casino" invents a casino name with 0 to 3 helper texts, fonts and positions from nothing.
- **Line outlines and view switches.** The player-area line, the lines and cards, and every text except the two big default ones have an outline by default: a margin in the cloth colour that cuts a hole in whatever lies below (and in the cut file). The toolbar switches the player-area line, the dealer line (marks the dealer notch) and the centre mark on and off, also while the randomizer runs.
- **JSON window.** The JSON button on the Artwork, Tables and Project tabs shows that part (artwork, tables with guides, or the whole project) as text with Copy, Paste, Apply, OK and Cancel. The toolbar can hide the table names on the canvas.
- **Players and the hand in progress.** The Tables panel can seat 1 to 12 players evenly along the outline between the rail and the player-area line, each with 2, 3 or 4 face-down cards and one to three chip stacks. A dealer button sits in front of a random player and a random Hold'em snapshot decides who has folded and who has bet. New arrangement reshuffles it. None of it is cut and the randomizer leaves it alone.
- **Random words and tables.** A box in the Random tab also invents new words every round; with it off the words stay as written. With "change table shape" on, the randomizer creates a table if you have deleted them all. Clicking a text on another tab opens the Artwork tab.
- **Random rows.** In the Random tab the player-area line and the number of players each have Vary, Set and value boxes (tooltips explain them). Set wins over Vary.
- **Panels and lines.** Opening or closing a text panel keeps its header in place while the panels below move. The card lines are 600 mm long by default.
- **Scrubbing.** Drag sideways over any number field or its label to change the value (one step per pixel, Shift coarser, Alt finer); a plain click edits the text. Burn cards are drawn below the pot, and pot chips that overlap them rest on top of the cards in Blender.
- **Card sizes.** Poker (64 x 89 mm), or Custom. The gap between the lines never changes the card size; the hand is centred between the lines and overlaps them if they are closer together than the cards are tall. Chip diameter is set in millimetres.
- **Blender objects.** Chips, cards and the dealer button are real 3D objects in Blender with 0.1 mm gaps; the cloth texture leaves them out. The picture export has an option to include them.
- **Table decorations.** The Lines & cards panel can show a chip pile (pot), three burn cards and a muck of folded cards next to the hand, each with its own X/Y offset and size. They show in the picture and in Blender and are never cut. The randomizer does not touch them.
- **Palette.** Named, editable colours; one cut layer per colour; flat or shaded preview.
- **Fonts.** Import font files, keep them inside the project, store the download link as a note, get a warning and a "Load font file" button when a font is missing, and freeze text to outlines (unfreezing keeps the original text and settings).
- **Layout sheet.** A large-print marking guide: drawing, centre cross, guide lines, outline points with arc radii and centres, artwork positions and check diagonals. Everything is measured from the centre, never chained. Download as HTML or SVG.
- **Exports.** Cut file (SVG, one layer per colour, mirror, rotate, X/Y correction factors, tolerance, strips), picture (PNG), and a Blender script (see [blender/README.md](blender/README.md)).
- **Files.** Project JSON and configuration JSON (both with a format name and version), opened and saved through file pickers and downloads, plus automatic saving in the browser. Old logo-editor settings files open too (as artwork only). **Save** in the toolbar opens a menu: the whole project, artwork only, or tables only (with guides and constraints); Ctrl+S saves the whole project. A partial file uses the same format and simply leaves the other parts out. **Open** loads everything a file contains and leaves the other parts as they are, so artwork and tables can be kept and swapped separately. The Artwork and Tables tabs have their own Open, Save and JSON buttons.

Click or drag to select and move. The mouse wheel zooms, the right button or Space plus drag pans (the cursor becomes an open hand), and Alt or Ctrl while dragging ignores snapping. Full list of controls is under the canvas.

## Enabling GitHub Pages

Repository **Settings** → **Pages** → **Build and deployment** → Source: **Deploy from a branch** → Branch: `master`, folder `/ (root)` → **Save**. The page appears at the address above after about a minute.

## Fonts

Google Fonts are loaded at runtime. Third-party font files must not be committed unless their licence allows redistribution. One exception, chosen by the maintainer: [Porcelain](fonts/porcelain/NOTICE.md) is included so it can always be fetched from here (Fonts tab, Load Porcelain, works when the page is served from GitHub Pages). Its licence is unverified; see the notice.

## Working on the project

- [CLAUDE.md](CLAUDE.md) holds the working rules, the code layout and the design decisions. It is written for AI assistants and is useful for humans too.
- [PROGRESS.md](PROGRESS.md) lists milestones, what is tested, open work and ideas.
- Tests: `node tests/geom.test.js`, `node tests/solver.test.js`, and the browser tests `tests/e2e.js`, `tests/e2e-more.js`, `tests/e2e-mocks.js`, `tests/e2e-parts.js` and `tests/e2e-extras.js` (they need Playwright with Chromium, which is not a project dependency).
- `scripts/make-artifact.py` converts `index.html` into one self-contained file in the format the Claude Artifact tool expects, so the same code can also run inside a Claude chat.
- `scripts/make-blender-js.py` regenerates `js/blender-template.js` after the Blender template in `blender/src/` changes.

## License

MIT, see [LICENSE](LICENSE). Third-party fonts keep their own licences.
