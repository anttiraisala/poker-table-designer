# REQUIREMENTS

The idea and requirements list of Poker Table Designer. Everything that is discussed with the maintainer but not yet built is recorded here: what was said, how it could be built, what is still open. It is the input for requirement-driven development: a requirement is built only when the maintainer says so ("implement", "toteuta"), and then it moves to `Built` and gets a milestone row in [PROGRESS.md](PROGRESS.md).

How to use it:

- One entry per requirement, with a stable id (`REQ-001`, never reused or renumbered).
- Status: `Idea` (mentioned), `Discussed` (talked through, open questions remain), `Agreed` (design decided, waiting for the go-ahead), `Built` (done, with the version), `Rejected` (with the reason).
- Each entry has: **Said** (what the maintainer said or decided, close to his words), **Implementation idea** (how it could be built; mine, not decided unless marked), **Open** (questions), **Depends on**.
- Decisions that are already part of the design stay in [CLAUDE.md](CLAUDE.md). This list is for what is not built yet.
- Record an idea here as soon as it has been discussed, even without a go-ahead (this is the one document change allowed during a discussion, see CLAUDE.md). Never change code because of an entry without the go-ahead.

Honesty note: REQ-001 to REQ-003 were first written on 2026-11-06 from the summary of an earlier long conversation, not from the original messages. In a later conversation the same day the maintainer answered the open questions of REQ-001 and REQ-002; those answers are recorded below close to his words (translated from Finnish) and replace the earlier text where they differ. Details can still be slightly off; the maintainer is asked to correct them.

## Index

| Id | Title | Status |
|---|---|---|
| REQ-001 | Control points (points with a parent) | Built (V95), partly |
| REQ-002 | Alignment to a target (one-shot, from the toolbar) | Discussed |
| REQ-003 | Dependency network between points, guides and measurements | Idea |
| REQ-004 | Roll guides: measurement anchors on the edges and use as export frames | Idea |
| REQ-005 | Demo mode (full-window presentation from a link) | Agreed |
| REQ-006 | Measurements, phases 2 to 4 | Agreed |
| REQ-007 | Production pipeline, overlap, packing and press and roll guides | Agreed |
| REQ-008 | Groups of objects | Idea |
| REQ-009 | Drag modifiers: axis lock with Shift and a tidy-up of the modifier keys | Idea |

REQ-005 to REQ-007 are already described in detail in CLAUDE.md and PROGRESS.md ("Planned"); they are listed here so that the list is complete. Their text is not copied, to avoid two versions.

## REQ-001 Control points (points with a parent)

Status: Built in V95 (phases 1 to 3, see PROGRESS.md row 7bm and CLAUDE.md). Not built: a line edge as a parent, letters of a text as anchors, a group as a parent. The decisions below were followed; where the maintainer had not answered, the defaults under Resolved were used.

**Said** (the maintainer's answers of 2026-11-06)
- A control point has a parent and an offset (`dx`, `dy`), a vector in millimetres from the parent's anchor. It exists so that other things can snap to it.
- Dragging the parent moves the point with it. Dragging the point changes `dx` and `dy`.
- The offset vector turns with the rotation of the parent and scales with the size of the parent. Texts can be rotated; a text turns about its position point (`x`, `y`). Rotation and scaling each get a check box on the point (follows rotation, follows scaling). The maintainer left the default of rotation to the assistant ("choose one and we look at how it looks"); proposed default: both follow.
- The whole tree follows: a point also follows its grandparents, and rotation and scale compound through the chain ("everything follows the parent, that is what a parent is for").
- Scale of a text is its font size divided by the font size when the point was made ("if the font size changes, the point scales; nice if you can compute it"). Scale of a table is its width and height divided by the width and height when the point was made, separately for X and Y.
- Parents: the cloth centre (called "world", the one fixed origin), the artwork origin, a text (its position point), a table (its placement point `x`, `y`, the same point the measurements call "table centre", also for free outlines), and another control point. Chains of points are allowed.
- A control point can also be put on the edge of a line: the inner or the outer edge of a thick line, half the thickness from the centre line (the anchors the measurements already use), so it follows a change of thickness. With a second control point at the corner of a box this lets objects be placed touching each other. (Maintainer, 2026-11-06, in the alignment discussion.)
- A new point is made with its own tool. Clicking a text makes that text the parent; clicking empty space makes the artwork origin the parent.
- Things snap to control points: texts, guides, measurements and other control points ("everything can snap to them"). When a point is dragged onto a snap target, that target becomes its parent (offset 0). A drag that ends on no snap target, or with snapping switched off (Alt or Ctrl, as everywhere), keeps the parent and changes the offset. The panel has number fields for the offset (the maintainer: "at least the sliders"). Two points on top of each other are avoided by giving the child an offset.
- Circular dependencies must not be possible. Snapping onto a descendant is refused. If a cycle appears anyway (for example from an imported file), it is broken and a warning about a circular dependency is shown.
- Deleting a parent: the children stay where they are on the cloth; their parent becomes the cloth centre and the offset becomes their absolute position.
- Points on a text that a style hides (Split, Monogram) stay with the hidden text and come back with "Back to my own texts" ("let us try whether they follow the hiding").
- The layout sheet lists the position from the cloth centre plus the offset from the parent, with the name of the parent.
- A visible check box says whether a point is shown. Colour: light violet `#c79bff` (not used elsewhere in `js` or `css` on 2026-11-06).
- The maintainer asked for a critical analysis first and said not to implement before the design is clear.

**Implementation idea** (the assistant's; not decided unless it follows from Said)
- New object kind `cpoints` in the project (saved, part of the undo snapshots): `{ id, uid, name, parent: {kind, id}, dx, dy, visible, followRot, followScale, ref }`, where `ref` holds the size of the parent when the point was made (font size for a text, width and height for a table).
- Position on the stage = parent anchor + rotation of the parent applied to (scale applied to (`dx`, `dy`)). Scale is applied in the parent's own axes before the rotation, so a stretched, turned table works. The parent chain is evaluated parent first, like the guide solver orders guides; the chain is checked for cycles when a parent is set and when a project is loaded.
- Appearance: small violet marker drawn above the artwork, never cut or exported, not in the picture, Blender texture or layout sheet picture. The layout sheet lists the points as text (see Said).
- Snapping: control points join the named snap points (`PTD.guides.lines` and the measurement anchors already work this way), so measurements can use a control point as an anchor. A point that is hidden or broken is not a snap target.
- Interaction: own tool in the toolbar (Esc returns to Select as in V90), drag to move, arrow keys to nudge (the same steps as for other objects, 1 mm and Shift 10 mm today; Alt 0.1 mm is proposed), Delete removes, panel in the Guides and measurements tab with a list and number fields.
- Randomizer: rounds that only change fonts, sizes and places keep the texts, so their points follow. Where the randomizer replaces texts (change the words, Create casino), see Open.
- Phases: 1 the points with the parents above, the tool, the panel, rotation and scaling; 2 snapping to points and re-parenting by snapping; 3 use as anchors for measurements and guides; 4 letter anchors on a text (later idea, no design).

**Resolved in V95** (defaults are marked; the maintainer can change them)
- Texts that the randomizer itself replaces take their points with them (the maintainer: "they can vanish"). Points on a text or table that the user deletes stay where they are and hang on the cloth centre. Points on a text that a style only hides stay with it (they are hidden with it and come back).
- A point on a hidden text or hidden table is hidden with it (default); it is not a snap point, but it still has a place, so measurements keep working.
- The scale reference of a free-outline table is the bounding box of the outline (default). When "follows scaling" or "follows rotation" is switched on again, the reference is taken again at that moment and the point stays where it is.
- Arrow keys nudge a point 1 mm, Shift 10 mm, Alt 0.1 mm, like other objects (Alt is new).
- Partial files (artwork only, tables only) do not carry control points.

**Open**
- A control point on the edge of a line (the inner or outer edge of a thick line, half the thickness from the centre line; the anchors the measurements use). Not built.
- Letters of a text as anchors (phase 4). No design yet.
- A group as a parent (REQ-008).

**Depends on:** permanent text ids (done in V54), ink-box tracing (done in V54; not needed now that the text anchor is its position point), measurement anchors that are named objects (done).

## REQ-002 Alignment to a target (one-shot, from the toolbar)

Status: Discussed. The maintainer's design is complete (2026-11-06, one long dictation); the assistant's critical review and counter-proposal below are not answered yet. Nothing is built.

**Said** (maintainer, 2026-11-06, translated from Finnish and shortened)
- One-shot alignment started from the toolbar (not a separate panel); no lasting constraint is made; everything that can be selected can be aligned; alignment moves objects.
- Step 1, the target: select one or more objects by clicking or by dragging an area; Shift adds (a small plus appears next to the cursor) and Ctrl removes (a small minus). Then press a button with a crosshair icon (a cross and a circle; tooltip "Set alignment target"). A brightly coloured box or symbol shows the target. The target stays until it is cleared, so several alignments can follow.
- The target can be the bounding box of a selection, a single point, a horizontal or vertical line, a line at any angle, an arc or any line-like object, or the crossing of two lines (then a temporary control point is made that disappears after the alignment).
- Step 2, the "alignee selection" (the objects to be aligned): chosen the same way (click or area, Shift adds, Ctrl removes). It acts as one group by default and has a bounding box. A single point alignee has only its centre point.
- The box has control points: one at every corner, one in the middle of every side and one at the centre of the whole (the maintainer: "let us start with these; there could be more"). Each is a square of about cursor size that is easy to hit. Zooming with the wheel and panning with Space do not change the selections; when the points are too close, zoom in.
- When the pointer is near a control point of the alignee box, an arrow is drawn from that point to where it would go, and the objects show a ghost image at the destination whose visibility pulses up and down. Clicking the control point moves the objects there, as a group.
- Destination for a line or arc target: straight towards it (the arrow ends on the nearest point of the line or arc). Destination for a point target: the point itself; the maintainer wants up to three arrows depending on where the pointer is on the control point: direct to the point, a horizontal move only, or a vertical move only (the coordinate of the point). Destination for a box target: the same control point of the target box as the one on the alignee box (top left to top left and so on), with the same arrows and ghosts.
- With Alt held, every selected object is moved by itself: from the corresponding control point (for example the top left) of each object an arrow goes straight to the target and each object has its own ghost; they can end up on different sides of a line.
- Dragging (the maintainer, a later message on 2026-11-06): with the pointer near a control point of the alignee box the arrows show where it would go; with the pointer on the control point and the button pressed, the control point can be dragged onto control points of the target. With Alt held every object is dragged the same way to the same place. While dragging, the arrow keeps showing where the objects would go and the ghosts show how it would look if the button were released. He asked to check that this works in all combinations.
- Decided (2026-11-06): a drag that is released on nothing is cancelled and the objects jump back to where they started; the maintainer can then try again by clicking or dragging differently. The edges and the centre lines of a box are infinite drop lines.
- Decided (2026-11-06): a click on a control point without movement (under about four pixels) moves the objects to the destination that the hover preview showed: the point with the same name for a box target, the nearest point for a line or arc, the point itself for a point target.
- The rule "Shift adds, Ctrl removes" is meant for selecting in general, not only for alignment.
- Selecting is strict everywhere: Shift only adds, Ctrl only removes, for single clicks and for areas ("it must always be so in the selection"). Shift while dragging an object (axis lock, REQ-009) is a different thing from Shift while dragging an area on empty space; the pointer position tells which.
- Crossing of two lines as a target: first select two shapes that cross; when the pointer moves near their crossing, a clickable intersection point appears; clicking it clears the other selection and leaves that point as the selection.
- Alignees are texts, the card lines as one object and control points. The player-area line cannot be an alignee because it cannot be moved (maybe later). Targets can be anything selectable except the table objects (pot, burn cards, muck, players), which are neither targets nor alignees (corrected the same day; first he said they could be targets). He first said "all the others" can be both target and alignee, then asked whether moving a table makes sense, since everything of a table moves with its centre and it could only move relative to other tables, and allowed it for comparing several overlapping tables. Not decided, see Open.
- Quick buttons and distribute: the assistant decides them ("make a clever choice yourself") and they are built together with the rest. They sit in a menu in the toolbar that opens when the pointer is over it (and by click), with Set alignment target first and the quick buttons after it. The buttons are visible all the time and do nothing when there is nothing to align.
- The hand, pot, burn cards and muck move with the card lines because their positions are relative to the lines.
- Decided (2026-11-06): no line thickness is taken into account in the first version. Boxes and points are the geometry as it is (centre lines). The thickness idea is kept under Deferred below.
- Decided: the box of the card lines contains the lines and the hand; pot, burn cards and muck move along with the lines but are not in the box.
- The maintainer called the assistant's defaults good ("these are good defaults"). Read as accepting, until corrected: the zones for the three variants, the normal selection as the alignee selection, and fewer control points on a small box (see Open).
- The individual mode is Alt held down, as described; the maintainer does not want a separate switch ("I want it to work just as I explained").

**Implementation idea** (the assistant's counter-proposal; not decided)
- Keep the model and add the following.
  1. Drag a control point of the alignee box (press on it and move). The destination is the target point, or the nearest point of a target line, under the pointer; an arrow runs from the control point to it and ghosts show the result. Releasing applies it; Esc, or releasing on nothing, cancels. A click without movement uses the default destination of the hover preview: the point with the same name for a box target, the nearest point for a line or arc, the point itself for a point target. Drop points: the nine points of a box, the point itself, the ends, middle, centre and quadrants of a line or arc (the named snap points the program already has). Drop lines, acting as infinite lines: the four edges and the two centre lines of a box, the horizontal and vertical line through a point, and a line or arc itself. Dropping on a point puts the control point exactly there; dropping on a line puts it on the nearest point of the line, which for a vertical or horizontal line is a move along one axis only. This gives "align left edges" (drop on the left edge line), "align centres" and touching (drop on the other side of the target) without zones around the small control point and without a key. The earlier ideas of zones around the control point and of the Tab key are dropped.
  2. Align mode is on while a target exists. The alignee selection is the normal selection. The control points of the alignee box show only in this mode. Esc or the crosshair button clears the target and leaves the mode.
  3. Fewer control points when the box is small on the screen: below about 40 px on a side only the corners and the centre, below about 16 px only the centre, so that a hover is never ambiguous.
  4. Target kinds from existing machinery: a selection box; a line or arc object; a named snap point (the program already has node, middle, centre, crossing, quadrant, perpendicular, tangent) chosen by clicking, which also covers the crossing of two lines without a separate temporary object; a control point of REQ-001.
  5. The nearest point on a line or arc reuses the measurement code (nearest and perpendicular anchors).
  6. A status line names the active variant ("align X only", "align Y only", "move to point", "each object").
  7. Individual mode with a point target and the direct variant stacks all objects on one point; the ghosts show it and it is allowed.
  8. One-click buttons (left, centre, right, top, middle, bottom) that align the selection to its own selection box, as a shortcut, because the target model needs five steps for the plain case of two texts.
  9. Phases: 1 target, nine control points, arrows and ghosts, group mode, targets box, point and line; 2 Alt individual mode and the three variants everywhere; 3 arcs, snap-point targets, crossings and curved outlines; 4 shortcut buttons and distribute.
- Quick buttons (the assistant's choice): align left, centre, right, top, middle, bottom, and distribute horizontally and vertically (equal gaps between the boxes, at least three objects, the outermost two stay). Without a target they move every object by itself against the selection box (group mode would do nothing there). With a target the default is group mode (the box of the selection goes to the target) and Alt holds each object separately. A target with no extent along an axis (a vertical line has no vertical extent) leaves that axis alone and the status line says so. A button that cannot act says why in its tooltip and status line (the rule of CLAUDE.md that every disabled button says why).
- Touching: drop a control point on the opposite side of the target (for example the left-middle point of the alignee on the right-middle point or the right edge line of the target). The "next to" quick buttons (left of, right of, above, below, with a gap field, default 0) stay as an optional shortcut.
- A lasting relationship (it follows when the thickness changes) is made with a control point on a line edge (REQ-001). Alignment is one-shot and does not follow later changes.
- Objects with a parent (REQ-001): aligning a control point changes its offset; aligning a parent moves its children; the parent moves first and the boxes of its children are computed again. Locked guides do not move and the message says so. One undo step per click.
- The ghost is a semi-transparent copy of the objects; its pulsing is a CSS animation (not redrawn every frame) and respects the reduced-motion setting.

**Deferred (thought out, not to be built yet; the maintainer asked for it to be kept here)**
- Line thickness in alignment. Idea: when a target is set, a small symbol appears near the target; clicking one or the other of two choices makes the target count the thickness of its lines or not. The same kind of choice could exist for the alignee selection, and the shape of the control point or pointer could change with how far the pointer is from the control point (details not given).
- Assistant's notes for it: a box that includes the visible thickness has the same centre as the centre line for a symmetric line, so only edge alignment would change; touching lines need different handles on the target and the alignee (see the "next to" buttons); a lasting relationship that follows the thickness is a control point on a line edge (REQ-001).

**Open**
- Still to confirm: pressing or releasing Alt during a drag switches between group and each object (the ghosts update); the wheel zooms during a drag; whether Space (pan) also works then.
- Consequence of the strict rule (decided): a click with Ctrl on a selected object removes it, but a press with Ctrl followed by movement is a drag without snapping (REQ-009); the program tells them apart by whether the pointer moved a few pixels. The same for Shift (click adds, press and move is the axis-locked drag). Cmd counts as Ctrl on a Mac.
- Whether the alignee selection is the normal selection or a separate one made after the target is set.
- Extra control points (thirds, the anchor of a text) and the small-box rule above.
- Tables as alignees: reason for, comparing several overlapping tables (line them up by centre or edge while the artwork stays in place); reason against, "what for?" when there is one table. The assistant's default: allowed (the whole table moves, as with its placement fields), guides allowed (a locked one refuses). To confirm.
- Line-like targets (one guide, the player-area line, a table outline): the nearest point on the line, or its bounding box? Default: one guide or the player-area line selected alone is a line target; a table, or several objects, is a box target.
- Touch and tablets: the hover preview is not possible; the README says touch is not supported.

**Depends on:** multi-selection for all object kinds and a bounding box for each kind (area selection with Shift, Ctrl or Cmd exists today); REQ-001 for control points; REQ-009 (modifier keys); REQ-008 (the group mode is a temporary group).

## REQ-003 Dependency network between points, guides and measurements

Status: Idea. Far in the future.

**Said**
- Later the control points, guides and measurements should form a network, where one thing can be the parent of another.
- 2026-11-06: chains of control points, re-parenting by snapping and refusing cycles were decided as part of REQ-001. What stays here is the network that also contains guides and measurements as parents and children.

**Implementation idea**
- A directed graph with cycle checks (the `deps` idea of the skills collection is the same problem: every parent must exist, no cycles). Evaluate in dependency order after every edit, like the guide constraint solver does for guides today.
- Reuse the existing solver for linear constraints between guides where possible.

**Open**
- Everything: only a direction was named. Decide after REQ-001 has been used in practice.

**Depends on:** REQ-001 (phase 3).

## REQ-004 Roll guides: measurement anchors on the edges and use as export frames

Status: Idea. Recorded from the V87 notes in CLAUDE.md ("Not built yet").

**Said**
- Roll guides (V87) are built. Not built: measurement anchors on the edges of the band, and roll guides as export frames (for example fitting the output to a roll guide).

**Implementation idea**
- Add the two edges and the centre line of a roll guide as named anchors for measurements (the snap lines already exist in `PTD.guides.lines`).
- In the export tab, a choice "frame: roll guide N" that uses its band as the crop frame and the fit-to-roll width.

**Open:** which roll guide when several exist; how this fits with Fit to roll width of the cutter.

## REQ-008 Groups of objects

Status: Idea. Only named; not discussed further.

**Said**
- The maintainer wants to make groups of objects ("I could make groups of things") and said a multi-selection acts like one object, which is what the second kind of alignment in REQ-002 needs. In the conversation he called this "requirement 3"; its id is REQ-008 because ids are never reused and REQ-003 already exists.

**Implementation idea**
- A group is a named list of object references (texts, lines, control points, guides) saved in the project and part of the undo snapshots. Moving, aligning, hiding and locking act on the whole group. A group could also be a parent for control points.

**Open**
- What can be in a group; whether groups can be nested; where the anchor of a group is (for rotation, scaling and as a parent).
- Whether a click selects the group or the object, and how to enter a group.
- Whether groups can be rotated and scaled, and how the randomizer treats grouped texts.
- Relation to REQ-001 (a group as a parent) and REQ-002 (the second kind of alignment).

**Depends on:** multi-selection for all object kinds.

## REQ-009 Drag modifiers: axis lock with Shift and a tidy-up of the modifier keys

Status: Idea. Raised by the maintainer on 2026-11-06 while discussing REQ-002.

**Said**
- Selecting (decided 2026-11-06 in the alignment discussion): Shift only adds and Ctrl only removes, with a small plus or minus next to the cursor, for single clicks and for areas. This replaces today's toggle by Shift, Ctrl or Cmd.
- In some programs, holding Shift while an object is moved locks the move to the horizontal or the vertical axis; Ctrl switches snapping off. The maintainer asked how the modifier keys work in other programs and in this one and what a sensible mapping would be.

**Current state of the program (checked in the source on 2026-11-06)**
- Click on an object with Shift, Ctrl or Cmd toggles it in the selection; a rubber band with them adds to the selection.
- Dragging an object, a guide, a table node or a measurement point with Alt or Ctrl held ignores snapping (Cmd is not included, and Ctrl-click is a right click on a Mac).
- Scrubbing a number field: Shift coarser (ten times), Alt finer (a tenth). Arrow keys move the selection 1 mm, with Shift 10 mm. Ctrl or Cmd with Z undoes and with Shift redoes, Ctrl or Cmd with S saves. Space or the right button pans.
- Shift while dragging does nothing yet.

**Implementation idea**
- A common rule across the program: Shift means bigger or constrained, Alt means finer or no snapping, Ctrl or Cmd means add to the selection.
- Shift while dragging locks the move to the axis in which the pointer has moved more, measured from the start of the drag; snapping still works along the locked axis. The selection toggle on a Shift press has to happen on release without movement (as in common drawing programs), otherwise Shift cannot start a drag.
- Arrow keys: Alt 0.1 mm as an addition to the existing 1 mm and Shift 10 mm.
- Optional tidy-up: Ctrl or Cmd stops meaning "no snap" (Alt only, Cmd included), because it also means selection; this changes an existing behaviour and needs a decision.

**Open**
- Whether Alt-drag should duplicate (as in some programs); it collides with Alt as "no snap", so the assistant proposes not to.
- Whether the Ctrl "no snap" is kept as it is.
- Whether the axis lock also applies to guides (already one axis), table nodes and measurement end points.

**Depends on:** nothing.

## Moved or listed elsewhere

When the maintainer wants, the "Planned" items of PROGRESS.md (menu tidy-up, EPS later, more examples, players with several visible tables, guided workflow, word packs and others) and the "Ideas" and "Brainstorm" lists can be moved here as numbered entries, one at a time, with their status. Until then they stay where they are.
