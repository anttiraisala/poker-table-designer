# REQUIREMENTS

The idea and requirements list of Poker Table Designer. Everything that is discussed with the maintainer but not yet built is recorded here: what was said, how it could be built, what is still open. It is the input for requirement-driven development: a requirement is built only when the maintainer says so ("implement", "toteuta"), and then it moves to `Built` and gets a milestone row in [PROGRESS.md](PROGRESS.md).

How to use it:

- One entry per requirement, with a stable id (`REQ-001`, never reused or renumbered).
- Status: `Idea` (mentioned), `Discussed` (talked through, open questions remain), `Agreed` (design decided, waiting for the go-ahead), `Built` (done, with the version), `Rejected` (with the reason).
- Each entry has: **Said** (what the maintainer said or decided, close to his words), **Implementation idea** (how it could be built; mine, not decided unless marked), **Open** (questions), **Depends on**.
- Decisions that are already part of the design stay in [CLAUDE.md](CLAUDE.md). This list is for what is not built yet.
- Record an idea here as soon as it has been discussed, even without a go-ahead (this is the one document change allowed during a discussion, see CLAUDE.md). Never change code because of an entry without the go-ahead.

Honesty note: REQ-001 to REQ-003 were written on 2026-11-06 from the summary of an earlier long conversation, not from the original messages. Details may be missing or slightly off; the maintainer is asked to correct them.

## Index

| Id | Title | Status |
|---|---|---|
| REQ-001 | Control points (points with a parent) | Discussed |
| REQ-002 | One-shot alignment in the toolbar | Discussed |
| REQ-003 | Dependency network between points, guides and measurements | Idea |
| REQ-004 | Roll guides: measurement anchors on the edges and use as export frames | Idea |
| REQ-005 | Demo mode (full-window presentation from a link) | Agreed |
| REQ-006 | Measurements, phases 2 to 4 | Agreed |
| REQ-007 | Production pipeline, overlap, packing and press and roll guides | Agreed |

REQ-005 to REQ-007 are already described in detail in CLAUDE.md and PROGRESS.md ("Planned"); they are listed here so that the list is complete. Their text is not copied, to avoid two versions.

## REQ-001 Control points (points with a parent)

Status: Discussed. Nothing is built.

**Said**
- A control point is a point whose position is a plain coordinate relative to its parent (the thing it belongs to), at first.
- Dragging the thing it belongs to changes the offset, so the point stays where the user put it relative to the parent.
- The point does not rotate with its parent (the artwork stays upright anyway).
- For a text, its "box" means the visible ink box (the bounding box of what is really drawn), not the font's line box.
- There is a visible check box for whether the point is shown.
- Ideas for later: a point can be attached to a letter of a text (letter anchor); a scaling check box says whether the point follows the scaling of its parent; later the points, guides and measurements form a network (see REQ-003).
- The maintainer asked for a critical analysis first and said not to implement before the design is clear.

**Implementation idea**
- New object kind `cpoints` in the project (saved, part of the undo snapshots): `{ id, name, parent: {kind, id}, dx, dy, visible }`, with a permanent `uid` like texts have.
- Parent kinds in phase 1: cloth centre, artwork origin, a text (by `uid`, anchored at the centre of its visible ink box), a table (by id, anchored at its centre). Position on the stage = parent anchor + (dx, dy), in millimetres, never rotated.
- Appearance: a small light violet marker (`#c79bff`), drawn above the artwork, never cut or exported, not in the picture, Blender texture or layout sheet.
- Interaction: click empty space to add (parent chosen by the rule under Open), drag the marker to change `dx` and `dy`, nudge with arrow keys (0.1 mm, Shift 1 mm), Delete removes it, a panel in the Guides and measurements tab lists them with numeric fields.
- Other features can use a control point as an anchor (measurements first, since anchors are already named objects), so a measurement can follow a point that follows a text.
- A text uses the same ink box code as the measurement tracing (hidden canvas trace; exact vectors when frozen).
- Phases: 1 points with the parents above and the panel; 2 use as measurement and guide anchors; 3 letter anchors and the scaling flag for non-text parents; 4 the alignment toolbar (REQ-002).

**Open**
- Default parent for a click on empty space: cloth centre or artwork origin.
- What happens to a point when its parent is deleted: stays in the list marked broken (like measurements) is the likely answer.
- Whether the scaling flag also applies to the export scale (probably not: points are never exported).
- Nudge steps and whether the marker needs a name label.

**Depends on:** permanent text ids (done in V54), ink-box tracing (done in V54).

## REQ-002 One-shot alignment in the toolbar

Status: Discussed. Nothing is built.

**Said**
- The maintainer prefers a one-shot alignment with small buttons in the top toolbar (not a separate panel).
- He agreed with the placement after a short discussion ("okay, okay").

**Implementation idea**
- A group of small buttons in the first toolbar row: align left, centre, right, top, middle, bottom and distribute, acting once on the current selection (no lasting constraint is created). One undo step per press.
- Alignment uses the visible ink boxes of texts (as in REQ-001) and the geometry of lines and control points.
- Needs a multi-selection on the stage, which does not exist yet for all object kinds.

**Open**
- Align to what: the first selected object, the selection box, or a chosen reference (guide or control point).
- Whether the buttons act on texts only or also on the card lines and the player-area line.

**Depends on:** REQ-001 (phase 1) for the points; multi-selection.

## REQ-003 Dependency network between points, guides and measurements

Status: Idea. Far in the future.

**Said**
- Later the control points, guides and measurements should form a network, where one thing can be the parent of another.

**Implementation idea**
- A directed graph with cycle checks (the `deps` idea of the skills collection is the same problem: every parent must exist, no cycles). Evaluate in dependency order after every edit, like the guide constraint solver does for guides today.
- Reuse the existing solver for linear constraints between guides where possible.

**Open**
- Everything: only a direction was named. Decide after REQ-001 has been used in practice.

**Depends on:** REQ-001, REQ-002 phase 2.

## REQ-004 Roll guides: measurement anchors on the edges and use as export frames

Status: Idea. Recorded from the V87 notes in CLAUDE.md ("Not built yet").

**Said**
- Roll guides (V87) are built. Not built: measurement anchors on the edges of the band, and roll guides as export frames (for example fitting the output to a roll guide).

**Implementation idea**
- Add the two edges and the centre line of a roll guide as named anchors for measurements (the snap lines already exist in `PTD.guides.lines`).
- In the export tab, a choice "frame: roll guide N" that uses its band as the crop frame and the fit-to-roll width.

**Open:** which roll guide when several exist; how this fits with Fit to roll width of the cutter.

## Moved or listed elsewhere

When the maintainer wants, the "Planned" items of PROGRESS.md (menu tidy-up, EPS later, more examples, players with several visible tables, guided workflow, word packs and others) and the "Ideas" and "Brainstorm" lists can be moved here as numbered entries, one at a time, with their status. Until then they stay where they are.
