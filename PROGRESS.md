# Progress

Last updated: 2026-11-03.

## Testing honesty

The code was written by an AI assistant. What was checked:

- **Node tests** (`tests/geom.test.js`, `tests/solver.test.js`): arc and bulge geometry, offsets, presets with notches, node splitting, zipper triangulation, and the constraint solver including conflict naming. All pass.
- **Browser tests in headless Chromium** (`tests/e2e.js`): tabs, table presets, notch, player-area line with gap, dragging a node, undo and redo, adding and deleting tables, guides, an equal-spacing constraint and dragging under it, a reported conflict, outline-referenced guides, measure tool, guide placement by click, text edits, missing-font warning, importing a real TTF file, source URL, palette add, rename and delete rules, units, real cloth and dim, project save and reload through text, old logo-editor settings conversion, new project, layout sheet, cut export (fallback without Paper.js, mirror, rotate, strips), PNG export, Blender script download. The randomizer (start, stop, words unchanged, text inside the player area, one undo for a whole run, table shape change, Create casino) is covered too. All pass. The Google Fonts requests fail offline and are ignored.
- **Things on the table** (`tests/e2e-scene.js`): card size modes and centring, chip and card sizes, burn card spacing, seat positions with and without the dealer as a player, 120 random hand snapshots checked against the Hold'em rules, stack spacing, player panel, tooltips, text click-to-select and click-again-to-deselect, the Blender data and the picture option. All pass.
- **Mocked libraries** (`tests/e2e-mocks.js`): the code paths that use opentype.js (freeze and unfreeze) and Paper.js (cut export) run against tiny fake libraries. This checks only the glue code.

**Not tested, and why:**

- **Paper.js and opentype.js themselves.** They are loaded from cdnjs at runtime and could not be downloaded in the development environment. The real boolean operations (knockout of lower objects, halos, clipping to a table, strips) and real glyph outlines are untested. Without Paper.js the cut export still works but leaves overlaps unresolved and says so.
- **Google Fonts** (needs the network) and embedding them into the PNG and Blender texture (fetches the font files; may be blocked by the Artifact host).
- **The Blender script.** Blender is not available in the development environment (pypi is blocked, so `bpy` cannot be installed either). `tests/blender_mock.py` runs the generated script against a stand-in `bpy`; it checks the data path, closed solids and the counts of chips, cards and buttons, not the look. The 3D chips, cards, dealer button and the texture without those objects have never been rendered in real Blender. The first version (default table, text logo) was run by the maintainer in preview mode; the project-driven version (outline from data, rail solid, textured cloth, room sized to the table) has not been run.
- **Real browsers other than Chromium, touch input, narrow screens.**
- **The Claude Artifact build** was checked for loading without errors in Chromium only.

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 0 | Logo editor (px units) | Done, replaced by 2 |
| 1 | Repository, licence, README, CLAUDE.md, GitHub Pages | Done |
| 2 | Millimetre model, config and project JSON, palette, font import with source link, freeze to outlines | Done (see testing notes) |
| 3 | N table outlines with lines and arcs, presets, dealer notch, nodes, real cloth, wrap line, rail, player-area line, guides, snapping, measuring | Done |
| 4 | Layout sheet (HTML and SVG download) | Done |
| 5 | Cut export (SVG per colour, mirror, rotate, X/Y factors, tolerance, strips) | Done, booleans untested |
| 6 | Constraints and solver | Done |
| 7 | Blender export | Done, untested in Blender |
| 7b | Randomizer tab (timer, progress bar, table shape option, Create casino), bundled Porcelain font | Done, checked in headless Chromium with offline fallback fonts only |
| 7c | Player-area line above texts with outline, outline defaults, dealer line, toolbar view switches, random line visibility | Done, checked in headless Chromium; Paper.js knockout of the new line outline untested for real |
| 7d | JSON window (copy, paste, apply), table name switch, Blender script fixed (it never called main()), Blender table preview, stand-in bpy test | Done; Blender itself still not run |
| 7e | Partial files (artwork only, tables only) with one format, Save menu, per-tab Open/Save/JSON, Ctrl+S, Space hand cursor, Blender lights 25 % dimmer (`LIGHT_SCALE`) | Done in headless Chromium (`tests/e2e-parts.js`); the Blender look is unverified |
| 7r | Card line defaults: 380 mm long, 100 mm gap, 4 mm thick, outline on and 3 mm wide; Poker card size | Done in headless Chromium (`tests/e2e-scene.js`) |
| 7q | Random tab ships with the maintainer's chosen defaults (shape on; hand, pot, burn, muck, players, dealer as a player set to shown; notch off; number of players and cards per player vary) | Done in headless Chromium (`tests/e2e-scene.js`); other suites start from a neutral set |
| 7p | New defaults for the player-area line (200 mm from the edge, 3 mm thick); fixed an open player-area line collapsing to two points at 200 mm with a scoop notch (swallowtail of the inward offset) | Done in headless Chromium (`tests/e2e.js`, `tests/e2e-scene.js`) |
| 7o | Tables panel: the player count, cards and dealer side now appear as soon as Show players is ticked (they only showed after another panel refresh) | Done in headless Chromium (`tests/e2e-scene.js`) |
| 7n | Random rows for the poker hand, pot, burn cards and muck, and Number of players, Cards per player and Dealer is a player under Show players, with automatic switching on of the parent | Done in headless Chromium (`tests/e2e-scene.js`) |
| 7m | Corner radius clamped at 0, circle aspect lock with Diameter/Radius or X/Y diameters, ovals as four arcs | Done in Node (`tests/geom.test.js`) and headless Chromium (`tests/e2e-scene.js`) |
| 7l | Random rows with Vary, Set and value for the dealer notch and for showing the players (next to the player-area line and player count) | Done in headless Chromium (`tests/e2e-scene.js`) |
| 7k | Panel header stays in place on open/close, default line length 380 mm, Random progress text repainted right after each round | Done in headless Chromium (`tests/e2e-scene.js`) |
| 7j | Card size no longer depends on the gap (Fit option removed, old fitted files keep their size as Custom) | Done in headless Chromium (`tests/e2e-scene.js`) |
| 7i | Random creates a table when none exists, optional new words each round, clicking a text opens the Artwork tab, millimetre labels on Lines and cards | Done in headless Chromium (`tests/e2e-scene.js`) |
| 7h | Scrubbing keeps going while panels rebuild, circle node drag resizes around the centre, Random Vary/Set/value rows for the player-area line and player count, UV clamp in the Blender template | Done in headless Chromium (`tests/e2e-scene.js`) |
| 7g | Things on the table: players with face-down cards and chip stacks, dealer button, random Hold'em snapshot, card size modes (Poker, Custom, Fit), chip diameter in mm, pot/burn/muck offsets from the gap centre, tooltips on guides and table lines, click-to-select and click-again-to-deselect on the Artwork tab, real 3D chips, cards and button in Blender | Done in headless Chromium (`tests/e2e-scene.js`); Blender part only against the stand-in `bpy` |
| 7f | Randomizer rounds are single undo steps and leave nothing selected, wrap line switch, pot / burn cards / muck decorations, no repeated words in invented names, inward offset fix for short edges (player-area line was lopsided on octagons), history up to 2000 steps | Done in headless Chromium (`tests/e2e-extras.js`, new check in `tests/geom.test.js`) |
| 8 | Table structure: board, foam, rail, Velcro tape | Planned |

## Known gaps

- The poker hand (card faces, ranks, suits) is live text and is **not** part of the cut file; the export says so. Cards need outlines of the fonts they use.
- Cutter profiles and calibration test squares are stored in the configuration file but have no editing screen yet. Strip width is typed in by hand.
- Keep-out zones are not modelled; the layout sheet and the player-area line only show positions.
- The player-area line gap is an adjustable width centred on one side; the real dealer layout is not known yet.
- The cut export has no registration marks, no bridges for stencil work and no DXF or PDF output.
- Halos of text are approximated by a union of shifted copies (three rings of sixteen), accurate to a few percent of the halo width.
- Correction factors scale the output but halos are not rescaled separately (a difference below 0.1 mm for factors near 1).
- The layout sheet is HTML and SVG only (no PDF); `window.print()` is not used because of the Artifact limits. Print it from the downloaded HTML file.
- Blender: gold is not metallic in the texture, curtains and chandelier are simple, and a table is placed at the room centre.

## Open questions

- Heat-transfer vinyl (mirrored cut) or stencil (needs bridges)? Decides defaults for mirror and bridges.
- Cutter model and cutting software, which decides further export formats (DXF, HPGL, PDF).
- Dealer notch dimensions of the real table, and whether the player-area line breaks at the dealer.
- Licence of the Porcelain font: it is kept out of the repository and must be imported from a file.

## Ideas (not necessarily to be implemented)

- Seat markers, dealer button position and chip-size checks against the layout.
- Multiple cloth layouts compared side by side.
- Registration marks and a calibration test square for the cutter.
- Print tiles for printing at 1:1 on A4 sheets.
- Velcro tape path as offset of the table outline, with length report.
- Import an existing SVG as artwork; raster tracing of logos when no font file exists.
- Cards as outlined geometry.
- Light theme and touch input support.
- Localisation through separate resource files, only if the maintainer asks.
