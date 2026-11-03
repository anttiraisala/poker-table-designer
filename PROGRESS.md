# Progress

Last updated: 2026-11-03.

## Testing honesty

All code so far was written and syntax-checked (`node --check`) by an AI assistant, with the maintainer trying it in a browser during development. No automated tests exist. Anything marked done below means "implemented and used by the maintainer", not "covered by tests".

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 0 | Logo editor (px units): text layers, Google script fonts, lines with poker hand, drag and snap, multi-select, clone, undo/redo, zoom and pan, settings JSON | Done |
| 1 | Repository, licence, README, CLAUDE.md, GitHub Pages | In progress (this commit) |
| 2 | Phase 1: millimetre model, config and project JSON, palette, font import with source link | Planned |
| 3 | Phase 1: table outlines (N tables), real-cloth toggle, auto guides, snapping, measuring | Planned |
| 4 | Phase 1: layout sheet (marking guide, SVG or PDF download) | Planned |
| 5 | Phase 2: cut export (boolean geometry, mirror, rotate, scale correction, cutter profiles) | Planned |
| 6 | Phase 3: dimension constraints and solver | Planned |
| 7 | Table structure: board, foam, rail, Velcro tape | Planned |

## Done (Milestone 0 details)

- Text objects with 100+ Google script fonts, searchable font picker, size up to 800, letter spacing, rotation, opacity, weight, italic, uppercase, colour, gold gradient, bigger first letters, outline that hides what lies beneath.
- Two horizontal lines with a five-card poker hand, fan, spacing and fit options.
- Dragging with snapping (Alt or Ctrl for free movement), marquee and multi-select, shared edits across a selection, clone, visibility toggle, stacking order.
- Undo and redo, wheel zoom, middle-button and space-drag panning, resizable stage and background.
- Copy all settings as JSON, browser autosave.

## Remaining work

- Everything in milestones 2 to 7.
- Split the single file into modules once the millimetre model lands.
- Browser testing of every feature on several browsers and screen sizes.
- Standalone mode: check that nothing depends on the Claude Artifact host.
- Decide how to handle fonts the maintainer owns but that cannot be redistributed (import from file only).

## Open questions

- Heat transfer vinyl (mirrored cut) or stencil (needs bridges)?
- Cutter model and cutting software, which decides the export format (SVG, DXF, HPGL, PDF).
- Table sizes and shapes to preset.

## Ideas (not necessarily to be implemented)

- Preset table shapes: oval, racetrack, octagon, rectangular with rounded ends.
- Seat markers, dealer button position and betting lines with real dimensions.
- Card and chip placement overlay for checking layout against real chip sizes.
- Multiple cloth layouts compared side by side, with a vote or note per variant.
- Registration marks and a test square for calibrating cutter scale.
- Print tiles for printing at 1:1 on A4 sheets.
- Velcro tape path as offset of the table outline, with length report.
- Import an existing SVG as artwork.
- Raster tracing of logos as a fallback when no font file exists.
- Light theme and touch input support.
- Localisation through separate resource files, only if the maintainer asks.
