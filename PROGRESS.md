# Progress

Last updated: 2026-11-04.

## Testing honesty

The code was written by an AI assistant. What was checked:

- **Node tests** (`tests/geom.test.js`, `tests/solver.test.js`): arc and bulge geometry, offsets, presets with notches, node splitting, zipper triangulation, and the constraint solver including conflict naming. All pass.
- **Browser tests in headless Chromium** (`tests/e2e.js`): tabs, table presets, notch, player-area line with gap, dragging a node, undo and redo, adding and deleting tables, guides, an equal-spacing constraint and dragging under it, a reported conflict, outline-referenced guides, measure tool, guide placement by click, text edits, missing-font warning, importing a real TTF file, source URL, palette add, rename and delete rules, units, real cloth and dim, project save and reload through text, old logo-editor settings conversion, new project, layout sheet, cut export (fallback without Paper.js, mirror, rotate, strips), PNG export, Blender script download. The randomizer (start, stop, words unchanged, text inside the player area, one undo for a whole run, table shape change, Create casino) is covered too. All pass. The Google Fonts requests fail offline and are ignored.
- **Things on the table** (`tests/e2e-scene.js`): card size modes and centring, chip and card sizes, burn card spacing, seat positions with and without the dealer as a player, 120 random hand snapshots checked against the Hold'em rules, stack spacing, player panel, tooltips, text click-to-select and click-again-to-deselect, the Blender data and the picture option. All pass.
- **Word lists, settings/project split and project tabs** (`tests/e2e-words.js`): the shipped words (Stallion, Knight, Night, Arabia, Arabian Nights, possessives), a project with only a full name and no universal words, the unique union of universal and project words, replacing and resetting the universal list, what the settings file and the project file hold, and tabs (new, duplicate, move, switch, per-tab undo and view, autosave keys, reload, close). Headless Chromium only.
- **Mocked libraries** (`tests/e2e-mocks.js`): the code paths that use opentype.js (freeze and unfreeze) and Paper.js (cut export) run against tiny fake libraries. This checks only the glue code.

**Not tested, and why:**

- **Paper.js and opentype.js themselves.** They are loaded from cdnjs at runtime and could not be downloaded in the development environment. The real boolean operations (knockout of lower objects, halos, clipping to a table, strips) and real glyph outlines are untested. Without Paper.js the cut export still works but leaves overlaps unresolved and says so.
- **Google Fonts** (needs the network) and embedding them into the PNG and Blender texture (fetches the font files; may be blocked by the Artifact host).
- **The Blender script.** Blender is not available in the development environment (pypi is blocked, so `bpy` cannot be installed either). `tests/blender_mock.py` runs the generated script against a stand-in `bpy`; it checks the data path, closed solids and the counts of chips, cards and buttons, not the look. The 3D chips, cards, dealer button and the texture without those objects have never been rendered in real Blender. The first version (default table, text logo) was run by the maintainer in preview mode; the project-driven version (outline from data, rail solid, textured cloth, room sized to the table) has not been run. The maintainer reports that he has run the Blender export in real Blender several times and that it works; the newest parts (3D chips, cards and button, ovals) are not confirmed by name.
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
| 7v | Random table shapes: circles and octagons 600 to 1200 mm (equal sides), rectangles and stadiums 600 to 1200 mm high with a width factor of 4/3 to 2, all limits adjustable on the Random tab; notches scaled to the straight part of the side | Done in headless Chromium (`tests/e2e-shapes.js`) |
| 7w | The poker hand (flop, turn, river) is a table object: it is always drawn above all texts, lines and the player-area line, whatever the layer order. Order from bottom to top: muck, burn cards, hand, pot chips, players. The layer order of the lines (`band.at`) now only places the two lines. The hand stays in the picture and the Blender texture and is never cut. Tested in headless Chromium only (new checks in `tests/e2e-scene.js`). | Done |
| 7x | Table summary under the status bar: one line per visible table with type, diameter (round table) or width and height (other types, free outlines use the bounding box) and the roundings (stadium end radius, rectangle corner radius, octagon chamfer). Tested in headless Chromium only (`tests/e2e-convert.js`). | Done |
| 7y | Casino name inventor: possessive names ("Devil's Gambit"; owner groups dark, holy, card, table, beast, each with its own fitting head words), "X of Y" names ("Seven of Spades", "Queen of Heaven"; Two and Deuce both used), famous hand names (Big Slick, Snowman, Seven Deuce...), themed words with matching adjectives ("Black Devil", "Golden Paradise") and a small block list for silly pairs. The maintainer adds more hand names himself in `HANDS` in `js/random.js`. Tested in headless Chromium only (`tests/e2e-extras.js`); the names were reviewed from a sample of about 1000. Planned: check in a real browser that decorative fonts have an apostrophe glyph. | Done |
| 7z | Name inventor: plurals by rule for countable nouns ("Black Devils"), plural possessives without the extra s ("Devils' Playground", only for owners that sound right), hand names as whole phrases (Royal Flush, Full House, Four of a Kind, Two Pair, Quads, Wheel...) with suffixes that would repeat a word left out, and "Pair of Kings" / "Set of Sevens". The name is split into big texts so that "of" stays with the word before and articles (a, the, Le, La, Les) with the word after. Reading order on the cloth: along the name the first word is never lower than the next, and at the same height it is to the left (row, stack and scatter layouts; scatter no longer shuffles the words). Tested in headless Chromium only (`tests/e2e-extras.js`). With "change the words" off the order follows the order of the text list. | Done |
| 7aa | Random circles and octagons: default minimum size is now 800 mm (was 600 mm); the user can still set it lower on the Random tab. Rectangles and stadiums keep 600 mm. Tested in headless Chromium only (`tests/e2e-shapes.js`). | Done |
| 7ab | Name inventor: the seven deadly sins plus Wealth as nouns and adjectives (Pride/Proud, Greed/Greedy, Lust/Lustful, Envy/Envious, Gluttony/Gluttonous, Wrath/Wrathful, Sloth/Slothful, Wealth/Wealthy); sins as possessive owners ("Greed's Den"), with suffixes ("Wrath Lounge") and as adjectives on people ("Greedy Dragon"). Longer names of three to five words: "Club of Royal Flush", "House of Kings", "Den of Sinners", "Temple of Greed", "The Devil's Saints", with "The" in front now and then. Tested in headless Chromium only (`tests/e2e-extras.js`). | Done |
| 7ac | Name inventor: more words. Adjectives Silk, Oriental, Universal, Public, Private (Velvet was already there); nouns Hooker, Bitch, Dog, Hooter, Boob, Universe (singular and plural, Hooters and Boobs mostly plural; Hooker and Dog also as owners, "Dog's Den"); places Sun, Palm, Beach, Palm Beach; and a new pattern adjective + suffix ("Private Club", "Public House"). Note: Hooters is a registered restaurant brand; the maintainer decided to include it. Tested in headless Chromium only (`tests/e2e-extras.js`). | Done |
| 7ae | New project always opens a new tab (no replace, no question); an untouched tab closes silently and any other asks "Are you sure"; importing word lists into the universal window (or a general place) asks whether to replace the universal list, add to it, copy into every open project, or (general places) use them for this project only; JSON kinds are recognised from their keys. Tested in headless Chromium only (`tests/e2e-words.js`, `tests/e2e.js`). | Done |
| 7ad | Words as data and projects as tabs. The casino-name words moved from code to `data/words-basic.json` (generated into `js/words-basic.js` by `scripts/make-words-js.py`); new words Stallion, Knight, Night (with possessives), Arabian, Arabia, "Arabian Nights". Universal words (shipped, or the user's own replacement kept in the settings, with save, open and reset) plus project words with a `useUniversal` switch; JSON windows for project words, universal words and settings. Settings/project split: palette, randomizer options, view switches and a copy of the cutter now live in the project (not in the undo history). Project tabs with their own undo history and autosave keys (new, duplicate, open in new tab, move, close). Tested in headless Chromium only (`tests/e2e-words.js`); never tried in a real browser. The new tab bar and the Words section of the Random tab have not been looked at by the maintainer yet. | Done |
| 7u | Convert buttons between stadium, rectangle and circle tables, with a visible reason when a conversion is not possible (corner radius, equal width and height, dealer notch) | Done in headless Chromium (`tests/e2e-convert.js`) |
| 7t | Artwork origin: a free point (x, y from the cloth centre, default the centre) that all artwork is measured from, with a quick button that places it 300 mm (adjustable) in from the dealer edge (notch bottom) of a chosen table; table changes never move it; old files unchanged; V33 files converted | Done in headless Chromium (`tests/e2e-origin.js`); not tried in real Blender or other browsers |
| 7s | New default offsets for pot (-270/-50), burn cards (-250/30) and muck (-450/10); all three shown by default | Done in headless Chromium (`tests/e2e-scene.js`) |
| 7r | Card line defaults: 380 mm long, 100 mm gap, 4 mm thick, outline on and 3 mm wide; Poker card size | Done in headless Chromium (`tests/e2e-scene.js`) |
| 7q | Random tab ships with the maintainer's chosen defaults (shape on; hand, pot, burn, muck, players, dealer as a player set to shown; notch off; number of players varies, cards per player set to 2) | Done in headless Chromium (`tests/e2e-scene.js`); other suites start from a neutral set |
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

- The poker hand, the pot, the burn cards, the muck and the players are design aids and are deliberately not part of the cut file (decided by the maintainer). The export still prints a warning about the hand; it could be dropped.
- Cutter profiles and calibration test squares are stored in the configuration file but have no editing screen yet (see Planned for the calibration variants). Strip width is typed in by hand.
- Keep-out zones are not modelled; the layout sheet and the player-area line only show positions.
- The player-area line gap is an adjustable width centred on one side; the real dealer layout is not known yet.
- The cut export has no registration marks, no bridges for stencil work and no DXF or PDF output.
- Halos of text are approximated by a union of shifted copies (three rings of sixteen), accurate to a few percent of the halo width.
- Correction factors scale the output but halos are not rescaled separately (a difference below 0.1 mm for factors near 1).
- The layout sheet is HTML and SVG only (no PDF); `window.print()` is not used because of the Artifact limits. Print it from the downloaded HTML file.
- Blender: gold is not metallic in the texture, curtains and chandelier are simple, and a table is placed at the room centre.

## Planned (agreed in discussion, not built yet)

- **Players with several visible tables.** Decided: the table that is highest in the table list is the topmost one, as if the viewer looked down through all tables from above; players show only on that table. Needs a way to reorder tables by dragging them in the list (like reordering layers), a decision on how this fits the per-table Show players switch and the Random rows (which work per visible table today), and the list order would also be the drawing order of the outlines.
- **Production pipeline.** The export order is: vectorise the artwork (union and subtraction, halos become holes), split it into cuttable pieces along a grid, name every piece, make a small vector label of the name and place it next to its piece, and cut everything, so the name is cut into the vinyl beside the piece. Pieces are named on the screen too, and an assembly map shows where each piece goes on the cloth. Pieces should preferably fit one heat press; a longer piece can be pressed in several steps, but then a seam remains (a shorter seam looks tidier and is harder to align). The vinyl is single-colour for now.
- **Overlap between pieces.** At every split (strips, tiles, and the parts of the player-area line and other edge lines, curved and straight) the pieces run a little over their neighbours (adjustable, per project), so that a slightly misplaced piece leaves no gap. There is already a strip overlap setting; extend the idea to every split. Halos are no problem for seams: the cut shapes already have the holes, so the split and the overlap are made after the subtraction and only copy visible geometry.
- **Packing long pieces.** Long narrow pieces (edge lines cut into parts) are turned 90 degrees across the roll so that several sit side by side and use little roll length.
- **Roll width and heat press guides.** Design aids on the canvas (toolbar switches): the width of the vinyl roll (from the cutter profile) as guide lines or a band, and a grid of heat-press-sized squares, press size adjustable, default 390 x 390 mm (the maintainer remembers this size; to be checked against the real press). The grid starts at the artwork origin by default and can be shifted; it also drives the split into pieces.
- **More guides.** The user should be able to create guide lines for any sensible measure that can be repeated on the real cloth, and use them to align the pieces (the layout sheet already lists guide lines measured from the centre or the outline).
- **Calibration test.** Export the calibration pattern in three variants: a full square, a horizontal part only, or a vertical part only, so that one direction can be calibrated without cutting the whole square. Needs the missing editing screen for cutter profiles and calibration.
- **Guided workflow ("Advise me").** A wizard or advice button that walks a new user through the whole process: creating and placing the texts, checking them against the tables, printing or exporting, cutting and applying. Idea: a checklist that reads the project (missing fonts, texts outside the table, export settings) and links to the right tab, not a locked wizard.

- **Demo mode (agreed design, NOT built; build only when the maintainer says so).** A page address option turns the page into a full-window presentation without panels, toolbar or tabs; the randomizer runs all the time with the options saved in the project; the project is carried in the address as Base64 of a compressed project; a button on the Export tab makes the link; below the randomizer's stop button there is a countdown/progress bar to the next change. To settle first: how to leave the demo, address length limits, fonts imported from files cannot travel in a link, full-screen rules in the Artifact host.
- **Word packs** (named sets of words that can be switched on per project), **editable name templates** and a **seed** for the name inventor: suggested, not agreed.
- **Tabs, later:** a "saved to file" marker per tab is only a dot on unsaved tabs; there is no recovery list of closed tabs.

## Open questions

- Heat-transfer vinyl (mirrored cut) is implied by the heat press, but it is not confirmed; confirming it would make mirror the default. Stencil work (needs bridges) is not planned.
- Cutter model and cutting software, which decides further export formats (DXF, HPGL, PDF).
- Dealer notch dimensions of the real table, and whether the player-area line breaks at the dealer.
- Real size of the heat press (390 x 390 mm is from memory) and whether it needs a margin at its edges.
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

### Brainstorm of 2026-11-04 (suggested, nothing decided)

Practical: cost calculator for vinyl length, waste and price; animated assembly guide (pieces appear in order with name and press position); heat press timer and a done-list per piece; photograph the real cloth and overlay the plan to show the deviation; AR preview on the real table with a phone; table structure plans (plywood cut sheets, foam and rail parts, length list, same as milestone 8); Velcro path; 1:1 printable template on A4 sheets; several cloth versions side by side.

Playful: play real Hold'em at the designed table with bots; friends' names and faces at the seats; replay a game log on the table; seat calculator (how many players fit, room behind them); statistics on the cloth (for example an "evening winner" text that updates from results).

Wild: lighting design with reflections on the gold in Blender and a matching LED strip for the casino sign; AI logo creation from a text description of the style; 3D-printable chips with the casino logo (STL export); sound effects (card snap, chip clink) while dragging; a walkable 3D tour of the Blender room in the browser; one-button casino generator (name, logo, cloth, sign and room in three styles, the Random tab's Create casino being the first step).
