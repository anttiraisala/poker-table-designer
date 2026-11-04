# CLAUDE.md

Working rules and design decisions for AI assistants (and humans) working on **Poker Table Designer**.

## Project in one paragraph

A browser-based, CAD-like design tool for poker tables, built for the Molino Royale home casino. Phase focus: the printed or vinyl pattern for the table cloth (logo, text, lines, cards) in real millimetres, checked against one or more table outlines, with cut export for a vinyl cutter. Later: the table structure (board, foam, rail). See [PROGRESS.md](PROGRESS.md) for status and [README.md](README.md) for usage.

## Repository conventions

- Branch: `master`. Licence: MIT. No build step, no dependencies for the core page.
- `index.html` is the source of truth: a complete standalone page that opens directly in a browser and is served by GitHub Pages (Settings, Pages, Deploy from a branch, `master`, `/ (root)`). Live URL: https://anttiraisala.github.io/poker-table-designer/
- The same code must also run as a Claude Artifact. The Artifact host wraps the file itself, so run `python3 scripts/make-artifact.py` to produce `dist/artifact.html` (no doctype, html, head or body tags) and publish that file. Never hand-edit the generated file.
- Artifact limits to respect: scripts only from approved CDNs (cdnjs, jsdelivr, unpkg), stylesheets only from Google Fonts, no network calls to other hosts, no `window.print()`, files leave the page as downloads. Code that depends on these must degrade gracefully when the page runs standalone.
- Code layout: `index.html` (skeleton), `css/app.css`, and classic scripts in `js/` that share the `window.PTD` namespace (no ES modules, so the page also works from `file://`): `geom.js` (arcs, offsets, presets; also runs in Node), `solver.js` (guide constraints; also runs in Node), `fonts.js`, `tables.js`, `guides.js`, `sheet.js`, `export.js`, `scene.js` (objects on the table: pot, burn cards, muck, players, dealer button; one generator for the stage, the picture and Blender), `random.js` (randomizer and casino-name inventor), `jsonbox.js` (JSON window), `app.js` (core, loaded last). `js/blender-template.js` is generated from `blender/src/scene_template.py` by `scripts/make-blender-js.py`; never edit it by hand. Keep `index.html` loadable without a build step.
- Tests: `node tests/geom.test.js`, `node tests/solver.test.js`, `python3 tests/blender_mock.py script.py --expect-project` (runs a generated Blender script against a stand-in bpy; `tests/e2e.js` calls it), and the Playwright browser tests `tests/e2e.js`, `tests/e2e-more.js`, `tests/e2e-mocks.js`, `tests/e2e-parts.js`, `tests/e2e-extras.js` and `tests/e2e-scene.js` (Playwright is not a project dependency; see the file headers).
- Do not commit third-party font files or other assets without a licence that allows redistribution. Fonts are loaded from Google Fonts or imported by the user from a file. One deliberate exception, decided by the maintainer: `fonts/porcelain/PORCELAIN.TTF` is committed with a `NOTICE.md` that records its origin and that its licence is unverified.
- Version tag: the page shows `V<number> · <YYYYMMDDhhmm>` (UTC+2) under the title. Run `python3 scripts/stamp-version.py` right before every commit (it writes `js/version.js`; never edit that file by hand).
- Verify what you can (syntax checks, small node tests). State plainly in PROGRESS.md what was and was not tested in a real browser.

## Design decisions (agreed with the maintainer)

- **Units:** all geometry in millimetres. Old logo-editor settings JSON loads as the artwork part (1 unit = 1 mm).
- **Files:** one config JSON (units, snapping, palette, cutter profiles, favourite fonts) and one project JSON (tables, guides, constraints, artwork, export choices). Both carry a format name and version. Keys are English with units in names (for example `fontSizeMm`). Open and Save use the file picker and downloads; the browser also autosaves. A project file may be partial: `artwork` (layers, band, cards), `cloth` and used fonts and colours; or `tables`, `guides`, `constraints` and used colours. Save offers Project, Artwork only and Tables only; Open merges everything the file contains and keeps the rest (palette merges by id unless the file has both parts; fonts merge by family; `name` applies unless the file holds exactly one of the two groups; export references to missing tables reset). Old logo-editor settings load as artwork only.
- **Randomizer:** a Random tab shuffles fonts, sizes and layout of the existing texts on a timer (optionally also table shapes) and can invent a casino with helper texts. Words of user texts are never changed unless the "change the words" box is ticked (then every round invents a new casino name and helper texts, replacing all texts, as one undo step), texts stay inside the player area (bet-line inset of the first visible table), partial overlap is allowed, colours are never changed. Every round is its own undo step and nothing is selected afterwards, so a stopped run can be stepped through with Undo and Redo; one Create casino is one step; Undo while it runs stops it first. Invented names and helper texts never repeat a word, and "EST." appears at most once. Ten properties have a row of Vary, Set and value boxes: the player-area line, the dealer notch, the poker hand, the pot, the burn cards, the muck and Show players, and three rows under Show players (number of players 1 to 12, cards per player 2 to 4, dealer is a player). Vary changes it at random in every round (per visible table for the table properties, with a new arrangement whenever a player property varies); Set replaces it with the chosen value and wins over Vary. Show players decides first; the rows under it are only decided on tables that show their players, are disabled when Show players is set hidden, and ticking Vary or Set on one of them switches Show players on (Set) unless it is already Set or Vary. Shipped defaults (chosen by the maintainer): change table shape on, words off; Set on for the player-area line (shown), the dealer notch (off), the poker hand, pot, burn cards and muck (shown), Show players (shown) and Dealer is a player (on); Vary on for the number of players and cards per player; interval 5 s.
- **Fonts:** import from TTF or OTF files. A source URL is stored only as informational metadata. Fallback chain: embedded in project, Google Fonts by name, browser memory. If a font is missing, warn, show a fallback font and offer "Load font file". Text can be live, embedded or frozen to geometry (outlines via opentype.js); unfreezing keeps the original spec.
- **Tables:** N top-down table outlines over one shared cloth artwork, each with name, size, end style or radius, colour, visibility, placement and wrap allowance. An outline is a closed node list of lines and arcs (a node has x, y and a bulge, where bulge is tan(angle/4) of the segment that starts at that node; 0 is a line, 1 a half circle). Presets (stadium, rectangle, octagon, circle, with an optional dealer notch as scoop or box) generate nodes; moving a node makes the outline free. Each table also has a rail ring and a player-area ("bet") line, an inward offset of the outline with an optional gap. The cloth is infinite by default; a toggle shows a real cloth size. The origin is the cloth centre mark.
- **Lines above texts, outlines on by default:** the player-area line is drawn and cut above all texts, with an outline (margin) that knocks a hole in whatever lies below it. The lines-and-cards band is above all texts by default and has an outline. New texts have an outline by default; the two big default texts (Molino, Royale) do not. If the randomizer has "change table shape" on and there is no table, it creates one. Clicking a text on any tab brings the Artwork tab forward. The randomizer never changes outlines or colours, but may show or hide the player-area line. View switches (centre mark, dealer line, player-area line) are in the toolbar and work while the randomizer runs. The dealer line marks the mouth of the dealer notch on the stage only and is not exported.
- **Table decorations:** pot (chips), burn cards and muck (folded cards) next to the hand, set with offsets and sizes in the Lines & cards panel. They are drawn with the cards, so they show in the picture and the Blender texture, and are not part of the cut file. Each table has a switch for its dashed wrap line (also a toolbar switch for all visible tables); the randomizer never changes it. The Random tab can show, hide or vary the pot, burn cards and muck.
- **Things on the table:** pot, burn cards, muck and players (1 to 12 per table, 2 to 4 cards each, one to three chip stacks, dealer button, random Hold'em snapshot) come from one seeded generator in `scene.js`. They show on the stage and in the picture (option), are real 3D objects in Blender (chips 40 mm x 2 mm by default, button 70 x 4 mm, 0.1 mm air gaps), are not in the Blender texture and are never cut. The randomizer only changes them through the Vary and Set rows of the Random tab. Card size modes: Poker 64 x 89 mm and Custom; the gap between the lines never changes the card size (the hand stays centred and may overlap the lines). The automatic randomizer keeps the casino name and texts unless its words box is ticked. Pot, burn and muck offsets are measured from the centre of the gap between the two lines.
- **Number fields:** dragging sideways over a number field or its label scrubs the value; a click still edits. Burn cards are always below the pot (drawn first, chips over them rest on top). Resizing a table (fields, scrubbing, or dragging a circle node) keeps its centre in place, so the artwork stays put relative to it; a circle stays a circle. Default offsets: pot -405/-50, burn -357/70, muck -610/-40.
- **Lines and cards fields:** length, gap, thickness and outline width are always in millimetres whatever the unit setting is (labelled), thickness in steps of 0.1 mm.
- **Player-area line defaults:** 200 mm from the edge, 3 mm thick (existing projects keep their values).
- **Lines defaults:** the card lines are 380 mm long, 100 mm apart (gap), 4 mm thick, with the outline on and 3 mm wide; the card size is Poker (existing projects keep their values). Opening or closing a text panel keeps its header at the same screen position; the panels below move.
- **Circle and oval:** a circle preset is round and has a lock for its aspect ratio (on by default): locked it shows Diameter and Radius, unlocked it shows Width (X diameter) and Height (Y diameter) and becomes an oval made of four arcs. Corner radius and chamfer can never go below 0 (chamfer below 1 mm is raised to 1).
- **Layout sheet:** a readable, downloadable marking guide (centre cross, outline key points, guide lines measured from the centre or the outline, check diagonals). Always measure from the centre, never chain.
- **Palette:** named, editable colours (defaults felt green `#0d2b22`, gold `#d4af5a`), one cut layer per colour, flat or shaded preview.
- **Cut export:** boolean union and subtract (Paper.js, loaded from a CDN at runtime; without it shapes are exported overlapping), upper halos hide lower objects, closed non-crossing contours, tolerance 0.01 to 0.05 mm, mirror, rotate 90/180/270, separate X and Y correction factors, calibration, cutter profiles, strips split to cutter width.
- **Constraints:** dimensions as reference or driving constraints, a linear solver for axis-aligned guides (fixed, distance, minimum, maximum, equal spacing, symmetry, ratio), conflict reporting that names the constraints involved.
- **Blender export:** a Python script generated from the project (table outline and rail, cloth texture rendered from the artwork, room sized to the table). The template lives in `blender/src/scene_template.py`.

## Assistant behaviour

Follow the two policies below. They are the maintainer's standing rules for this repository.

# Contradiction First

Be a critical, analytical partner — not a mere executor.

When I ask you to do something:

1. **Evaluate the request first.** Before you start, check for contradictions, ambiguity, hidden assumptions, or goals that fight each other.
2. **Flag it immediately.** If you find a problem, say so directly and concretely — do not soften or skip it. State what conflicts with what, and why it hurts the outcome.
3. **Propose a fix.** Offer a short, clear alternative or a clarifying question that makes the request consistent. Do not wait for permission to point it out.
4. **Execute only after that.** Once the request is clear, or I have confirmed the contradiction as a deliberate choice, do the work carefully.
5. **Do not be a people-pleaser.** Do not praise a weak idea, and do not hide problems behind politeness. Be direct, precise, and useful.

If the request is already clear and consistent, say so briefly and go straight to the work — do not invent problems.
# Language rule

**Everything that goes into the project and its repository must be in English ( with a few exceptions )**, whatever language the conversation with the maintainer is in.

## Default / What must be in English
All content Claude writes to the repository MUST be in English. This covers:
source code, identifiers, code comments, documentation, README files,
commit messages, branch names, PR/MR descriptions, test names, config comments,
and generated reports.

- Source code: identifiers (variables, functions, classes, files, folders), string constants, log messages, error messages and exceptions
- Code comments: inline and block comments, docstrings, JSDoc/KDoc/Javadoc, TODO/FIXME notes
- User-facing text: UI texts, labels, buttons, menus, placeholders, tooltips, notifications, validation messages, empty and error states, in-game text
- Documentation: README, CONTRIBUTING, CHANGELOG, architecture and design documents, ADRs, API docs, setup guides, rule notes
- Configuration and metadata: config file comments, package descriptions, environment variable descriptions
- Tests: test names, descriptions, assertion messages and test data labels
- Data files: data labels, seed data, table and column names, migration descriptions
- Version control: commit messages, branch names, pull request titles and descriptions

## Conversation
- Reply to the maintainer in the language they write in (for example Finnish). This applies to explanations, questions and status updates in the chat.
- Write every project artifact in English, regardless of the chat language.


## Localization

- Do not write Finnish (or any other language) into the UI or code unless the maintainer explicitly asks for localization or i18n support.
- If localization is requested, keep English as the source and default language. Put translations in separate resource files (for example i18n JSON files). Source keys stay in English.

## Preserve user-provided material
- Never translate, rewrite, or "normalize" content the user supplied
  (documents, specs, data files, quoted text, existing files). It keeps its
  original language.
- When editing an existing file, write the new or changed text in the file's
  existing language. Do not convert the file to English.
- When quoting user material inside an English document, keep the quote
  verbatim in the original language and add an English summary if needed.

## Exceptions
Paths listed in `.language-exceptions` (gitignore-style globs) use the
language stated there. Create new content in those paths in that language.
If a task requires new content in a non-English language and the path is not
listed, ask the user once before writing it.

Example `.language-exceptions`:

```
# path-glob  language  note
**/locales/fi/**       fi   Finnish UI strings
**/*.fi.json           fi   Finnish localization
docs/customer/fi/**    fi   Finnish customer-facing docs
```

If the file does not exist, only the default and the preservation rules apply.

## Not covered
Chat replies follow the language the user writes in. This rule applies to
files and repository content only.

## Edge cases
- Proper nouns, product names, legal terms, and domain terms of art
  stay in their original form; add an English gloss on first use in
  English docs.
- If unsure whether a file is user-provided or Claude-generated, check
  `git log` for authorship. If still unclear, treat it as user-provided.

## Consistency check

Before reporting any task as done, verify that no non-English text has slipped into code, comments, docs, UI, data files or commit messages. Fix any such text first.
