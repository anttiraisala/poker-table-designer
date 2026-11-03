# Poker Table Designer

A browser-based design tool for poker tables. It starts with the table cloth: lay out the logo, text, lines and cards in real millimetres, check them against one or more table outlines, and export cut files for a vinyl cutter. Later milestones cover the table structure itself (board, foam, rail).

> **Status: early.** What exists today is the logo editor (Milestone 0). The table, guide, constraint and export features are planned. See [PROGRESS.md](PROGRESS.md).

## Try it

- **Live:** https://anttiraisala.github.io/poker-table-designer/ (GitHub Pages, see "Enabling GitHub Pages" below)
- **Locally:** open `index.html` in a modern desktop browser. There is no build step, no server and no dependencies. Script fonts come from Google Fonts at runtime, so an internet connection is needed for them.

## What the editor does today

- Text objects with 100+ Google script fonts (click the font box and type to filter), size, letter spacing, rotation, opacity, weight, italic, uppercase, colour, gold shading, bigger first letters and an outline that hides what lies beneath.
- Two horizontal lines with a poker hand between them.
- Drag with snapping (hold Alt or Ctrl to move freely), multi-select, marquee selection, clone, undo/redo, visibility, stacking order, zoom, pan and a resizable canvas.
- Copy and apply all settings as JSON. The work is also saved automatically in the browser.

## Enabling GitHub Pages

Repository **Settings** → **Pages** → **Build and deployment** → Source: **Deploy from a branch** → Branch: `master`, folder `/ (root)` → **Save**. The page appears at the address above after about a minute.

## Fonts

Font files are not included in this repository. Google Fonts are loaded at runtime. Third-party font files must not be committed unless their licence allows redistribution.

## Working on the project

- [CLAUDE.md](CLAUDE.md) holds the working rules and design decisions. It is written for AI assistants and is useful for humans too.
- [PROGRESS.md](PROGRESS.md) lists milestones, open work and ideas.
- `scripts/make-artifact.py` converts `index.html` into the format that the Claude Artifact tool expects, so the same code can also run inside a Claude chat.

## License

MIT, see [LICENSE](LICENSE). Third-party fonts keep their own licences.
