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
| REQ-002 | Alignment to a target (one-shot, from the toolbar) | Built (V96), partly |
| REQ-003 | Dependency network between points, guides and measurements | Idea |
| REQ-004 | Roll guides: measurement anchors on the edges and use as export frames | Idea |
| REQ-005 | Demo mode (full-window presentation from a link) | Agreed |
| REQ-006 | Measurements, phases 2 to 4 | Agreed |
| REQ-007 | Production pipeline, overlap, packing and press and roll guides | Agreed |
| REQ-008 | Groups of objects | Built (V103), partly |
| REQ-009 | Drag modifiers: axis lock with Shift and a tidy-up of the modifier keys | Idea |
| REQ-010 | Font preview with the arrow keys in the font list | Built (V98) |
| REQ-011 | Text size: the arrows of the number field change it by 0.5 mm | Built (V98) |
| REQ-012 | Font preview without the flash of a fallback font | Built (V99) |
| REQ-013 | Resize handles on a selected text (font size by dragging) | Built (V99) |
| REQ-014 | Operation hint line: what is happening and which extra keys work | Built (V99) |
| REQ-015 | CAD-style aids to consider (assistant's proposals from a comparison with CAD programs) | Idea, partly moved to REQ-016 to REQ-018 |
| REQ-016 | Rotation handle for texts | Agreed, to be built later |
| REQ-017 | Live readout next to the pointer during a drag | Built (V99) |
| REQ-018 | Settings: on/off options (true or false) | Built (V99) |
| REQ-019 | Shortcut F: jump to the font of the selected text and open the font list | Built (V99) |
| REQ-020 | The font list in alphabetical order | Discussed |
| REQ-021 | Load the fonts in the background after the start | Idea, kept on the list, not to be built |
| REQ-022 | Align: placement zones around the target box | Built (V100) |
| REQ-023 | Delete key: delete or hide the selection | Built (V100) |
| REQ-024 | Lock any element | Built (V100) |
| REQ-025 | The panel of a clicked text opens and scrolls into view | Built (V100) |
| REQ-026 | Shortcut S: jump to the size of the selected text | Built (V100) |
| REQ-027 | Delete and the things that hang on it: all of them, or Alt for only this one | Built (V100) |
| REQ-028 | Right-click context menu: font, size, clone, clone to cursor, delete; Ctrl+D | Built (V100) |
| REQ-029 | Rename the repository (20 name suggestions, none chosen) | Idea |
| REQ-030 | Housekeeping decisions waiting for the maintainer (red tests, stale PROGRESS lines, RDD skill files, stale start of other chats, push method) | Idea |
| REQ-031 | Split a multi-word text into one text per word (with Keep the original) | Built (V102) |
| REQ-032 | Join several texts into one, in selection order (with Keep the original) | Built (V102) |
| REQ-033 | Glyph: a single-colour vector picture as an artwork element (move, scale, turn, outline, group) | Built in V105 |
| REQ-034 | SVG copy and paste in and out for glyphs (and a JSON window part) | Built in V105 |
| REQ-035 | Vectorising engine: bitmap to smooth glyph shape (no user interface) | Built in V105 |
| REQ-036 | Glyph editor window: image import, effect stack with automatic defaults, live vector preview | Built in V105 |
| REQ-037 | Arrow keys change a focused slider (all sliders of the program), not the artwork behind it | Discussed |
| REQ-038 | Glyph editor: show clearly what is inside and what is outside (preview presets, highlight with moving stripes, help text) | Built in V106 |
| REQ-039 | The box of a text ends at its last letter (no empty trailing letter space in selection, handles, alignment) | Built in V106 (phase 1) |
| REQ-040 | Keyboard shortcut for hide / unhide of the selection H hides or shows the selection (the first one decides), Shift+H shows everything hidden; not Ctrl+H, the browser's History | Built in V109 |
| REQ-041 | A text is centred exactly on Centre X when the letter space changes (no drift of half a letter space); old projects keep the old centring until a per-text tick is set | Built in V109 |
| REQ-042 | Clicking selects what is under the pointer by its drawn pixels or lines first (ink, outline, stroke), not by the bounding box | Discussed |
| REQ-043 | Carry bag designer: a tube bag sized for the rolled cloth with 10 mm foam, straps, fabric pattern and shopping list (far future) | Idea |
| REQ-044 | Procedural glyphs: artwork whose shape is computed from parameters and from guides, table outlines and sizes (growth along an edge, interlacing bands, corner ornaments that reflow) | Idea |
| REQ-045 | Right-click menu: Bring to front, Bring forward, Send backward, Send to back | Built in V112 |
| REQ-046 | Path object: an invisible open or closed path (circle, polygon, lines with rounded nodes, or a reference to a table outline / player-area line), parametrised 0 to 1 | Built (V113; Bezier nodes and dragging nodes on the stage not built) |
| REQ-047 | Pattern element: a stack of procedural generators (line, sine wave, running dog, interlace, branches) along a path, with one halo for the whole stack | Built (V113: line, sine, running dog, interlace; branches/seed not built) |
| REQ-048 | Path from objects: a path that follows the outer edge of selected objects (a group, texts, glyphs, even a pattern element), kept up to date, with a choice to respect their halo or to detach | Built (V113) |
| REQ-049 | Procedural graph: ONE node graph for the whole project (typed ports: path, shape), evaluated with a cache; each output node is a layer of the artwork; replaces the V113 stack and the global path list | Built (V115) |
| REQ-050 | Node library: sources (circle, polygon, lines, table line, outline of objects), path modifiers, Stroke, generators (sine, running dog, interlace and braid, foliage with a seed), booleans, Offset, Negate with a universe | Built (V115) |
| REQ-051 | Exposed parameters: a node parameter can be pinned so that it shows in the panel of the layer without opening the graph | Built (V115) |
| REQ-052 | Node editor: a canvas for the graph (add, move, wire, delete, preview a node, filter to the selected layer) | Built (V115) |
| REQ-053 | Splitter between the stage and the side panel: drag it to give the panels more room (and the node editor); independent of the graph, can be built first | Built (V114) |
| REQ-054 | Dockable work areas: the window is divided into panes (stage, side panel, hint line, and later the graph editor) with draggable splitters in both directions, like the editors people know; the graph editor opens in a pane of its own | Built (V114, level 2) |

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

Status: Built in V96 and V97 (see PROGRESS.md rows 7bn and 7bo and CLAUDE.md). Built: the target (box, point, guide line, crossing of two guides), the align mode with its own selection, nine handles, arrows and ghosts, a click and a drag onto points and endless lines, cancel on nothing, Alt for each object by itself, the quick buttons and distribute. Not built: oblique lines, arcs of outlines and card lines as line-like targets, snap points as targets, a clickable crossing of any two shapes (only two guides), real copies as ghosts (the ghosts are boxes), the strict Shift and Ctrl rule outside the align mode (REQ-009), a gap field for the next-to buttons, the line thickness choice (deferred). V97 added the next-to buttons, the player-area line as a curve target, the plus and minus next to the pointer and the dynamic tooltips, and fixed the thickness in the box of the lines and cards. The maintainer told the assistant to decide the open points itself ("be bold, do not ask"); the choices are in CLAUDE.md.

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
- 2026-11-07 (said while REQ-027, Delete and what hangs on it, was discussed; from the reconstruction file, translated from Finnish): the maintainer asked whether measurements and guides can have parents too and answered himself that measurements can ("measurements can, no, they cannot... okay, measurements can"); he also asked whether that would cause a contradiction. Today a measurement is attached to named objects (anchors) and a guide to the cloth centre or a table edge, but neither is a parent of anything, so the Delete cascade of REQ-027 only follows control points. When REQ-003 is built, the cascade has to follow guides and measurements as parents as well.

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

Status: Built in V103, partly (the maintainer, 2026-11-07: "groups are not flat, a group can hold groups", then "toteuta"). Built as in the design below with these changes: groups nest (up to 8 levels); the lines and cards are not a member yet (only texts); the eye and lock of a group row set the eye and lock of all its texts (no group-level flag); the "double-click" is a second press within 450 ms that ends without a drag; the Turn by field is there but the rotation handle waits for REQ-016. Not built: the lines and cards as a member, control points and guides as members, a group as a parent of control points, a rotation handle.

**Said**
- Earlier: the maintainer wants to make groups of objects and said a multi-selection acts like one object (the second kind of alignment in REQ-002 needs it). Its id is REQ-008 because ids are never reused.
- 2026-11-07: he has several selected elements and wants to move and scale them together. The roll must show the members indented under the group. A group has a name; with texts in it the name can come from them, otherwise the assistant invents one. Groups can be created and dissolved; one member can be taken out or one added. A group behaves like one bounding-box element. He asked for a careful design, researched, and said that assumptions are for the assistant to make. Build only after he approves.

**Design (proposal)**
- Model: the transform is baked into the members (as Inkscape and Illustrator do on group and ungroup). A group stores only its membership; moving, scaling or turning it changes the `x`, `y`, `size`, `ls` and `rot` of every member directly. Texts are closed under similarity transforms (move, uniform scale, turn), so this is exact; no group frame, no nested coordinates. Control points and measurements follow because they hang on text uids. Ungroup loses nothing.
- Data: `artwork.groups` = list of `{ uid, name, nameAuto, locked, hidden, open }`; a layer gets `group: <uid>` or none. Members are contiguous in the stack (grouping gathers them at the place of the topmost member, keeping their order); the lines and cards can be a member too. Old files have no groups. A group with fewer than two members dissolves itself (said in the message). Flat: no group inside a group in this version (grouping groups merges them); the data has room for a `parent` later.
- Not groupable: texts generated by a name style (`gen`), which are replaced when the style changes. Name-word texts can be grouped.
- Selection: a group selected is simply all its members selected plus a "selected as group" flag, so drag, nudge, align, delete and clone work as they do for any multi-selection. A click on a member (canvas or marquee) selects its whole group; Shift+click toggles whole groups; double-click (or a click on the member's row in the roll) selects the member alone; Esc leaves it.
- Box and handles: the group box is the axis-aligned union of the member bounds (`unionOf`). It gets the eight scale handles of REQ-013 (uniform scale about the opposite corner, Shift = about the centre; size and letter space scale together). The same handles appear for any multi-selection of two or more texts, so a group is a saved selection with a name. Turning (about the box centre) comes with REQ-016. The group panel has X, Y, Width and Height (editing one scales uniformly) and a "Turn by" field. Texts that are frozen (outlines) can move but not scale or turn; a group that contains the lines and cards cannot turn; the button says why.
- Roll: the group row has a chevron (collapse), the name (click to rename), eye, lock, Select, Ungroup. Member panels sit indented with a line on the left. Move up and down moves the whole group; inside a group it moves a member within the group only. "Take out of group" puts the member directly above the group; "Add to group" (menu list of groups) puts the selection into a group, below its topmost member.
- Name: automatic from the texts in the roll order joined with a space, cut at about 24 characters with "…"; "Group 1", "Group 2" when no text. It follows the membership until renamed (`nameAuto` off).
- Lock and hide: a locked group cannot be moved or changed as a group; members keep their own lock; a locked member still follows when its group moves (the rule of REQ-024). Hide hides all members. Delete on a group deletes all members (with the REQ-027 rule for control points).
- Clone, Split, Join: Ctrl+D on a group makes a new group of clones. Split keeps the pieces in the group of the original; Join keeps the result in the group of the first text.
- Randomizer: group members are left alone, like locked texts.
- Keys and buttons: Ctrl+G group, Ctrl+Shift+G ungroup; toolbar buttons Group and Ungroup next to Join; right-click menu Group, Ungroup, Take out of group, Add to group.
- Undo: one step per operation. Tests: new `tests/e2e-groups.js`.

**Assumptions made by the assistant (the maintainer may change any)**
- Baked transforms, no groups for generated texts, uniform scale only, a second press to go one level into a group.

**Open**
- Whether control points and guides may be members (proposal: no; a point can hang on a text in the group).

**Depends on:** REQ-013 (handles), REQ-016 (turning), REQ-024 (lock), REQ-025, REQ-028. Related: REQ-002, REQ-031, REQ-032.

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

## REQ-010 Font preview with the arrow keys in the font list

Status: Built in V98 (see PROGRESS.md row 7bp and CLAUDE.md). Design decided with the maintainer on 2026-11-07. Added while building: a click on the font field reopens the list when it still has the focus after Enter or Esc closed it; frozen texts are skipped when the font changes (also for Enter and typing). Changed afterwards in V99: REQ-012 (no flash of a fallback font) and REQ-019 (the field loses the focus after Enter, a click on a row and Esc; the click on a focused field that reopens the list is still there but rarely needed).

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- When a text is selected and the font combo box is open, the up and down arrow keys change the font of the text at once, so that the maintainer sees how the text looks.
- Enter, or a click somewhere else, takes the shown font into use. Esc restores the font the text had before the list was opened.
- The preview starts only when the maintainer has clicked the font list open: that click shows that he means to change the font. Pointing at a row with the mouse (hover) must not preview anything.
- With several elements selected, the font changes only for the texts; other selected objects are not affected.
- A click elsewhere may take a font into use by accident. That is accepted: Undo brings the earlier font back.
- While the list is open, a short hint under the font menu says what the arrow keys, Esc and Enter or a click elsewhere do and how the user takes the font into use. It is shown only while the list is open.

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- The font field is a custom combo box (input with `role="combobox"` and a button, `data-fontinput` in `js/app.js`), so the preview can be built on it. The arrow keys move through the list (the filtered list if the user has typed) and apply the font to the selected texts without an undo step and without an autosave.
- Remember the original font of every text that is changed, so that Esc restores each one. Enter or a click elsewhere commits one undo step for all of them; when the click selects another text, the font is committed to the first selection before the selection changes. After Enter, Esc changes nothing; Undo does.
- Esc has other jobs (end the tool, return to Select; V90). The first Esc only restores the font and closes the list; the next Esc works as before.
- Google fonts load over the network on first use. Load with a short delay or show the font when it is loaded, and show the loading state in the font status line (`fstat`). Frozen texts are already disabled (their font field is `disabled`).
- The hint is English text under the combo box; a normal tooltip is added to `FT` in `js/help.js`, and `tests/e2e-help.js` covers it. A new test covers the preview, Esc, Enter, a click elsewhere, Undo and several selected texts.
- Possible side effects to check: traced text outlines for measurements are redone on every preview step; the randomizer must not change fonts while the list is open.

**Open**
- Whether the preview should be the same for the favourite font chips (the assistant's default: no, a chip click takes the font into use at once as today).

**Depends on:** nothing.

## REQ-011 Text size: the arrows of the number field change it by 0.5 mm

Status: Built in V98 (see PROGRESS.md row 7bp and CLAUDE.md). Added while building: the sideways drag now works on the number field instead of the slider next to it, and keeps the decimals the field started with. The maintainer asked for an explanation in the assistant's own words and said explicitly that no critical view was wanted for this entry.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- When the size of a text is changed, the slider (the ball) changes it in steps of 1 mm.
- The number field next to the slider has small arrows. Clicking the arrows changes the size by 0.5 mm at a time.
- Dragging the number (scrubbing the millimetre value sideways) changes it 1 mm at a time.

**Current state of the program** (checked in the source on 2026-11-07)
- The size field of a text is made by `H.pair("Size (mm)", sc, "size", 5, 800, 1, 1, 3000)` in `js/app.js`: a slider (5 to 800) and a number field (1 to 3000), both with step 1.
- Scrubbing reads the step from the `step` attribute of the number field (Shift ten times, Alt a tenth), so the scrub step follows the field's step.

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- The number field of the text size gets step 0.5, so its arrows change the size by 0.5 mm. The slider keeps step 1.
- Scrubbing must keep 1 mm for this field, so the scrub step has to come from somewhere other than the `step` attribute (for example an optional `data-scrub` attribute that falls back to `step`). Shift and Alt keep their multipliers on the scrub step.
- A test checks the three steps (slider 1, arrows 0.5, scrub 1) and the tooltips in `FT` (`js/help.js`) say the same.

**Open**
- Whether the same arrow step should apply to other size fields that use `H.pair`; the Said text only concerns the size of a text.

**Depends on:** nothing.

## REQ-012 Font preview without the flash of a fallback font

Status: Built in V99 (see PROGRESS.md row 7bq and CLAUDE.md). It refines REQ-010. Built as proposed: the stage keeps the font that was on the screen until the new one is ready, no timer; the neighbour prefetch was not built.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- With the font list open, when an arrow key changes the font, the text often first flashes in another font and only then shows the chosen font. The flash should go away.

**Cause** (found in the source on 2026-11-07)
- `previewFont` in `js/app.js` sets `font` on the texts and redraws at once. A Google font that has not been used yet is not loaded: `PTD.fonts.load` starts 150 ms later, and until the file has arrived the stage draws the text with the browser's fallback font (`display=swap`). When the file arrives, `afterFont` redraws and the real font appears. The flash is that fallback.

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- While a previewed font is not ready (`PTD.fonts.status` is empty or `loading`), the stage keeps drawing the font that was shown before; the model already holds the new name, so Enter and Esc work as now. The stage swaps in the new font when its state becomes `ok`. If the state becomes `fail` or `missing`, the fallback is shown after all and the status line says so. A font that is already loaded is shown at once.
- The status line under the field shows "Loading the font…" meanwhile, so a short wait is understood. When the arrow keys are pressed fast, only the font of the row where the user stops is waited for; older pending ones are dropped.
- Optional: when the list opens or the highlight moves, load the neighbouring fonts (a few rows up and down) quietly so that the next arrow press has no wait. A cost: more font requests.

**Open**
- How long to wait for a font before giving up and showing the fallback (the assistant's default: until the load succeeds or fails, no timer).
- Whether the neighbour prefetch is wanted (default: not in the first version; see REQ-021, which covers it).

**Depends on:** REQ-010.

## REQ-013 Resize handles on a selected text (font size by dragging)

Status: Built in V99 (see PROGRESS.md row 7bq and CLAUDE.md). The assistant's defaults of the open points were used with the maintainer's approval: handles only for exactly one selected text, on the rotated box, the letter space scales and the outline width does not, no rounding beyond three decimals, the box the stage measured.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- When a text is selected, control handles appear at the corners and at the middle of each side. They change the font size.
- The scaling keeps the aspect ratio: horizontal and vertical change by the same amount.
- The text grows towards the side of the handle that is held. The opposite side stays where it is.
  - A left corner handle (upper left): the bottom edge and the right edge of the box stay, the text grows up and to the left. Lower left: it grows down and to the left.
  - The left middle handle: the right edge stays and the vertical centre line of the text stays; the text grows up and down (and to the left). The same logic for the other sides.
- Dragging a handle snaps to everything that can be snapped to. Holding Alt (the maintainer could not remember the key; in this program Alt or Ctrl ignore snapping) switches snapping off.
- Holding Shift while dragging a handle (added 2026-11-07): the centre of the text stays in place and the text scales both horizontally and vertically around it (still the same aspect ratio), so that the opposite side moves too.

**Current state of the program** (checked in the source on 2026-11-07)
- A text is anchored at its position point (`x`, `y`) with `text-anchor: middle`, can be rotated about that point, and its size is `size` in millimetres (the font size). `ui.bounds` holds the box the stage measured for it. Dragging with Alt or Ctrl held ignores snapping everywhere (Cmd is not included). The align mode (REQ-002) has its own nine handles, drawn in orange, only in that mode.
- Frozen texts have the size field disabled ("Unfreeze it to change the text, font or size").

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- Eight handles on the box of a single selected text, in the Select tool only, hidden in the align mode and for frozen or hidden texts. Same adaptive rule as the align handles (fewer handles when the box is small on the screen), screen-fixed size, hit radius about 12 px; its own colour, not orange.
- The factor is a single number `k = newSize / oldSize`. A corner handle: the opposite corner is the fixed point, the factor comes from the pointer's movement along the diagonal. A side-middle handle: the opposite side is fixed and so is the middle line along it; the factor comes from the movement perpendicular to that side. The position point is moved so that the fixed point stays: `p' = fixed + (p - fixed) * k` (in the text's own axes if it is rotated).
- A pointer inside the hit radius of a handle belongs to the handle, not to the text under it, so a small text can still be moved by its middle; with the reduced handles of a small box (and no handle in the middle) the text body stays draggable. A handle press never starts a selection toggle, so Shift held at that moment means "from the centre".
- Snapping: the dragged edge or corner snaps through `snapXY` and the guide and anchor lines (the named snap points, guides, control points, the edges of other things); a side handle snaps along its one axis, a corner snaps in x or in y, whichever is nearer, and the other follows from the aspect ratio. Alt or Ctrl switches it off. Esc during the drag cancels only the drag. One undo step per drag (a group, as other drags do).
- Shift: the fixed point is the centre of the box instead of the opposite corner or side; the factor is the pointer's distance from that centre divided by the handle's original distance from it, so the handle stays under the pointer. The position point scales about the same centre. The fixed point is worked out from the state at the start of the drag, so pressing or releasing Shift during the drag switches smoothly (as Alt does in the align mode). Snapping applies to the dragged edge as before; the opposite edge moves symmetrically and is not snapped.
- The size is clamped to the limits of the fields (1 to 3000 mm); dragging past the opposite side stops at the minimum instead of mirroring the text.
- Control points that hang on the text follow its size automatically (REQ-001), and measurements on the text edges follow it.

**Open**
- Several selected texts: handles only when exactly one text is selected (the assistant's default), or scaling the whole selection about its box (texts and their positions scale together; much bigger).
- A rotated text: handles on its own rotated box, with the sides named in the text's own axes (the assistant's default).
- Whether the letter space and the outline width (halo) scale with the size so that the look stays the same (the assistant proposes: the letter space scales, the outline width does not; it is a margin in millimetres). Today the size field changes only the font size.
- Shift here means "from the centre"; in REQ-009 Shift means an axis lock when moving an object, and in other programs "from the centre" is usually Alt. This program already uses Alt and Ctrl for "no snapping", so the maintainer's choice avoids a collision; the three meanings of Shift (add to the selection, axis lock, from the centre) are kept apart by what is being dragged. Alt on its own can focus the browser menu on Windows, so the program has to cancel that key press during the drag (as it does in the align mode).
- How the size is rounded after a drag (default: kept exact, three decimals as in scrubbing).
- The box used for the handles is the box the stage measured, which for script fonts can be taller than the visible letters; whether that is the right box or the ink box is not decided.

**Depends on:** nothing. Related: REQ-002 (the align handles look similar and must not be confused), REQ-009 (modifier keys).

## REQ-014 Operation hint line: what is happening and which extra keys work

Status: Built in V99 (see PROGRESS.md row 7bq and CLAUDE.md): the line is under the stage, every drag and tool has a hint, the hint shows on a text handle, the tests press the keys. There is no settings switch for the hint line (still open).

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- Whenever an operation like this starts, a text should appear somewhere on the screen, for example at the bottom edge of the graphics or in the text area just above it, saying what is happening and which extra control keys can be pressed and what they do.
- Example given for dragging a text handle: "drag the handle to scale the text uniformly", "Shift centres the axis of scaling", "Ctrl and Alt switch snapping off while dragging", something like that. The assistant writes the actual wordings (the maintainer: "you are good at that").

- The maintainer accepted the additions of the assistant on 2026-11-07 (hint also on hover over a handle; hints list their keys as data and a test presses them) and said to take them along.

**Current state of the program** (checked in the source on 2026-11-07)
- There is a status line under the stage (cursor, zoom, millimetres per 100 px) and a message line for tools (`toolMsg`, written with `say`), used for example by the align mode. The font list already has a hint line of its own (REQ-010, built in V98). Help texts are data in `js/help.js` (`TIPS`, `FT`), and a test fails when a button or field has no tooltip.

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- A separate hint line, shown while an operation runs, while a tool is active and while the pointer rests on a handle, and hidden when none of these holds. It has two parts: what is happening, and the extra keys with their effect. A key that is held down at the moment can be shown in bold.
- The wordings are data in `js/help.js` (a table `HINTS` keyed by operation or tool), in English like all interface text, and the tests fail when a registered operation has no hint, as for tooltips. One function shows and hides the hint; the starts of drags (`startDrag` kinds) and `setTool` call it.
- Draft wordings (English, to be refined when built):
  - Scale a text by its handle: "Drag a handle to scale the text. The opposite side stays in place." and "Shift: scale from the centre. Alt or Ctrl: no snapping. Esc: cancel."
  - Move a text or other object: "Drag to move. Arrow keys nudge (Shift 10 mm, Alt 0.1 mm)." and "Alt or Ctrl: no snapping. Esc: cancel."
  - Draw an area selection: "Drag to select everything inside the box." and "Shift adds, Ctrl removes."
  - Move a table node, a guide or a measurement end: what is being moved and "Alt or Ctrl: no snapping. Esc: cancel."
  - Measure tool, Point tool, placing a guide, the align mode: the next click and the keys of that tool (Tab cycles the snap, Enter pins, Esc ends the tool).
- Also show the hint when the pointer rests on a handle, before the button is pressed (as Inkscape does; see the comparison in REQ-015), not only during the drag.
- Hint texts name Alt or Ctrl as the keys that switch snapping off. REQ-009 may later change Ctrl to mean only a selection key; because the hints are data and tested, such a change is a one-place edit that the tests catch.
- A hint must not promise a key that does nothing (a published bug report of Inkscape is about a status message that advertised unimplemented keys). Each hint therefore lists its keys as data, and a test presses every listed key during the operation and checks its effect; the test also fails when an operation has no hint.
- Place: a line directly under the stage (beside or above the status line) so that it never covers the drawing; an overlay at the bottom edge of the stage is the alternative.

**Open**
- Resolved 2026-11-07 (the maintainer confirmed the assistant's assumption): the first version builds the mechanism and fills in every existing drag and tool (moving, area selection, nodes, guides, measurements, Measure tool, Point tool, guide placement, align mode, scrubbing a number), plus the text handles of REQ-013 when those are built.
- The place (a line below the stage or an overlay) and whether it may be switched off in the settings (REQ-018 gives the place for such an option; a settings key follows the standing JSON rule).
- Mac: Cmd is not part of the no-snap rule today and Ctrl-click is a right click there; the wording may need a platform version later.
- Whether the existing hint of the font list moves under the same mechanism (default: it stays as it is).

**Depends on:** REQ-013 gives the first operation to describe; the table can be built before it.

## REQ-015 CAD-style aids to consider (assistant's proposals from a comparison with CAD programs)

Status: Idea. Written by the assistant on 2026-11-07 after the maintainer asked it to look at how such operations work in CAD programs, invent further functions and compare them with the plan. None of these is agreed; the maintainer picks.

**What was found** (web sources read on 2026-11-07, paraphrased)
- AutoCAD grips: clicking a grip makes it the base point, Space or Enter cycles through the modes stretch, move, rotate, scale and mirror, the shortcut menu or the letter B changes the base point (the fixed point of a scale), C or holding Ctrl copies while editing, R gives a reference length or angle, and Esc leaves the action. Cursor badges show when move, rotate or scale mode is on.
- AutoCAD dynamic input: temporary dimensions and a short command prompt appear next to the cursor while an object is created or edited; values can be typed there and Tab moves between the fields. Polar tracking and object snap tracking show alignment paths and tooltips with the type of snap, the angle and the distance; acquired points get a small plus sign; Shift temporarily forces Ortho; there are temporary override keys; Tab cycles the snap candidates.
- Inkscape: the status bar shows hints and messages as you work, and when the pointer is moved over a handle it lists the edits available there with their Ctrl, Shift and Alt variants. Dragging a scaling handle with Shift scales around the centre, and Ctrl keeps the ratio; Shift and Ctrl together scale proportionally from the centre. The maintainers of Inkscape themselves call its use of Alt inconsistent.

**Comparison with what is planned or built**
- Already the same or planned: named snap kinds at the pointer and Tab cycling (built for measurements), Alt or Ctrl for no snapping (built), arrow-key nudging with Shift and Alt steps (built), Esc to cancel (built), centre scaling with Shift (REQ-013), alignment tracking lines (listed under Measurements in PROGRESS.md, phase 4), Shift as a temporary axis lock (REQ-009).
- Different on purpose: the text has one size, so there is no free-ratio scaling and no key for the ratio. Ctrl cannot mean "copy" here because it already means "no snapping"; copy while dragging is therefore not proposed (REQ-009 proposes the same for Alt).

**Proposals, in the assistant's order of value**
1. Hint on hover over a handle, not only during the drag (Inkscape does this). Small; goes into REQ-014 (done there).
2. (Now REQ-017.) A live readout next to the pointer during a drag: the new size in millimetres and the factor for a text handle, dx and dy for a move, the coordinates for a node or guide (AutoCAD's temporary dimensions). The measurement ghost already shows a value this way.
3. Cursor shapes per handle (resize arrows, move) and a highlighted handle under the pointer. Cheap and expected.
4. (Now REQ-016.) A rotation handle for texts (a text already has a rotation): drag just outside a corner, Shift for steps of 15 degrees, an angle readout. It would use the same hint line and readout.
5. Scale about a chosen pivot: a control point or any snap point instead of the box centre (AutoCAD's base point). It ties to the control points of REQ-001; a later extension of the Shift rule.
6. The snap marker with its name, and a thin line to the thing snapped to, during every drag. Today (checked in the source on 2026-11-07) a drag that snaps draws endless pink dashed lines (`#ff7ab8`, `ui.snapLines`) at the snapped x or y, but no marker at the snapped point and no name, so the user does not see what was snapped to; named snaps with a marker exist only while measuring and placing. The proposal: a small marker at the exact snapped point, a short label next to the pointer that names the target (it shares the one pointer label with the readout of REQ-017: numbers on the first line, the name on the second; for example "guide", "edge of Royale", "table centre", "control point cp1"), and a thin line from the dragged point to the snapped thing itself, so that it is clear which of several nearby things won. Alt or Ctrl, which switch snapping off, also remove the marker. Whether every snap candidate in the drag code already carries a name is to be checked when it is built; tracking lines from acquired points would follow in the measurement phases.
7. Not proposed for now: typing an exact value during a drag (AutoCAD direct entry), because the number fields already do it, and a command line.

**Open**
- 1 is in REQ-014, 2 is REQ-017, 4 is REQ-016. Still open: 3 (cursor shapes), 5 (pivot) and 6 (snap marker and name); the maintainer asked for 6 to be explained more richly before deciding.
- Source check on 2026-11-07 (`js/thandles.js`, function `cursorOf`): item 3 is partly there already. The eight text handles set a resize cursor (`ns-resize`, `ew-resize`, `nwse-resize`, `nesw-resize`) through `style="cursor:..."`; the cursor is not turned with a rotated text, and nothing highlights the handle under the pointer. Other handles (table nodes, guides, measurement ends, control points, the align handles) have no handle-specific cursor (`js/app.js` only sets `move` in one place and `crosshair` for tools). Items 5 and 6 are not in the code (a drag that snaps draws only the pink lines `ui.snapLines`).

**Depends on:** REQ-013 and REQ-014 for 2 to 4 and 6.

## REQ-016 Rotation handle for texts

Status: Agreed (the maintainer, 2026-11-07: "it is a requirement, but it is built later"). Not to be built now; build when the maintainer says so. Nothing is built.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- The rotation handle for texts is wanted, but it can be left for a later part.

**Implementation idea** (the assistant's, from the proposal of 2026-11-07)
- A text already has a rotation about its position point. A rotation handle sits just outside a corner of the box of a selected text (next to the resize handles of REQ-013). Dragging it turns the text about its position point (Shift is taken by the 15 degree steps below, so the box centre is not offered on a key), Shift gives steps of 15 degrees, Alt or Ctrl switch snapping off, Esc cancels, one undo step per drag. The angle shows in the readout of REQ-017 and the keys in the hint line of REQ-014.
- Control points that hang on the text follow the rotation already (REQ-001).

**Open**
- The centre of the rotation (the position point, as for the rotation field, or the box centre).
- Whether the handle is the same for a rotated box (the box turns with the text; REQ-013 has the same open point).

**Depends on:** REQ-013 (the handles), REQ-014 and REQ-017 (hint and readout).

## REQ-017 Live readout next to the pointer during a drag

Status: Built in V99 (see PROGRESS.md row 7bq and CLAUDE.md). It can be switched on and off in the Settings (REQ-018). Not built: the name of the snapped target on a second line (REQ-015 item 6).

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- A readout next to the pointer while dragging (the assistant's proposal 2 of REQ-015) is wanted.
- It has a setting in the Settings menu, a choice that is on or off. Plan it well; implement when told.

**Current state of the program** (checked in the source on 2026-11-07)
- All drags go through `startDrag(e, h)` in `js/app.js` with `h.move(worldPoint, event)` and `h.up(event)`; texts and lines (`dragArtwork`), area selection (`marquee`), table moves and nodes (`js/tables.js`), guides (`js/guides.js`), control points (`js/cpoints.js`), measurements and the align handles use it or the same pattern. A measurement ghost shows its value while placing. Lengths are shown with `fmtLen` in the unit of the settings.

**Implementation idea** (the assistant's plan; not decided unless it follows from Said)
- One small overlay element (HTML, `pointer-events: none`, `aria-hidden`, above the stage and below the dialog windows), a fixed screen size, placed beside the pointer (about 16 px right and below, flipped at the edges of the stage). It is created once and shown only while a drag runs, hidden on release, on Esc and on cancel.
- The mechanism: `startDrag` accepts an optional `h.readout(point, event)` that returns a line of text (or nothing). `startDrag` calls it after every `h.move`, and again when Shift, Alt or Ctrl is pressed or released, and moves the element to the pointer. An operation without a `readout` shows nothing. The text is built by the operation, so each drag knows its own numbers.
- Content, first version: moving texts and lines `dx 12.0  dy -4.5` (millimetres, or the unit chosen) and the new position; a text handle of REQ-013 `Size 120.0 mm  x1.35`; a table move `dx dy`; a table node, a guide and a control point their position or offset from the cloth centre or the parent; a measurement end point the value of the measurement; an area selection `w x h` and the number of things inside; an align handle drag `dx dy`. The snapped target can be added in brackets once REQ-015 item 6 exists.
- The setting `dragReadout` (REQ-018) decides whether the element is shown at all; the code still builds the text only when it is on.
- Tests (headless Chromium, real pointer events): the element appears during a drag with the expected numbers, follows the pointer, shows the changed numbers when Alt is pressed, disappears on release and on Esc, is not shown when the setting is off, and every drag kind of the first version has a `readout`.

**Open**
- One pointer label, not two: the name of the snapped target (REQ-015 item 6) goes on a second line of the same overlay, so two overlays never sit on top of each other at the pointer. Whether the readout setting (REQ-018) also controls that line, or a second option does, is open (the assistant proposes a second option, so that the names can be on while the numbers are off).
- Decimals: one decimal for millimetres as `fmtLen` does, or more for sizes.
- Whether the readout also shows while a number field is scrubbed (the field itself already shows the value; default: no).
- The default of the setting (the assistant proposes on).

**Depends on:** REQ-018 for the setting (build REQ-018 first); REQ-013 and REQ-014 share the same operation list; nothing blocks the first drags (move, guide, node, marquee).

## REQ-018 Settings: on/off options (true or false)

Status: Built in V99 (see PROGRESS.md row 7bq and CLAUDE.md): the Options section with one option, `dragReadout`.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- The Settings menu gets choices that are true or false. The readout next to the pointer is the first one: a choice that switches it on or off.

**Current state of the program** (checked in the source on 2026-11-07)
- The Settings pane (`settingsHTML` in `js/app.js`, opened by the toolbar button) only has the settings file buttons (Save, Open, Reset, Settings JSON) and explanation text. The settings file (`config`, format `poker-table-designer-settings`) holds units, snapping, the cutters, `pressMm`, favourite fonts, the user's universal words and `traceRes`; view switches such as the centre mark belong to the project and not to the settings. `normConfig` fills missing keys with defaults, `configJSON` writes the file, the Settings JSON window and the paste path find the kind `settings` from keys.

**Implementation idea** (the assistant's plan; not decided unless it follows from Said)
- A new section "Options" (a `h3.sec` heading, collapsible like the others) in the Settings pane with one check box per option: label, a tooltip that says what happens, bound to a boolean key in `config`. A table `OPTIONS` (key, label, default) drives the list, so a new option is one line there, one line in `FT` in `js/help.js` (`opt.<key>`), and the key in the defaults.
- Rule to keep the two kinds of on/off switches apart: a switch that belongs to one design (centre mark, grid, dealer line, measurements shown) stays a view switch in the toolbar and is saved with the project; a switch for how the program behaves or looks to its user (the readout, the hints) is an option in the Settings and is saved in the settings file. When REQ-018 is built the "Settings file versus project file" decision in CLAUDE.md gets one line about the options.
- Stored in the settings file, so every project and tab shares it (like `traceRes`), not in the project file; saved to localStorage with the other settings (`saveConfig`). `normConfig` turns a missing or odd value into the default (a boolean), so old settings files load. `configJSON` writes the keys; the Settings JSON window shows them; Reset settings restores the defaults. No new JSON kind, so the standing JSON rule is met by the existing `settings` part.
- First option: `dragReadout`, "Show the value next to the pointer while dragging", default on.
- Candidates for later options (not decided): show the operation hint line (REQ-014), show the snap name and marker (REQ-015 item 6), show the hover hint on handles.
- Tests: the option list exists with a tooltip on every check box (the help test enforces it), toggling changes `config` and persists after reload, the key is in the settings JSON and survives a paste round trip, an old file without the key gets the default, and Reset settings restores it. The text of the Settings help topic mentions the options.

**Open**
- Whether the options are also grouped by topic when there are many (not needed for the first one).
- Defaults of future options.

**Depends on:** nothing; REQ-017 is its first user.

## REQ-019 Shortcut F: jump to the font of the selected text and open the font list

Status: Built in V99 (see PROGRESS.md row 7bq and CLAUDE.md), with the assistant's defaults for the open points (F works only in the Select tool and says so otherwise; F stops the randomizer first).

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- With one or more text elements selected, pressing the letter F ("Font") makes the Artwork tab active and jumps the view to the text panel that is topmost in the list among the selected ones. With a single selected text it jumps to that one.
- It also opens the font list, as if the maintainer had clicked the font field with the mouse. The purpose: to adjust the font straight away from the keyboard.
- If nothing with a font is selected, a small message appears, for example "No text selected. Select a text to change its font."
- Decided on 2026-11-07 (the maintainer): the font field loses the focus after Enter, a click on a row and Esc, so that the keyboard returns to the canvas keys at once (F again, Ctrl+Z, arrow nudging). A letter typed into a field that has the focus is the user's own responsibility (the maintainer: "the user has some responsibility for what he presses"), so no guard against it is built.

**Current state of the program** (checked in the source on 2026-11-07)
- The global key handler (`keydown` in `js/app.js`, "keyboard") has no plain-letter shortcuts yet, so F is free; it ignores keys while a text, number or search field has the focus (`isTextField`), so typing an F in a field is not affected. Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+A, Esc, Tab, Enter, Delete and the arrow keys are the existing keys.
- The text panels are ordered on the screen by a CSS `order` computed in `layerPanel` from the layer index and the position of the lines and cards (`ord`), so the list order is not the order of `state.layers`. A font field exists only while its panel is open. Focusing the font field opens its list (`focusin`, REQ-010). `setTab` shows a tab, `renderPanels` rebuilds the panels, `scrollIntoView` is already used to bring a selected panel into view, and `say` writes a message to the status line for nine seconds.
- With several texts selected, the font list changes all of them (`editTargets`), whichever panel it was opened from.

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- A key branch in the global handler for F without Ctrl, Alt or Cmd (Shift or Caps Lock is fine), only when no field has the focus. It finds the selected texts, skips frozen ones (their font field is disabled), picks the one with the smallest panel order (the topmost in the list; the order formula moves into a small function that `layerPanel` and the shortcut share), calls `setTab("artwork")`, opens its panel (`ui.open`), rebuilds the panels, scrolls the panel into view and focuses its font field, which opens the list through the existing `focusin`. The list then changes all the selected texts as before.
- Messages: nothing selected, or only things without a font (tables, guides, the lines and cards): "No text selected. Select a text to change its font."; all selected texts frozen: "The selected text is frozen. Unfreeze it to change its font."
- The key is the letter F by `e.key`, so it follows the keyboard layout. The Keyboard topic of the help window and the tooltip of the font field mention it; the help test and a new test cover it (one text, several texts with the topmost chosen by list order, a closed panel opened, another tab brought to Artwork, no selection, only the lines and cards selected, frozen, no reaction while a field has the focus or with Ctrl held).

**Open**
- F while a tool other than Select is active (Measure, Point, align mode, placing a guide): the assistant's default is that F works only in the Select tool and says so otherwise; to confirm.
- F while the randomizer runs: it replaces fonts and texts every round, so the open list could lose its text. The assistant's default is that F stops the randomizer first, as the start of a font preview does (REQ-010) and as Undo does; to confirm.
- After the field is blurred the keyboard focus is on the page body (Tab starts again from the top of the page); acceptable, since the global keys listen on the document.

**Depends on:** REQ-010 (the list that opens). Related: REQ-014 (the hint line could name the key).

## REQ-020 The font list in alphabetical order

Status: Discussed (the maintainer, 2026-11-07: the list must be in alphabetical order; one point is open). Nothing is built.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- The font list has to be in alphabetical order. Now it is in some random order.

**Current state of the program** (checked in the source on 2026-11-07)
- `PTD.fonts.allNames()` in `js/fonts.js` returns the imported fonts first and then the shipped list `F.LIST` (122 names) in the order of the array: first the script fonts in the groups they were collected in, then, from "Josefin Sans" on, the serif and sans fonts. Both the list and the arrow-key preview (REQ-010) follow that order. `js/random.js` uses `F.LIST` itself and relies on its order (it cuts the array at "Josefin Sans" into script fonts and the rest), so the array must not be re-sorted.

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- Sort only the result of `allNames()` (a sorted copy), case-insensitively with a locale compare (so "WindSong" sits among the W names and "Mr Dafoe" comes before "Mr De Haviland"). The list, the typed filter, the arrow keys and the opening of the list on the current font then all use the alphabetical order. `F.LIST` stays as it is for the randomizer.
- Imported fonts keep their "file" note and favourites keep their star; they are not pulled out of the order.
- A test checks that the list is sorted, that the filter keeps the order, that an imported font is in its place and that `F.LIST` is unchanged.

**Open**
- Imported fonts and favourites: mixed into the one A to Z list (the assistant's default), or first in their own part and then A to Z.

**Depends on:** nothing. Related: REQ-010 (the arrow keys), REQ-021 (neighbours to load).

## REQ-021 Load the fonts in the background after the start

Status: Idea. The maintainer decided on 2026-11-07 that it is kept on this list but not built ("we do not build requirement 021, we leave it in the list"). Do not build it unless he asks again. Nothing is built. The text below stays as the record of the discussion.

**Raised** (the maintainer, 2026-11-07: could the program load the fonts into memory in the background after it starts, so that changing the font is even faster; it is fast already)

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- When the program starts it could begin to load the fonts into memory in the background, so that changing a font is faster still.

**Current state of the program** (checked in the source on 2026-11-07)
- A Google font is fetched only when a text uses it or a preview asks for it (`PTD.fonts.load`: a stylesheet link to Google Fonts, then `document.fonts.load` with the sample text "Molino Royale", so only the needed part of the font comes). Every finished load calls `afterFont`, which redraws the stage and the status line. A font that fails is remembered as `fail` for the rest of the session and is not tried again. Imported fonts are in the project and need no loading. REQ-012 hides the wait while a previewed font loads; it does not remove it.

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- After the first draw and when the fonts of the project's own texts are ready, a quiet queue loads the other fonts: favourites first, then the rest in the order of the list (REQ-020), two at a time, only when the browser is idle, paused while a drag runs, and skipped when the browser asks to save data. The size is an estimate that has not been measured here (no network to Google Fonts in the development environment): 122 families, roughly a few megabytes in all, mostly small script fonts. The browser also keeps the files in its cache for the next start.
- A quiet load must not redraw the stage for every font (122 redraws at start would stutter): it marks the font as ready and the stage is redrawn only when a text uses that font, or at most a few times a second.
- A failure of the background load must not be remembered as `fail`: offline at the start would otherwise mark every font as missing, and a font could not be loaded again when the network comes back. A background failure leaves the state empty so that a real request tries again.
- When the font list opens or the highlight moves, the nearest fonts in the direction of the arrows (about eight) jump to the front of the queue (this replaces the neighbour prefetch of REQ-012).
- An option in the Settings Options (REQ-018), for example "Load the fonts in the background", so that the data use can be switched off. The assistant proposes on by default.
- Tests: the queue order and the pacing with a stubbed loader, no redraw storm, a background failure leaves the state empty, the option, the queue priority on opening the list. The real loading from Google Fonts and the real size can only be tried by the maintainer in a real browser.

**Open**
- All 122 fonts, or only the favourites and the neighbours of the list.
- The default of the option (on or off).
- Whether it is allowed in the Artifact host (stylesheets from Google Fonts are allowed there, so it should be; untested).

**Depends on:** REQ-018 (the option), REQ-020 (the order of the queue), REQ-012 (the hold stays for the fonts not yet loaded).

## REQ-022 Align: placement zones around the target box

Status: Built in V100 (see PROGRESS.md row 7br and CLAUDE.md); agreed by the maintainer on 2026-11-07 after seeing the 25 slots, the Alt behaviour and the examples: "very good, let us do that"; the assistant's defaults below stand: the 5 x 5 model, a click inside the target or on empty space and Enter apply, no gap field yet, box ghosts, the active slot highlighted, no chaining switch). Waiting for the go-ahead. Nothing is built. It extends REQ-002.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- In the align mode there is the yellow (orange) box of the target and the blue box of what is being moved. Moving the pointer inside the target box, or outside it near its (imaginary) handles, could mean different actions, even though the target has no handles.
- The yellow move arrows should be shown in every situation, and the ghost images too.
- The purpose: to put objects next to each other easily. The assistant was asked to propose how it could work, what the options are and how it would be used.
- The yellow move arrows must be shown in every situation (said again on 2026-11-07), also for every object with Alt.
- Alt must work here as it does in the align mode today: with Alt held, the single objects of the selection each go to those places by themselves (said by the maintainer after seeing the 25 slots, 2026-11-07).

**Current state of the program** (checked in the source on 2026-11-07, `js/align.js`)
- The target is drawn orange, the objects to move cyan with a box and nine handles around them. The yellow arrow and the ghosts (boxes, not copies) show only while the pointer is within 12 px of a handle of the moved objects, or during a drag from such a handle. A click on a handle goes to the point of the same name of a box target; a drag drops onto a point or an endless line of the target. The menu has the four "Place left of, right of, above and below the target" buttons (touching, no gap).

**Proposal** (the assistant's, not decided)
- Five states per axis, which give 25 destinations. For each axis the pointer is in one of: `before` (outside, beyond the low edge of the target), `start` (inside, first third), `centre`, `end` (inside, last third) or `after` (outside, beyond the high edge). The destination of the moved objects (the box around them) follows from the two states: before = the moved box ends where the target begins (touching, outside); start = low edges aligned; centre = centres aligned; end = high edges aligned; after = the moved box begins where the target ends. Examples: x after and y start = to the right of the target with the tops aligned; x centre and y after = below the target, centred; x before and y before = diagonally touching at the upper left corner; x start and y start = into the upper left corner inside. The four existing "Place" buttons are the four middle outside slots.
- The pointer picks the slot by its place relative to the target box. Outside, a capture ring of a fixed screen width (about 60 px) around the box; beyond it nothing is previewed. A small target box (under about 45 px on a side) has no thirds inside: its inside states collapse to `centre`.
- A preview is always shown while the pointer is in the capture area: the yellow arrow from the moved box to its destination (one arrow for the group; with Alt each object has its own arrow and goes to the same slot by itself, as today), the ghost at the destination, a marker on the target at the anchor it uses, and the active slot highlighted. A short label near the pointer names the slot (for example "right of, top aligned") and can carry the dx and dy of REQ-017.
- Alt in the zones: without Alt the box around all the moved objects goes to the slot and they keep their places relative to each other (the group). With Alt held each object has its own box, goes to the same slot by itself, has its own arrow and ghost, and the preview changes when Alt is pressed or released (as in the present align mode, `planMove` with `alt`). For the slots inside the target this aligns every object to the same edge, corner or centre; for the "next to" slots every object ends touching the target at the same place, so objects of different sizes lie on top of each other there (that is what the maintainer asked for; building a row or a column is the chaining option, not Alt). A guide among the moved objects moves only along its own axis, as today.
- A click applies the move (one undo step, the existing `A.apply`). The handles of the moved objects keep their present behaviour and win within their 12 px.
- Target kinds: a box target has the 5 x 5 slots; a point target has before, centre and after on each axis; a line target only on the axis across it; the player-area line (a curve) keeps its present way of aiming at the nearest point.

**Options to decide**
- Zone model: the 5 x 5 slots (above); or 3 x 3 only on the outside ring (four sides and four corners, inside = centre); or the nearest of nine imagined handles of the target (inside means align, outside means next to), which has no third positions along a side.
- How a click applies when clicking also selects: apply on a click inside the target box and on empty space, and select when the click is on another object; plus Enter always applies the shown preview. Alternatives: a mode switch in the Align menu, a key held to place, or a double click.
- Gap between the objects: none (touching, as the Place buttons); a gap field in the Align menu (mm, also for the four Place buttons); or the mouse wheel changes the gap while previewing.
- Ghosts: boxes as today, or real copies of the texts and lines drawn faintly at the destination.
- Showing the zones: only the active slot highlighted, or a faint grid of the 25 slots when the pointer comes near.
- Chaining: after the move the moved objects optionally become the new target, so that a row or a column can be built object by object (a switch in the Align menu).
- Keeping one axis: a modifier that keeps the position on the cross axis and moves only along one.

**Uses**: put B to the right of A with the tops aligned; stack a column with an even gap; centre a text under a title; put a logo into the inside corner of a box; centre a text on a box; place an object diagonally against a corner; move a cluster of objects as a group next to something.

**Open**
- All the options above. The assistant's defaults: the 5 x 5 model, apply with a click inside the target or on empty space and with Enter, no gap in the first version (the gap field is the already open item of REQ-002), box ghosts, highlight of the active slot only, no chaining switch yet.
- The hint line (REQ-014) needs a new hint for the zones; its keys must work (Alt each object by itself, Enter applies, Esc ends the mode).

**Depends on:** REQ-002 (the align mode), REQ-014 (the hint), REQ-017 (the readout).

## REQ-023 Delete key: delete or hide the selection

Status: Built in V100 (see PROGRESS.md row 7br and CLAUDE.md); agreed by the maintainer on 2026-11-07 with the answers below. A click on the player-area line now selects it on its own, so that Delete can hide it. Delete in the align mode is built but not tested.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- With some elements selected, the Delete key destroys them. It can be any kind of element.
- A text element, a guide or a measurement is destroyed. A table edge, the player-area line or the card lines are only hidden.
- Answered later the same day: with a table selected the Delete key does nothing to that table. When the edge line of the player area is selected, Delete only hides it. When the card lines are hidden, everything that depends on them is hidden too (the hand, the pot, the burn cards and the muck, which follow the lines today, and measurements attached to the lines).

**Current state of the program** (checked in the source on 2026-11-07)
- Delete (and Backspace) already removes a selected measurement and a selected guide (`app.js`), a selected control point (`cpoints.js`) and a selected table node (`tables.js`, not on a locked table). A text is deleted only with the ✕ button of its panel. The lines and cards (`band`), a table and its player-area line cannot be hidden with the keyboard; the eye buttons and the table panel do it (`band.hidden`, `table.visible`, `table.bet.on`).

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- One Delete branch for the whole ordinary selection (in the align mode: for the align selection). Texts are deleted as the ✕ button does (control points that hung on them stay on the cloth centre, measurements on them become broken, as today); guides, measurements and control points are removed as today; the lines and cards are hidden (`band.hidden`, which already hides the hand and the things on the table); the player-area line is hidden (`bet.on = false`); a selected table is left alone (the table node that is selected inside a table is still deleted by Delete, as today, and that stays).
- Dependents of hidden things: today a measurement attached to a hidden text or to hidden lines and cards turns "broken" (red), because the hidden thing is not among the features that measurements can use (`measure.js`). The new rule: such a measurement is hidden, not broken, and comes back when the thing is shown again; "broken" is kept for a thing that is really missing. Control points already hide with a hidden text or table. One undo step for the whole key press; the status line says what happened ("Deleted 2 texts and hid the lines and cards").
- The randomizer is stopped first, as Undo does. The key is ignored while a field has the focus (the existing guard). Backspace works as an alias, as it does for guides.
- With REQ-024: locked elements are neither deleted nor hidden, and the status line says how many were left.

**Open**
- Answered: a selected table is not touched, and the lines and cards take their dependents with them. Still to build: a way to select the player-area line on its own in the Select tool (today a click on it selects the table; REQ-002's align mode already has `bet:` targets).
- Answered (the maintainer, 2026-11-07): a measurement with two ends where only one thing is hidden is hidden too.
- Mixed selections: the ordinary selection can hold texts and the lines and cards together, but a table, a guide, a measurement or a control point is selected alone.

**Depends on:** REQ-024 for locked elements. Related: REQ-014 (a hint for Delete is not needed, it is a plain key), REQ-027 (what happens to the things that hang on a deleted one).

## REQ-024 Lock any element

Status: Built in V100 (see PROGRESS.md row 7br and CLAUDE.md); agreed by the maintainer on 2026-11-07 with the answers below. Not built: a padlock on the thing itself on the stage (an option) and groups.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- Any element must be lockable. Locked means that it cannot be edited, or rather that the user cannot edit it directly. If it has a parent that is moved, it still moves and changes with it. What the lock prevents is the user changing it by accident.
- When the pointer hovers over a locked element, a small padlock picture appears at the pointer.
- Answered later the same day: the strength of the lock is the assistant's default (the panel fields are disabled, the eye button still works, Delete refuses). A locked element can be selected (the maintainer first thought it should not, then said it must be selectable). The user can hide and show a locked element. What he cannot do himself is drag it or change its size or anything else directly. The lock is only about direct editing by the user: an element that depends on a parent still follows and changes with it. It does not hold an absolute place, so the one rule replaces the present meaning of the lock of guides (which held the absolute place) and of tables (whose fields still worked). The default for a selection with a locked element in a drag stands: the locked ones stay, the others move, with a note.
- In the list (the roll-out of the element) a padlock picture is shown in the name of the element.

**Current state of the program** (checked in the source on 2026-11-07)
- Tables and guides have a `locked` flag with a check box in their panels. A locked table cannot be dragged on the canvas (its fields still work) and the randomizer and the align actions skip it; a locked guide cannot be dragged, and the guide solver holds it at its present absolute place as a constraint (`guides.js`), so it does not follow a table edge that it is measured from. Texts, the lines and cards, control points and measurements have no lock.

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- One flag `locked` on every kind: texts, the lines and cards, control points, measurements, tables and guides, saved in the project (a partial artwork file carries the flag of its texts; an old file has none, which means unlocked).
- What a lock stops, as direct actions of the user: dragging, the arrow-key nudge, the resize handles (REQ-013), changing the panel fields of that element (they are disabled, as for a frozen text), the font list and its preview (REQ-010) and the F key (REQ-019), the scrub, Delete and hide by Delete (REQ-023), align, distribute and the placement zones (REQ-002, REQ-022), the randomizer (a locked text keeps its words, font, size and place, also in Create casino and in the name styles, and a locked table is already skipped). The user can still select a locked element, see its panel, unlock it and delete it by unlocking first.
- What a lock does not stop: following a parent. A control point hung on a text moves with it; a measurement follows what it is attached to; a locked guide measured from a table edge follows the table (this changes today's behaviour, see Open).
- Showing it: a padlock badge next to the pointer while it is over a locked element on the stage (a small SVG or DOM badge, like the plus and minus of the align mode); a padlock in the title row of its panel and a padlock button there that locks and unlocks, next to the eye button; a toolbar button and a key (for example L) that lock or unlock the selection. A clone of a locked element is unlocked.
- Tests for every kind: a drag, a nudge, a field, a handle, Delete, align and the randomizer refuse; a follow of a parent works; the badge and the panel icon show; save and load keep the flag.

**Open**
- Answered: strength as the assistant's default, one rule for all kinds, the drag keeps the locked ones in place.
- An existing project file with a locked guide or table keeps the flag; the guide solver stops treating the lock as a held position (a locked guide measured from a table edge then follows the table).
- The size of the padlock badge and whether a locked element is also marked on the stage (a small padlock on the element) by an option in the Settings (REQ-018).
- Groups (REQ-008) and locking a group.

**Depends on:** REQ-023 (Delete), REQ-014 (the hint could say "locked" when a drag is refused), REQ-018 (an option for the badge). Related: REQ-002, REQ-010, REQ-013, REQ-019, REQ-022.

## REQ-025 The panel of a clicked text opens and scrolls into view

Status: Built in V100 (see PROGRESS.md row 7br and CLAUDE.md); "let us try it", with the option `openOnSelect` (default on) and only the topmost of several selected texts opening. It reverses the V88 decision for texts; CLAUDE.md is updated.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- With the Artwork tab active, selecting a text element makes its roll-out scroll to the selected text and open. Probably all the text elements that have been clicked then stay open. Let us try that.
- Why (the maintainer, later the same day): when he selects a text he wants to go straight to editing its properties, and has to see the properties of that element at once; otherwise it is easy to edit the wrong element. If the Artwork tab is not the active one, he may have to choose it first (a click on a text already brings it forward).

**Current state of the program** (checked in the source on 2026-11-07)
- A click on a text on the stage selects it with `select(id, true)`, which keeps its panel closed; `revealChanged` and `revealSelected` only scroll the panel into view (`scrollIntoView` with `block: "nearest"`), and CLAUDE.md records this as a decision (V88: selecting scrolls its panel into view in the tab that is shown but never opens it). A click on a text from another tab already brings the Artwork tab forward. The F key (REQ-019) opens the panel of the topmost selected text.

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- A click that selects a text sets `ui.open[id] = true` (the panel opens, as with the F key) and scrolls the panel into view; panels that were opened this way stay open, because nothing closes them. With several texts selected (area, Shift) only the topmost in the list opens, as the F key does, so that an area selection does not open a long row of panels.
- An option in the Settings (REQ-018), for example "Open the panel of a clicked text", default on, so that the old behaviour is one click away if the open panels pile up.
- The CLAUDE.md decision is changed for texts (the lines and cards, tables, guides and measurements keep "scroll, never open" unless the maintainer wants otherwise).

**Open**
- The rule that opening or closing a panel keeps its header at the same screen position (V86) is for the user's own click on the header; here the view is scrolled on purpose. Both stay, each for its own case.
- Whether other kinds (the lines and cards, a guide, a measurement) should open on selection too.
- Accordion instead of accumulation: opening the clicked one and closing the others (not asked for; the option could offer it).
- Scrolling: "nearest" (only as far as needed, as today) or the panel header to the top of the list; the assistant's default is nearest.

**Depends on:** REQ-018 (the option). Related: REQ-019.

## REQ-026 Shortcut S: jump to the size of the selected text

Status: Built in V100 (see PROGRESS.md row 7br and CLAUDE.md).

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- As F was made for the font, S has to be the size, the change of the size.

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- S works like F (REQ-019): no Ctrl, Alt or Cmd, no field focused, not during a drag, only in the Select tool. It brings the Artwork tab forward, opens the panel of the topmost selected live text in the list, scrolls it into view and focuses its size number field with the number selected, so that typing a value replaces it. The arrow keys of the field change the size by 0.5 mm (REQ-011), the value applies to all the selected texts as the size field does today.
- Enter keeps the value and the field lets go of the focus; Esc puts the size back that the field had when S was pressed (for all the selected texts) and lets go of the focus; a click elsewhere keeps it. The field lets go of the focus in both cases, as the font field does (REQ-019), so that S, F, Ctrl+Z and the arrow keys work on the canvas at once. One undo step for the whole edit.
- Messages as for F: no text selected, only frozen texts selected (the size field is disabled), another tool active. A locked text (REQ-024): its field is disabled, so the message says it is locked.
- Ctrl+S (save) is not touched; a plain S has no other use today. The Keyboard topic of the help window and the tooltip of the size field mention it. A test checks the cases of F for S as well.

**Open**
- Answered: Esc restores the size.
- A family of such keys later (see the ideas in the chat of 2026-11-07): for example W weight, C colour, T text, R rotation, O outline, K letter space (L is proposed for Lock in REQ-024). Not decided.

**Depends on:** REQ-011 (the 0.5 mm steps), REQ-019 (the same pattern). Related: REQ-013 (the handles are the mouse way), REQ-024.

## REQ-027 Delete and the things that hang on it: all of them, or Alt for only this one

Status: Built in V100 (see PROGRESS.md row 7br and CLAUDE.md); the old rule "they stay on the cloth centre" is now the Alt rule. It extends REQ-023.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- Things are in a tree: there are parents and things hang from them, a hierarchy. When he deletes something from the middle of the tree, the things below it could be handled with a modifier key: delete only the thing to be destroyed, or delete it together with everything that depends on it. Maybe Alt.
- Plain Delete destroys the thing and all the things that depend on it, all those that have it as their parent. Alt and Delete destroys only that thing. If there are things below it, their parent becomes the parent of the destroyed thing, and they get an offset.

**Current state of the program** (checked in the source on 2026-11-07)
- The only parent tree today is the control points (REQ-001): a point hangs on the cloth centre, the artwork origin, a text, a table or another point, and chains are allowed. Texts and tables have no parent. Measurements and guides depend on things only as anchors or references, not as children.
- The rule now (CLAUDE.md, REQ-001): when the user deletes a text, a table or a control point, the points that hung on it stay where they are and hang on the cloth centre, their offset becoming their place from the cloth centre (`CP.remove`, `CP.detach`). The randomizer removes the points of texts it replaces together with all the points below them (`CP.prune`, which repeats until nothing hangs on a missing parent). Building blocks that exist: `CP.descendantIds(id)` and `CP.reparent(cp, parent, position)`, which keeps the point where it is and takes the reference again.

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- Plain Delete: the selected thing and, recursively, every control point that hangs on it (and on those) are removed, in one undo step. Alt+Delete: only the selected thing is removed, and each control point that hung directly on it is reparented to the nearest ancestor that is not being deleted (the deleted thing's own parent; for a text or a table, the cloth centre, which is the old rule), keeping its place on the cloth by recomputing the offset (`CP.reparent`). The Alt key follows the habit of the program (Alt means "this one by itself").
- With a selection of several things: each is handled by the same rule; a child that is also deleted is simply deleted; with Alt the survivors go to the nearest ancestor that survives.
- The buttons without a keyboard (the ✕ of a text panel, the Delete button of a control point, the delete button of a table) follow plain Delete, and Alt held while clicking them gives the Alt behaviour.
- Locked children (REQ-024) are never destroyed by the cascade: they are reparented as with Alt, so that nothing locked disappears.
- Measurements that were attached to a destroyed thing or to a destroyed control point stay in the list marked broken, as today (they can be re-attached); the status line says how many became broken. Hidden dependents are destroyed by the cascade like visible ones.
- The status line says what happened: for example "Deleted 1 text and 3 control points that hung on it" or "Deleted 1 control point; 2 now hang on text Molino". A lone Alt press is cancelled around the key so that the browser menu does not take the focus (as in the drags).
- Tests: the cascade through a chain of three, Alt in the middle of a chain keeps the places of the children and gives them the grandparent, several selected, locked children survive, the buttons with and without Alt, one undo step, broken measurements counted.

**Open**
- Answered (the maintainer, 2026-11-07): plain Delete destroys the things that hang on the deleted one, and this replaces the earlier rule that they stay on the cloth centre; the old rule survives only as the Alt rule.
- The maintainer said on 2026-11-07 that it is good that with Alt+Delete the children of a deleted thing that has no parent get "the centre of the table" as their parent. The program has two such fixed points and, for each table, a placement point ("table centre"): the cloth centre (`world`, the one fixed point, which is also the old rule), the artwork origin (the pink diamond, a free point that never moves by itself), and the centre of one particular table (which would make the points follow that table when it moves or is resized). The assistant's default is the cloth centre. Answered: the cloth centre.
- The maintainer's check (2026-11-07): everything must stay on the cloth, the root of every chain must be the cloth. This holds by construction: texts, the lines and the hand are measured from the artwork origin, which is a point on the cloth; tables, guides and control points are placed from the cloth centre (a guide also from a table edge); every chain of control points ends at the cloth centre, the origin, a text or a table, and those are on the cloth. Nothing can hang on a measurement or a guide (the parent kinds are only the cloth centre, the artwork origin, a text, a table and a control point); a measurement is a leaf with one or two anchors. So the cascade of this requirement only touches control points. Side finding, not checked in a browser: `T.remove` in `js/tables.js` sets the reference of a guide that was measured from the edge of the removed table to the cloth centre but keeps its distance number, so such a guide probably jumps to another place; he asked on 2026-11-07 for the fix: when a table is removed, the distance of the guides that were measured from its edge is recomputed so that every such guide stays where it was (the new reference is the cloth centre). It is part of this requirement; the test removes a table that has a guide measured from its edge and checks that the guide has not moved.
- Whether measurements that depend on a destroyed thing should also be destroyed by the plain Delete (the assistant's default: no, they stay as broken, because they can be re-attached).

**Depends on:** REQ-023 (the Delete key), REQ-001 (the tree), REQ-024 (locked children).

## REQ-028 Right-click context menu: font, size, clone, clone to cursor, delete; Ctrl+D

Status: Built in V100 (see PROGRESS.md row 7br and CLAUDE.md). Built for texts and for the lines and cards (Hide); menus for guides, measurements, control points and tables are not built. Shift+click on clone to cursor puts a clone and stays in the mode (the maintainer: "Shift click directly").

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- With some selection made, a right click on a selected text element, or on a single text element, opens a context menu with the choices font, delete, size and clone.
- Font and size do the same as pressing F or S: the menu closes and the program goes on as if the key had been pressed.
- Clone makes a clone of all the text elements that are selected where he clicked. If nothing is selected and he right-clicks a text element, the clone concerns only that element.
- A clone is a new instance of the texts, with all the data the same, size and everything, except the place: it moves 10 % of the width of the element to the right and 10 % of its height down, so that it can be told apart. After the clone the cloned element is selected.
- Added later the same day: Clone gets the shortcut Ctrl+D. Next to Clone in the menu there is "Clone here" (or "Clone to cursor"): when he chooses it, ghosts of the elements appear under the cursor and follow it; when he clicks with the left button, the cloned elements are put there. The Clone button (it is in the toolbar, `cloneBtn`) does exactly the same as the Clone of the menu. The assistant's defaults (the one rule of the Clone button and the menu, the box of the whole selection for the offset, the order of the items, the right click that does not move) are accepted.

**Current state of the program** (checked in the source on 2026-11-07)
- The right mouse button pans: the stage handler starts a pan on a right press and `contextmenu` is only prevented (`app.js`). The program has a clone action (`actClone`) that puts each clone below its original, one height plus 10 mm down, directly above it in the layer list, and selects the clones; it resets the flags `gen`, `styleHidden` and `nameWord`, so a clone is the user's own text.

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- A right press that does not move more than about 4 px opens the menu on release; a right press that moves is still the pan. The menu is a small HTML overlay (like the font list), with `role="menu"`, closed by choosing an item, Esc or a click outside; arrow keys and Enter work in it; it shows the shortcut next to the item (F, S, Delete).
- What the menu acts on: when the clicked text is part of the selection, the whole selection; when it is not, the selection becomes that text first (the usual rule). A right click on empty space opens nothing. On things that are not texts (a table, a guide, a measurement, a control point, the lines and cards) only the items that apply are shown (Delete, which hides or deletes as in REQ-023).
- Font: the same function as the F key (REQ-019). Size: the same as the S key (REQ-026). Delete: the same as the Delete key (REQ-023 and REQ-027); Alt held while clicking the item gives the Alt behaviour. Clone: the same function as the panel's Clone, so there is one rule everywhere.
- Clone: every selected text gets a new instance (a new `uid`, the next free id, in the layer list directly above its original, `gen`, `styleHidden`, `nameWord` reset, unlocked, a frozen text keeps its outlines); the control points and the measurements of the original are not copied. The offset is 10 % of the width to the right and 10 % of the height down of the box around the whole selection (for one text, its own box), so that several clones keep their places relative to each other. The clones become the selection (the originals are deselected), one undo step, the randomizer is stopped first. With REQ-025 the panel of the topmost clone opens and scrolls into view.
- Locked texts (REQ-024): Font, Size and Delete are disabled with the reason; Clone works and the clone is unlocked.
- Tests: the menu opens on a right click and not after a right drag (the pan still works), the items and what they do, the selection rule, the clone offsets and the selection after it, one undo step, Alt on Delete, locked, Esc and the keys of the menu.
- Clone to cursor (the assistant's design): choosing it closes the menu and starts a short placing mode. The box around the selected texts hangs on the cursor by its centre and the ghosts follow it; a left click puts the clones there (one undo step, the clones become the selection, the mode ends); Esc or a right click cancels, and the ghost is hidden while the pointer is outside the stage. Snapping works as when moving (Alt or Ctrl switch it off) and the readout shows the place. The ghosts are faint real copies of the texts drawn at the pointer (boxes if that turns out too heavy). The mode has its own hint (REQ-014: click to place, Alt or Ctrl no snapping, Esc cancel). It is a tool like the others (`setTool`), so the toolbar buttons and the Esc key end it.
- Ctrl+D (Cmd+D on a Mac) runs the same Clone as the button and the menu, in the Select tool and with no field focused; the page stops the browser's bookmark action for the key. With no text selected the status line says so. The tooltip of the Clone button (it says "placed directly beneath its original") and the Keyboard topic of the help are updated, and the menu shows "Ctrl+D" next to Clone.

**Open**
- Answered (accepted defaults): the Clone button and the menu have one rule (10 % right and 10 % down of the box around the whole selection, one text: its own box); the order of the items is font, size, clone, clone to cursor, delete; the menu opens on a right click that does not move.
- Clone to cursor: answered and built in V100: the centre of the box around the selection hangs on the cursor; the ghosts are faint real copies with the bounding box shown; Shift+click places a copy and stays in the mode to stamp more (the maintainer's words "Shift click directly", read this way by the assistant; no correction came), a plain click ends the mode. (This bullet said "not asked for, default: no" before; corrected on 2026-11-07 after comparing with the reconstruction files.)
- Whether Ctrl+D is blocked in a real browser on every platform (the bookmark action of a browser may not always be stoppable); to be tried in a real browser, not testable here.

**Depends on:** REQ-026 (the S key must exist), REQ-019, REQ-023 and REQ-027 (Delete), REQ-024 (locked). Related: REQ-025.

## REQ-029 Rename the repository (20 name suggestions, none chosen)

Status: Idea. Recorded on 2026-11-07 from the reconstruction file of the earlier session (the discussion was not in this repository's documents before). Nothing is decided and nothing is changed.

**Said** (the maintainer, earlier on 2026-11-07, as summarised in the reconstruction file; translated)
- The maintainer asked for new name ideas for the repository `poker-table-designer`. The assistant gave 20 names in five styles (descriptive, short brand name, playful, local, acronym), each with an idea and a one-line English description; its three favourites were `baize`, `poker-table-cloth-designer` and `molino-studio`. Other examples that were named as fitting: `myllypoyta`. All 20 were free among his 28 repositories at that time (checked with the repository list, not with the API). He has not chosen any of them.
- Repository names are proper nouns: English first, Finnish words allowed when the context is local (rule of `ar-git-repo`, Mode 4).

**Implementation idea** (the assistant's, not decided)
- A rename is done by the maintainer in GitHub (Settings, Rename); a session cannot do it, nor set the repository description (both return 403 through the proxy; the description of this repository is empty).
- After a rename these places carry the old name and need a pass: the README (title line, "For use with AI" prompt, clone command, Live URL), CLAUDE.md (Live URL, repository conventions), the Artifact notes, the external-commit scripts of the sessions (the repository URL), and any local clones (`git remote set-url`). GitHub redirects the old git URLs, but the GitHub Pages address changes at once (`https://anttiraisala.github.io/<new-name>/`) and the old one stops working.
- The name of the program in the page title ("Poker Table Designer") can stay as it is; the repository name and the program name need not match.

**Open**
- Whether to rename at all, and which name. When (a rename between releases is easiest).
- An earlier summary also mentions a possible GitLab remote; no discussion of it is recorded and none exists. Whether the maintainer wants that is open.

**Depends on:** nothing.

## REQ-030 Housekeeping decisions waiting for the maintainer

Status: Idea. These are not features of the program; they are open decisions found when the two reconstruction files of the earlier sessions were compared with this repository on 2026-11-07. Nothing is changed.

**Items**
1. **Five failing checks in `tests/e2e-cutters.js`** ("default: two card lines are output", "upper line off: one line", "everything filtered out: a clear message", "keep position: the lower line keeps its place relative to the whole design", "only selected: a text is selected, the lines are not output"). The same failures exist since V92, the cause has not been investigated, and the release routine says not to release on red tests. Open: investigate before the next change of the cut export, or keep tolerating it (so far the maintainer has not answered).
2. **Stale lines in PROGRESS.md.** Milestone 5 still says "Done, booleans untested" and the Known gaps still say that halos are a union of shifted copies, although V78 replaced both with the bundled Clipper (exact round offsets, tested with the real Clipper). They were noticed at the start of the earlier session and never fixed because the maintainer did not decide. Open: fix them (a documentation change, only when asked).
3. **Other chats saw the list only up to REQ-009.** The maintainer reported that a second chat knew the requirements only up to REQ-009. The assistant's explanation was that the file is in git (21 rows on `origin/master` at the time) and that the other chat had read an older copy before the external commit was applied or used a cached clone. Idea (the assistant's, not decided): the start prompt in the README could say to fetch the newest `master` (a fresh clone or `git pull`, not a cached copy). The maintainer wants this file to be the memory that lets any new chat continue.
4. **The release routine and pushing.** CLAUDE.md step 5 says `git push`. The sandbox of the sessions has no GitHub write credentials, so since V98 every release was shipped as an external-commit package (a zip with `apply.sh`, built with `skills/ar-git-repo/tools/build-external-commit.sh` of the ar-skills repository, run by the maintainer, then checked with `git ls-remote` and the tree hash). The routine in CLAUDE.md does not say so. Open: add one sentence to the routine, when asked.
5. **This file and the RDD skill.** The skill `ar-requirement-driven-development` of the ar-skills repository uses the files `RDD-REQUIREMENTS.md`, `RDD-IDEAS.md` and `RDD-PROGRESS.md`. This project deliberately keeps its own `REQUIREMENTS.md` (ids, statuses, Said, Implementation idea, Open) and does not use the RDD files. Open: migrate to the RDD layout, or keep the two ways side by side. Nothing is done unless asked.
6. **PROGRESS.md "Planned" and "Ideas" lists.** Offered earlier to be moved here as numbered entries one at a time; not decided (see "Moved or listed elsewhere").
7. **Real-world facts** that PROGRESS.md still lists as open: mirrored (heat transfer) cutting, cutter model, dealer notch dimensions and whether the player-area line breaks at the dealer, margin at the press edge, licence of the Porcelain font. Unanswered.
8. **An unexplained message.** After the V100 push the maintainer sent the single letter "c"; the assistant asked what he meant and got no answer. If it was a command, it is lost.

**Depends on:** nothing.

## REQ-031 Split a multi-word text into one text per word

Status: Built in V102. Decisions: chain of clones with equal step (W/n, H/n); all pieces keep the name-word flag; locked and frozen texts are refused; a text with no measured box is refused with a reason; "Keep the original" is one setting (`keepOriginal`, default off) for both functions, not a check box next to the buttons; buttons are in the toolbar next to Clone, not in the text panel header.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- With one multi-word text element selected, he can split it: new text elements are created, one per word, each a clone of the original (everything the same) except its text.
- A Split function; he asked whether it belongs on the text element itself (a Split button) or in the main menu. Next to it a "keep the original" choice, default false.
- Join (REQ-032) is the opposite function.
- Answer to the worry about the places of the words (second message): there is no risk and it does not matter where the words land. How to build it, in his words: first make the list of the words that the split produces; then clone once and give the clone the first word as its text; then clone that clone and give it the second word; then clone that clone and give it the third word, and so on.
- Locked texts: the function is refused.
- Correction of the offsets (third message): the clone offset must not be the 10 % rule step by step (the first clone would move far, the later ones less). All the clones must move the same amount. Take the width and the height of the original text, divide each by the number of words, and use that as the offset of every step.
- The original keeps its flag `nameWord`. He then asked whether the name should be stored somewhere else instead: could the name simply be the name of the project, always read from there, so that splitting, joining and randomizing only affect the text elements and never the name itself? He asked the assistant to think it through. (Answer in the Implementation idea below: the name is already a project field and the flag only marks the texts.)

**Current state of the program** (checked in the source on 2026-11-07)
- A text has one `text` string, a `font`, `size`, `ls` (letter space), `rot`, the flags `upper`, `cap`, `capAll`, `frozen`, `locked`, `nameWord`, `gen`, `styleHidden`, and its own `uid`. It is one line; `x` and `y` are its position point. The clone code (`actClone` in `js/app.js`) already copies a text, resets `gen`, `styleHidden`, `nameWord`, `locked` and `uid`, puts the copy directly above the original in the layer list, moves it 10 % of the width right and 10 % of the height down (REQ-028) and selects it.
- There is no toolbar menu; the right-click menu (REQ-028) and the text panel header (clone and lock buttons) exist. The randomizer has a name style called "Split" (a different thing: it makes `gen` texts and hides the user's name texts).

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- The chain of clones as the maintainer described it: the words (pieces between spaces; punctuation stays with its word, "Devil's") are listed first, then a clone of the original gets word 1, a clone of that clone gets word 2, and so on. No measuring of widths is needed. Each clone sits directly above the previous one in the layer list, so the layer order is the reading order. The offset of every step is the same: (W / n, H / n), where W and H are the width and the height of the box of the original text (the box the stage measured, `ui.tbox`, read once before anything is changed) and n is the number of words (the maintainer's rule, replacing the 10 % step of REQ-028 for this function). With Keep the original off the original is word 1 in place and clone k (k = 1 to n - 1) sits k steps away; with it on, clone k (k = 1 to n) sits k steps away. The words form an evenly spaced staircase that never spreads further than the original box; the place of the words does not matter (the maintainer). A text with no measured box (hidden, or not drawn yet) has no W and H: refused with a reason, or a rough estimate from the size (to decide).
- Keep the original off (default): the original itself becomes word 1 (its text is changed, it keeps its place, its `uid`, its flags, its control points and its measurements) and the other words are clones in the chain. Keep the original on: the original is left untouched and every word is a clone (the first clone is word 1). This is the same reading as for Join and follows from the maintainer's description of Join.
- Where: the right-click menu (Split, disabled with a reason for a single-word, locked or frozen text) and a button in the text panel header next to Clone; no toolbar button (the toolbar is full). A key is not proposed (F, S, L and Ctrl+D are taken).
- One undo step; the new words become the selection (the original too when it is word 1) and the panel of the topmost opens (REQ-025).

**Open**
- The flag `nameWord`: the original keeps it (the maintainer). A clone resets it (REQ-028), so the chain would give mixed pieces. The assistant proposes that every piece keeps `nameWord` when the original had it (no other flag is carried): the randomizer name styles hide all flagged texts and put their own where the first flagged one was, so an unflagged piece would stay on the cloth next to the generated name. Split never writes `casinoName` (see below).
- Which name is "the name of the project": the project field `casinoName` (artwork part, default "Molino Royale"; the randomizer already builds its name styles from it) or the project's own name (`name`, the tab title, also "Molino Royale" by default). The assistant's answer: `casinoName`; joining the two would tie the tab title and file name to the design, and an artwork-only file has no project name. To confirm.
- Several texts selected: split every multi-word one (the assistant's default) or only when exactly one is selected.
- Frozen texts cannot be split (their outlines are not words): refused with a reason, as for locked texts (the maintainer's "lukitut: kielto" is read to cover both; to confirm).
- Whether the Keep the original choice is one Settings option (REQ-018) or a check box next to the button, and one for both Split and Join or one each.
- The name: the randomizer already has a name style "Split", so the function could be called "Split words" to avoid mixing them up.

**Depends on:** REQ-028 (the menu and the clone offset), REQ-025. Related: REQ-032.

## REQ-032 Join several texts into one, in reading order or selection order

Status: Built in V102. Decisions: selection order, reading order after an area selection; empty texts are skipped and removed with the others when Keep the original is off; control points move to the first text; locked and frozen texts are refused; the first text decides the name-word flag; hidden texts are joined too.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- The opposite of Split. Several text elements are selected, picked with Shift in a certain order; he presses Join. The program takes the first selected text element and clones it, then reads the texts of the other elements and adds them after it with spaces, as the text of the cloned element.
- Here too there is a "keep the original" choice, default false.
- Order when the selection has no click order (an area): reading order, top to bottom, left to right (decided).
- What happens to the control points and measurements that hang on the originals: the assistant's proposal is accepted (the control points move to the joined text and keep their place on the cloth; measurements attached to a removed text become broken).
- Where the joined text sits: if the first text is kept, the new text comes where a clone of the first text would come (the clone offset of REQ-028); the first text is cloned and the clone's text is changed to the joined text. If the first text is not to be kept, the first text itself gets the joined text as its new text and stays in place.
- Locked texts: the function is refused.

**Current state of the program** (checked in the source on 2026-11-07)
- The selection is `state.selected` (the first) plus `ui.extra` (the others, in the order they were added): it follows the order of clicks with Shift, but an area selection has no meaningful order and removing the first one changes which text is first. The layer list has its own order (`panelOrder`).

**Implementation idea** (the assistant's, not decided unless it follows from Said)
- Keep the original off (default): the first text is changed in place (its text becomes the joined text; its place, `uid`, flags, control points and measurements stay) and the other selected texts are removed; the control points that hung on them move to the first text and keep their place on the cloth; their measurements become broken. Keep the original on: nothing is removed; a clone of the first text (with the clone offset) gets the joined text.
- The joined text is the texts of all selected texts in the order of selection (reading order as the fallback for an area selection), joined with one space; empty texts are skipped. The fonts, sizes and colours of the other texts are lost; Undo brings them back.
- Same place as Split: the right-click menu (Join, disabled with a reason when fewer than two texts are selected, or one is locked or frozen) and the text panel header.

**Open**
- Hidden texts among the selected: joined too with a note (the assistant's default) or skipped.
- Frozen texts: refused with a reason, as for locked texts (to confirm).
- The same Keep the original question as REQ-031 (setting or check box, one for both or one each).
- Whether the joined text keeps `nameWord` when the first text had it (the same proposal as REQ-031: yes; with Keep the original off the first text is changed in place and keeps it by itself, with it on the clone is flagged by hand). Join never writes `casinoName`; the name field only changes through the randomizer's "change the words" or by hand. If texts are flagged but are not part of the first one, only the first text decides.

**Depends on:** REQ-028 (the menu and the clone offset), REQ-001 and REQ-027 (what hangs on the originals). Related: REQ-031.

## REQ-033 Glyph: a single-colour vector picture as an artwork element

Status: Built in V105 (2026-11-08). Decisions: a glyph is a frozen layer with `glyph: true`, shape in 1000 glyph units, `size` = height in mm, every copy carries its own shape (no shared definition); scale, turn, outline, group, lock, clone, export all work as for a frozen text. Built-in shapes: circle, diamond, heart, spade, club, star, chip from above, random scribble.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- An artwork element "glyph": a picture, single-coloured like a text, but a vector picture drawn from SVG. It can be moved, scaled and turned, and it can have the border (outline) like texts.
- A glyph is not one simple outline: a picture can have many separate islands (and holes). It must be filled shapes, like letters.
- A glyph can be up to about 1000 mm high; being a vector it must stay smooth at any size.
- A glyph used in a project must travel with the project (project export), even though the editor lives in the main menu.

**Current state of the program** (checked in the source)
- A frozen text already stores `frozen = {d, x0, y0, x1, y1}`: one SVG path string drawn with a palette colour; its outline (halo) is made in export with Clipper booleans. A glyph is nearest to this. Note that one `d` string can hold many sub-paths, so "one path" is only the storage form.

**Implementation idea** (the assistant's)
- A glyph is a compound shape (many sub-paths, holes by even-odd or non-zero) with a bounding box; the layer carries colour, outline, rot, x, y, uniform scale (mm), locked, hidden, group, uid.
- Glyph definitions stored once in the project (`artwork.glyphs`, by uid) and layers refer to them, so ten clones do not store ten copies.
- Export: curves flattened with a fine tolerance for Clipper (integer 0.001 mm units).
- Needs: stage drawing, handles, groups, clone, lock, hide, JSON round trip, undo.

**Open**
- A new layer kind or a text-like layer with a path (affects every place that loops over texts).
- Thin parts under the cut minimum (`thinMm`) warnings.

**Wording change wanted (maintainer, 2026-11-08; built in V106):** the button "+ Add shape" must read "+ Add glyph", and the program talks only about glyphs (no "shape" in button texts, headings or messages). The tooltip may explain: "Adds a ready-made shape, called a glyph, ...". The shape list and its label follow the same wording.

**Depends on:** REQ-008 (groups), REQ-016 (turning). Related: REQ-034, REQ-035.

## REQ-034 SVG copy and paste in and out for glyphs

Status: Built in V105 (2026-11-08). Decisions: strokes become filled shapes; several colours become one colour; white is the background and is left out; paste with Ctrl+V, the SVG text window, Copy as SVG, Save SVG file; no new JSON kind (glyphs live in the artwork layers).

**Said**
- Purpose: the maintainer can export glyphs from this program as SVG, open and save them elsewhere, and import such SVG back as a glyph.
- Strokes are not wanted as lines: everything must be filled shapes like letters.

**Implementation idea** (the assistant's)
- Import (paste or file): only shapes and paths are kept; transforms, arcs and basic shapes are converted to paths; many paths are merged into one compound glyph; gradients, text, filters, scripts and external links are dropped; viewBox normalised.
- Strokes are converted to filled shapes (the stroke width offset with Clipper) instead of being dropped (proposal; the maintainer said filled shapes).
- Export (copy and file save): the glyph as SVG, one fill colour.
- Standing rule: a JSON window part for the new kind.

**Open**
- Several colours in a pasted SVG: merge to one colour (default) or split into one glyph per colour.

**Depends on:** REQ-033.

## REQ-035 Vectorising engine: bitmap to smooth glyph shape

Status: Built in V105 (2026-11-08). The algorithm only; the window is REQ-036. Own tracer: levels, blur, Otsu, marching squares with sub-pixel edges, Schneider Bezier fitting, corner detection; parameters tol, cornerDeg, speck, threshold, grow, blur.

**Said** (the maintainer, 2026-11-07, translated from Finnish)
- Source images are expected to be high contrast: white background, black shape. Start from that.
- A setting for how small details are traced.
- The vector must not follow pixel edges; it must be a round, smooth shape. A glyph can be about 1000 mm high.

**Current state of the program**
- Text outlines are traced with marching squares and ring simplification (js/measure.js: `traceMask`, `simplifyRing`): pixel-stepped, so a base for the grid only. No network, no build step.

**Implementation idea** (the assistant's)
- Pure module (no page code, unit tested in Node): input grey or binary pixels plus parameters, output a compound path (cubic Beziers, holes and islands).
- Smooth tracing: sub-pixel contour by marching squares with linear interpolation on the blurred grey values (or on the binary image after upscaling), then Bezier fitting with corner detection (Potrace-like: polygon, corner threshold, curve optimisation). Own implementation: Potrace is GPL and cannot be bundled into this MIT repo; its method is public and the parameter names below follow it.
- Parameters (researched; the same set that Potrace, imagetracerjs and laser-cutter software offer): minimum speck area (Potrace `turdsize`), corner smoothness (`alphamax`, 0 = polygon, about 1.33 = no corners), curve tolerance (`opttolerance`, fewer segments against accuracy), turn policy for ambiguous pixels (internal default), threshold.

**Open**
- Warn when the source bitmap is small compared with the intended size.

**Depends on:** REQ-033 (the shape it produces). Related: REQ-036.

## REQ-036 Glyph editor window: image import, effect stack, live vector preview

Status: Built in V105 (2026-11-08). Decisions: the window opens from the Glyph editor button of the Artwork tab (not a menu); effects as researched below with ready values; effect values are kept in memory only; the picture is worked at 1200 pixels at most; SVG files skip the effects.

**Said**
- A window opened from the main menu ("Vectorize" or "Glyph editor"). The maintainer wants the assistant to find out which effects are needed to turn an image into a good glyph; sensible defaults must be on, so that the user drops an image in and immediately sees the vector result and can take it into use.
- A stack of effects (like a small Photoshop, not for drawing), then the vector, which can be zoomed to check it. Only the vector is kept in the project (agreed).
- The window is a program tool; the glyph it makes is project data (REQ-033).

**Researched effect list** (the assistant's; typical order of a tracing pipeline)
1. Flatten transparency onto white (PNG alpha is background).
2. To grey scale (luminance).
3. Levels or contrast: automatic stretch of the histogram, then manual brightness and contrast.
4. Blur ("smudge"): a light Gaussian blur removes JPEG blocks, noise and anti-aliasing steps and gives the tracer a smooth edge to follow.
5. Threshold: automatic (Otsu) by default, with a slider; Invert (automatic when the corners of the image are dark, so the shape is always the dark part).
6. Clean-up: remove specks (small islands), fill small holes, optionally thicken or thin (dilate or erode) to make thin parts cuttable.
7. Crop and mirror (later).
- The tracing parameters of REQ-035 sit next to the stack: Detail (speck size), Smoothness (corners), Accuracy (curve tolerance).

**Default behaviour**
- All defaults are on when an image is dropped, scaled to the image size, and the vector result is shown at once over the bitmap. The user only moves a slider if the result is wrong. Dropping a ready SVG skips the stack (REQ-034).

**Implementation idea**
- Non-destructive stack (each effect on or off with its value), working on a downscaled preview for speed and on the full image for the final trace.
- Preview: side by side or overlay, with zoom and pan; shows the speck count and the smallest feature in mm at the chosen glyph size.
- File open and drag and drop for JPEG, PNG, WebP, GIF, BMP (whatever the browser reads), and SVG.
- Result: "Use" creates the glyph definition in the project and one glyph on the cloth.

**Open**
- Where the "Use" result lands (centre of the visible area, as for new texts).

**Depends on:** REQ-033, REQ-034, REQ-035.

## REQ-037 Arrow keys change a focused slider

Status: Agreed (2026-11-08), waiting for the go-ahead. Nothing implemented.

**Said** (the maintainer, 2026-11-08, translated from Finnish)
- The sliders in the glyph editor (Vectorize) must move with the arrow keys: left and right change the value, up makes it bigger, down makes it smaller. (He first added "also in fonts, any vector graphics" and then took it back; what is wanted is that the sliders can be adjusted.)

**Current state of the program** (checked in the source)
- A browser slider already does this by itself when it has the focus. In this program it does not work, because the global key handler of the stage (`js/app.js`, the arrow nudge) treats an arrow key as "move the selection 1 mm" unless the focus is in a text, number, search or select field (`isTextField`); a slider (`input type=range`) is not on that list, so the arrow key moves the selected glyph or text behind the window and the browser's own slider step is cancelled (`preventDefault`). This hits every slider of the program (the panels too), not only the glyph editor.

**Implementation idea** (the assistant's)
- Add `range` to `isTextField` (or a separate rule: a focused slider owns the arrow keys, Page Up and Page Down, Home and End). Native behaviour: Left and Down decrease, Right and Up increase by one step, Page keys by a bigger step. Shift for ten steps is optional.
- A side effect to accept: after a slider has been dragged with the mouse it keeps the focus, so the arrow keys change the slider until the user clicks the stage again (then the 1 mm nudge works as before).

**Decided** (maintainer, 2026-11-08): Shift plus an arrow key changes a slider by ten steps.

**Related:** REQ-036.

## REQ-038 Glyph editor: inside and outside made obvious

Status: Agreed (2026-11-08), waiting for the go-ahead. Decided: the highlight is ON by default; the "Swap inside and outside" button is wanted. Nothing implemented.

**Said** (the maintainer, 2026-11-08, translated from Finnish)
- In the vectorising editor it must be self-evident which part is the inside (the shape) and which is the outside. First a help text.
- The "Vector only" view is not enough: give it quick options: black and white, and a colouring that shows how it looks on the poker table (the assistant judges what that is).
- A check box "Highlight shape (inside)": when it is on, the area inside the vector changes colour a little, to a pale, transparent, dark-blue tint, and a slow moving diagonal hatching runs over it. It is there to show what is inside and what is outside.

**Current state of the program**
- The preview shows the picture (or the picture after the effects) with a thin red outline and a faint red fill over the shape, or the vector in black ("Vector only"). The choice "Shape is" (automatic, dark, light) is the usual reason for a wrong result: the automatic choice can take the wrong part as the shape, and nothing says plainly which part counts.

**Implementation idea** (the assistant's)
- Help text above or under the preview: "The tinted, striped area is the glyph, the vinyl that stays. Everything else is background and is cut away. Holes inside the glyph are background too." The info line repeats which part is the shape ("the light part is the shape" already appears when inverted).
- Vector view presets, as a small choice next to the modes: Black and white (black shape on white, what a cutter sees) and On the table (the shape in the colour of the glyph, gold by default, on the cloth colour, with the outline halo of the glyph shown as it will cut). Both draw the same vector path.
- Highlight inside: an SVG pattern of diagonal lines (animated slowly with a transform of the pattern, still when the system asks for reduced motion) and a translucent blue fill on the vector path with the even-odd rule, so holes stay unhighlighted. It applies in all three views, replacing the red tint. Next to it a button "Swap inside and outside" (the same as the "Shape is" choice) so a wrong guess is fixed on the spot.

**Open**
- On a green cloth a dark blue tint has low contrast: the hatching lines should be light (white) over the blue, to be checked on the real colours.
- Speed of the hatching and whether it pauses when the pointer is still (a large path repaints on every frame).

**Depends on:** REQ-036.

## REQ-039 The box of a text ends at its last letter

Status: Discussed (2026-11-08). Nothing implemented.

**Said** (the maintainer, 2026-11-08, translated from Finnish; with a screenshot of the text "C A S I N O" with a wide letter space)
- The selection box of a text starts right next to the first letter (C) but continues as empty space after the last letter (O). Why? Can it be cut right after the last letter?

**Current state of the program** (checked in the source)
- The box comes from the browser: `t.getBBox()` of the SVG text element (`js/app.js`, drawArtwork and the code that fills `ui.tbox` and `ui.bounds`). The browser adds the letter space after EVERY character, the last one too, so the box is one letter space wider on the right than the visible letters. The same fact is already recorded for the outlines (V81: "the letter space is added after every character including the last and the whole run is centred, so the text sits half of it to the left of its anchor, exactly as on the stage"). With a letter space of 160 mm the empty strip is 160 mm.
- The box is used by: the dashed selection box and the click target, the resize handles (REQ-013), the box of a group, snapping to the edges of other items, alignment (REQ-002) and its zones, area selection, the Split step (W/n, H/n) and the Clone offset (10 % of the box).

**Implementation idea** (the assistant's)
- Phase 1: when the box is measured, take the trailing letter space off the right side, in the text's own frame before the turn: right edge = bbox right minus `ls` (works for a negative `ls` too, and for the bigger first letter). Only the measured box changes; the drawing, the cut export, the anchor `x` and the meaning of "Centre X" stay as they are, so no saved design moves. The browsers' behaviour must be checked: Chromium includes the trailing space (the screenshot); Firefox and Safari are not tested here, so the rule must be verified or the trailing space measured from the last character instead of assumed.
- Phase 2 (only if wanted): the exact ink box (the real left and right edges of the letters, without side bearings) from the outlines (`traceLive` or the font outlines). More exact for aligning, but costs a trace per text on every redraw.

**Open**
- Consequences to accept: texts with a letter space get a narrower box, so the handles, snap edges and aligned edges land on the letters; alignments made earlier are not saved, so nothing changes in files; the box centre is half a letter space to the right of the anchor `x`, because the anchor is the centre of the run including the trailing space (the panel says "Centre X"; the drawing stays as it is).
- Phase 1 only, or phase 2 as well.
- Whether to also move the drawing so that the visible letters are centred on `x` (not recommended: it moves every text that has a letter space in every saved design).

**Related:** REQ-013, REQ-002, REQ-031.

## REQ-040 Shortcut for hide and unhide

Maintainer (2026-11-08): hide and unhide need a shortcut. Ctrl+H opens the browser's History, so it is a poor choice, though the page may still catch it. Proposal: plain H toggles hide on the selection, the same way L toggles lock (outside text fields). Decided: the first selected decides and all others get the same; Shift+H shows everything hidden. Built in V109.

## REQ-041 Exact centring under letter space

The browser adds the letter space after the last letter too and centres that, so the visible text drifted left by half the letter space growth. New texts have the layer flag `exact` (drawing shifted by ls/2, outline and traced ink centred without the last letter space); saved data without the flag keeps the old centring; the text panel has the tick "Centre exactly" to switch it per text.

## REQ-042 Select by what is drawn, not by the bounding box

Maintainer (2026-11-08): a click should first test whether it hits a line or the inside of a drawn area (the pixels of a text, a glyph, a stroke), and select that. Selecting by bounding box works badly.

**Today:** every text and glyph gets one invisible rectangle (its box, turned with the text) that catches the pointer; the topmost box wins in the stack order, so the empty corners of a box steal clicks from what lies under or beside it (a rotated or wide text over a small one).

**Analysis (for the discussion):** (1) Ink hit: texts and glyphs have exact vector outlines when frozen, and traced rings (`measure.traceLive`) otherwise; a click inside a ring (even-odd) or within a few screen pixels of its edge counts as a hit. Thin letters need the tolerance (about 6 screen pixels) or they are hard to hit. (2) Order: ink hit of the topmost thing wins; if nothing is hit by ink, fall back to the box of the topmost thing, so a click in a gap between letters of a wide text still selects it. (3) Cost: ring tests per click are cheap; the rings can be cached per layer like the measure cache; during hover (cursor feedback) test only after the pointer rests. (4) Open: should a click inside the counter of an O select the text? (proposal: yes, within the box when nothing else is hit.) Should lines and cards and tables follow the same rule? (they already hit by their strokes.) Also the marquee and Ctrl+A keep using boxes.

**Status:** Discussed, not decided how to treat the gaps between letters.

## REQ-043 Carry bag designer (far future)

Maintainer (2026-11-08): the finished table needs transport. Under the cloth goes foam (about 10 mm). The foam and cloth are rolled, the cloth folded in between, straps hold it. A later add-on could design a tube bag that fits the rolled set exactly, and say what to buy (fabric, zip or drawstring, straps) with the pattern pieces. Packing idea: lay the foam flat on a table or floor, fold the cloth onto it, lay the straps, roll it up, slide the tube bag over it from one end.

**Critical notes for later:** (1) The roll diameter is the whole point: it depends on the cloth size, the foam thickness, the cloth thickness and how tightly it is rolled, and the fold across the roll. The design must be a formula (spiral length for a given thickness) with a safety margin of some percent because a hand roll is looser. (2) The cloth must be rolled with the print on the outside or inside: say which (creases and folds can damage a printed face). (3) Straps and bag opening: a tube open at one end needs a closure at the other end to not slide off; a zipped or drawstring end is easier to use than a fully closed tube. (4) The bag pattern is a rectangle for the body plus two discs or a gusset; seam allowances, fabric width and fabric shrink need to be inputs. (5) The program should keep this as a separate tab, not mixed into the cloth design; the inputs come from the project (cloth size) plus a few numbers (foam thickness, cloth thickness, extra items such as chip cases). (6) Far future; no action now.

**Status:** Idea.

## REQ-044 Procedural glyphs (idea)

Maintainer (2026-11-08): one kind of artwork could be a procedural glyph: its outline is calculated, not drawn. Examples: foliage, leaves and twigs growing around a guide or around the table edge; two bands that wind around each other (an interlace); corner ornaments of the table that change shape when the table size changes; on a round table the pattern is divided evenly along the edge. The user must be able to set the maths with parameters; there should be ready-made pattern types that can be edited. When guides or sizes change the shape is calculated again. The interlace needs the over-under effect with a gap where the band that is below passes under the one above.

**Names:** the over-under effect is called interlace (or weave, as in Celtic knots); the gap that makes a band look as if it passes below is a knockout (also called a halo or gap outline): the upper band is drawn with a wider outline in the background colour.

**Critical notes for later:** (1) The result must still be one flat vector shape per colour for cutting: the knockout means the lower band is physically cut in two pieces (the gap), so the generator must output real geometry (boolean difference with Clipper), not a drawing trick. The same Clipper engine that glyphs use can do it. (2) A recipe is a small program: the safe way is a fixed set of generator types with numeric parameters (path source, spacing, size, randomness seed), not user-written scripts; scripts can come much later in a sandbox. (3) Randomness must be seeded and stored, otherwise the foliage changes at every recalculation. (4) Path sources: a guide, a table outline, a straight line, a circle; a path gets an arc-length parametrisation, which is also what makes even division on a round table possible. (5) Speed: recompute on drag only at coarse quality and exactly on release; cache by parameters. (6) Collision: growth that must stay inside the cloth or avoid texts needs a rule (clip to cloth by Clipper, or skip pieces that hit a keep-out area); decide before building. (7) Save only the recipe and its parameters, never the computed shape, so the file stays small and editable. (8) Build order proposal: a repeat-along-a-path generator first (a glyph repeated along a guide with spacing, scale and turn), then corner ornaments, then foliage, last the interlace.

**Refined architecture (discussion 2026-11-08, maintainer + research):**
- *Hidden model, flat output.* A procedural element keeps a hidden model (strands, tiles, branches with a depth order) and, on every change, renders it to flat vector regions per colour. The gap (knockout) is applied to that rendered output, with the same Clipper difference that glyphs and the cutters already use. A full 3D model (an angel wing as a mesh, hidden-line projection) is judged too heavy: a 2.5D model (shapes with a depth order) is enough for interlace, foliage and ornaments.
- *Path source as an object.* A path is a reference to existing geometry (table edge, player-area line, a drawn guide curve) with an offset, parametrised by arc length. The element stores the reference, so a change of the table or guide recomputes it. This is the same idea as Illustrator pattern brushes and Inkscape Pattern Along Path.
- *Tiles.* The Illustrator brush has five tiles: side, outer corner, inner corner, start, end, and the fit modes stretch-to-fit or add-space-to-fit. A closed outline needs a whole number of repeats so the phases meet; the fit mode decides who gives way. Corner tiles can be auto-made (centred, between, sliced, overlap).
- *Interlace.* Known method (Bain, Cromwell): a grid with breaks, the strands follow the medial graph, and the over-under is set by a checkerboard rule, so it alternates along every strand. Along a path it is a braid of N strands with an integer number of crossings (stretch to fit).
- *Foliage.* Seeded branching (an L-system or a particle growth), leaves instanced at points of the twig; the seed is stored.
- *Gap under any element.* The knockout is useful alone: any element can cut a gap of a set width out of everything below it (real geometry, not a background-coloured outline). Proposed as the first step because it needs no generator.
- *Bake to glyph.* A procedural element can be baked to a plain glyph (frozen shape) to stop recalculation and to edit by hand.
- *Cutting limits.* The generator warns when a gap or a strand is thinner than the cutter or vinyl allows; closed loops and node counts are checked.
- *Proposed build order:* (1) gap under any element, (2) path source + tile repeated along a path (covers the running dog, the Greek key, corner ornaments, the border band), (3) interlace braid, (4) foliage, (5) no 3D.

**Status:** Idea.

## REQ-045 Order items in the right-click menu

Built in V112: Bring to front, Bring forward (one step), Send backward (one step), Send to back; they work on the whole selection (the selected things keep their order among themselves; a group moves as a block) and on the lines and cards.

## REQ-046 Path object and REQ-047 Pattern element (discussion 2026-11-08)

Maintainer's model: a **path** is not visible itself; graphics are generated along it. Open or closed. Types: circle, polygon, lines in a row (one or many) with optional rounding at each node, later a Bezier curve with control points; also derived paths: the table outline, the player-area line, the rail. A closed path has a start point and is parametrised 0 to 1 (0 and 1 coincide, a full turn is 2 pi). Positions along it are either **relative** (a count per turn, degrees) or **absolute** (every N millimetres). A **pattern element** sits on a path and holds a **stack** of generators drawn bottom first (the first is drawn first, the last on top). When the stack is drawn, an optional outline (halo) is computed for the whole result. Each generator has its own line thickness, size and options; one option is a plain line of a given thickness. Generators to start with: plain line, sine wave, running dog, interlace. Random ones (branches with leaves) have a stored seed. On a closed path the side must be chosen (inside or outside) with a distance (a float, signed); on an open path the pattern may simply end where the path ends. For continuous patterns: the number of repeats (relative) or the length of one repeat (absolute); the pattern must fit so the phases meet.

**Critical notes and proposals (analysis):**
1. *Reuse the table outline model.* Tables already have outlines of lines and arcs with nodes, a node editor and geometry functions. A path with the same node model (lines, arcs, rounded nodes) covers the circle, the polygon and the polyline with no second editor; only a path kind "reference" (read-only) is new. Bezier later.
2. *The pattern element is a layer in the artwork stack* (so it can be ordered against texts and glyphs): same idea as a glyph, a layer whose frozen shape is a cache recomputed from a stored recipe (path reference, stack, parameters). Stage, export, measure and hits then reuse the glyph code. Move and scale handles do not apply (it follows the path).
3. *Three different gaps must not be mixed:* (a) the internal knockout of the interlace (belongs to that generator); (b) the halo around the whole stack result (as asked: computed last); (c) an optional gap between stack layers (a layer cuts a gap into those below). (c) is not in the maintainer's model; offer it as a per-layer option, off by default.
4. *Corners.* On a path with sharp corners a continuous pattern (a wave) can fit the whole path (one count) or each side separately (a count per side, so each side begins and ends the same way). Both are needed: per side looks right on a rectangle, the whole path on a circle. Rounded nodes make the corners easy.
5. *Direction.* An open path has a direction (reverse button); left and right of it must be defined; a closed path is normalised so inside and outside are not mixed up.
6. *Absolute spacing on a closed path* must be rounded to a whole number so the phase meets: the setting is "about N mm" and the real value is shown.
7. *Same colour overlaps* merge (union); different colours stay separate cut layers as for texts.
8. *Cost.* Recompute at coarse quality while dragging, exact on release; cache by parameters; warn when a gap or strand is thinner than the cutter allows.
9. *Saving.* A new kind in the project JSON (paths, pattern elements, recipes); the JSON window needs a part for it.
10. *First version proposal:* paths (circle, polygon, lines with rounded nodes, references to table outlines), pattern elements with a stack of plain line, sine wave, running dog (a scroll of curls), interlace (two strands); seed and branches later; Bezier later.

**Decisions (maintainer, 2026-11-08):**
1. The gap between stack layers (3c) is included as a per-layer option, off by default. It works on the union geometry: all layers are drawn on top of each other, the union of them is the final geometry, and the halo of the whole stack is computed from that union.
2. An open path has a direction; a button reverses it; left and right are defined by it. A closed path is normalised (inside and outside fixed) and the same button turns it round.
3. Absolute spacing on a closed path (for example every N mm on a round edge) is allowed even when it does not meet: **a switch** lets the user choose "fit to a whole number" (phases meet) or "exact spacing" (the last piece may not meet the first). Relative spacing (a count per turn, degrees) always meets.
4. Path types to start with: circle, polygon, lines in a row (one or many) with rounding at each node, and the two-ended or closed forms of these.
5. Generators to start with: plain line (a given thickness), sine wave, running dog, interlace. The interlace has a setting for the **number of strands** and the **thickness of the strands**, so it can also be a braid.
6. The path uses the node model of the table outline (see below) and is extended with Bezier segments.
7. Corners: a continuous pattern is repeated either per side or over the whole path (the user chooses).
8. Everything is parametrised with sliders (thickness, size, count or length of one repeat, side and distance, seed for random patterns).

**What the table outline supports today (checked in tables.js):** a table keeps nodes with x and y; the segment after a node is a straight line or a circular arc (a bulge value b per node, arc angle = 4 atan b). The corner roundings of the presets (rectangle with corner radius, stadium, octagon with cut corners, circle, notch) are made as arc nodes by the preset generator; there is no free "round this node" setting per node and there are no Bezier segments. So for paths three things are new: (a) a per-node corner radius that makes the arc nodes itself, (b) a Bezier (cubic) segment with two control handles, (c) the editor for the handles. The arc-length parametrisation of a Bezier is done by flattening it into short lines (the tolerance 0.05 mm of the cutters).

**Status:** Built in V113 (path kinds circle, polygon, lines with node rounding, table lines, objects; generators plain line, sine wave, running dog, interlace). Not built: Bezier nodes, branches and seed, dragging nodes on the stage.

## REQ-048 Path from objects (discussion 2026-11-08)

Maintainer: select some objects (perhaps a group); the program makes a path along the outer edge of them, at first a rounded path, and patterns can then be put on it (REQ-047). It must stay dynamic: when the objects change, the path and its patterns are recomputed. It must also work when the objects are themselves procedural (a pattern element): make a pattern, make a path around it, put another pattern on that path. A circular reference must be refused. Option: the path respects the halo of the objects, or does not, or is not attached to the objects at all.

**Analysis and proposals:**
1. *It is one more path source.* Path sources: table outline, player-area line, rail, a drawn path (REQ-046), and now "outline of objects". All give the same thing, a list of loops, so the patterns do not care where the path came from. A derived path is drawn as a thin dashed line only when selected, like other helpers.
2. *How the outline is made.* Take the shapes of the selected objects (the rings of texts and glyphs, the geometry of groups and pattern elements), unite them (Clipper), keep the outer contours. Parameters: a signed distance (positive = outward), a closing radius (offset out and back, so narrow notches and gaps between letters close and the outline is smooth), rounding (round joins), and what to do with several islands: each island has its own loop, or one merged loop (a larger closing radius), or the convex hull, or a rounded bounding rectangle or ellipse as a cheap choice. Holes (the inside of an O) are ignored by default, with a switch to keep them.
3. *Dependency graph.* Objects depend on paths, paths on objects: this is a graph that must have no cycle. It is calculated in dependency order and cached, with a "dirty" mark on whatever changes. A cycle is checked when the link is made and also when an object is moved into a group that feeds a path (the move is refused with a message that names the chain). An allowed chain: pattern A on path 1, path 2 around A, pattern B on path 2.
4. *Halo.* A halo belongs to the geometry of the source: a path around an object does not know it unless told. Three states per derived path: (a) follow the ink only; (b) follow the ink plus its halo (the path is moved out by the halo width, so a pattern keeps outside the halo); (c) detached (frozen): the loops are stored as a plain path and no longer follow the objects. The evaluation order puts the halo of the sources first, which the dependency order gives for free.
5. *Corners.* A derived outline has no "sides": it is many short segments. The pattern mode "per side" therefore does not apply; the default is the whole loop. Later, sides can be found by cutting the loop at sharp corners.
6. *Accuracy of text outlines.* Exact outlines need the font file (an imported font, or text frozen to a shape). A live text without a font file is traced from pixels (rough); the path is then rough too, and the program says so.
7. *A missing source.* When a source object is deleted the path keeps its last loops and is marked "source missing"; one click freezes it.
8. *Speed.* While dragging an object the path is recomputed at coarse quality (large tolerance), exactly on release.
9. *Stored as* a list of stable ids (the uid of texts and groups) and the parameters, never the loops (except when frozen).

**Status:** Built in V113 (see CLAUDE.md, Paths and patterns). Not built: coarse recompute while dragging (the shape is made again exactly on every change), a dependent group move check (patterns cannot be put in groups, so that cycle cannot occur).

## Moved or listed elsewhere

When the maintainer wants, the "Planned" items of PROGRESS.md (menu tidy-up, EPS later, more examples, players with several visible tables, guided workflow, word packs and others) and the "Ideas" and "Brainstorm" lists can be moved here as numbered entries, one at a time, with their status. Until then they stay where they are.

## REQ-049 Pattern stack with operators (discussion 2026-11-08)

Maintainer: the path should be only a parameter of a generator, so one pattern can use several paths. The generators form a stack (bottom = base). Operators work on the stack: union (of n items), subtract (the item below minus the top), intersect (of two or more), perhaps negate; each pushes its result. What the stack holds when the operators end is the answer. Some items may instead modify the path below them (adding a figure to it).

Notes from the discussion: (1) this is CSG in postfix form; the V113 stack is the special case with only implicit union, and "gap to layers below" is a subtract in disguise. (2) Items need two types, shape and path, so a path-modifying item takes a path and pushes a path, a generator takes a path and pushes a shape, and "outline of a shape" (REQ-048) takes a shape and pushes a path. (3) Negate is kept, as the universe minus the shape; the universe is a parameter of the negate row (maintainer's idea: the table-shaped area, so nothing is infinite). Choices to offer: a closed path (a table outline included), or the box round everything on the stack plus a margin. (4) The end rule must be decided: the top item only (his wish, but forgotten layers vanish), or the union of everything left (keeps V113 patterns unchanged). (5) The editor should show the postfix as a readable list, an operator row saying "Union of the 3 above" with the consumed rows marked, and moving a row moves its operands. (6) Evaluate by prefix with caching so editing the top does not recompute everything.

**Status:** Discussed, not built.

**Node graph version (maintainer, 2026-11-08, later the same night):** instead of a postfix stack, a node network like Blender's, one per pattern. A source node gives the original path; path nodes change a path with all their parameters; generator nodes turn a path into geometry; union and AND/OR style nodes take any number of geometry inputs; subtract and intersect take two; negate takes one; an output node is where the result goes. By default the path node is wired straight to the output, so the pattern is just the path. Notes: the graph is the general form of the stack (it adds reuse: one path feeding several generators, one result used twice); the output node settles the end rule (what is wired to it is the result, loose nodes are ignored and shown grey); ports are typed (path, shape) and a wrong connection is refused; the graph must be acyclic and the existing cross-pattern cycle check stays; the V113 stack migrates as a chain path, generators, union, output; the heavy part is the editor (canvas, wires, drag, zoom), the model and evaluation are small; parameters stay in a side panel for the selected node at first; click a node to preview its output. Open: one graph per pattern layer or a global graph; whether paths stay global objects (a reference node) or are only nodes.

## REQ-049 to REQ-052 The procedural graph (discussion 2026-11-08, replaces the stack notes above)

Maintainer's decisions: one shared graph for the whole project; the path is not a global object but a parameter inside a source node of the graph; the effects (foliage, braids, interlaced bands and so on) are nodes; the first version is Source (path) -> geometry node -> Target, where the geometry node turns a path into a closed shape (a line with thickness) and has a halo control; some parameters can be exposed outside the graph so that they show in the normal panel.

**Critique and counter-proposal (assistant):**
1. *One graph for all plus the path living inside the clip need one reading to agree:* a source node holds the path data; sharing a path between two patterns is done by wiring that source node to two chains, so no reference node and no global path list are needed. Each output node is one layer of the artwork stack (the "procedural clip").
2. *The halo belongs to the output (the layer), not to a geometry node.* A halo only matters as "knock a hole in what lies below" and that is decided once, on the final shape, as for a text. A halo-like effect inside the graph is an Offset node (grow or shrink a shape), which also covers "gap to layers below". The layer panel keeps the halo controls.
3. *A path has no area,* so an output that receives only a path draws and cuts nothing; it is shown as a thin dashed helper line when selected. The Stroke node is what makes a path into a shape.
4. *Exposed parameters:* each parameter has a pin; the pinned ones are listed in the panel of every output layer that lies downstream, with a label (renamable) and a slider range stored with the pin. A node that feeds two outputs shows the same value in both, marked "shared". The values live in the nodes; the panel only edits them (one undo step each).
5. *Size and cost:* evaluate only what lies upstream of an output; cache by node signature (parameters plus input signatures); Clipper runs only when something upstream changed. One canvas for the whole project gets crowded, so the editor can filter to the selected layer's subgraph and dim the rest.
6. *Cycles:* the graph itself is acyclic (a wire that would close a loop is refused); the nodes that read layers (outline of objects, later a stamp) also depend on other layers, so the existing cross-layer check stays and names the chain.
7. *Migration:* the V113 paths and patterns convert to source node -> generator nodes -> union -> output node (small, mechanical); the old `artwork.paths` and the layer `pattern` recipe are read once and written as the graph.
8. *Stamp idea for later:* a node that takes a text, glyph or pattern layer as a shape and places copies of it along a path (leaves, beads); this ties the graph to glyphs.

**First version (agreed shape of it):** graph model and evaluator, source nodes (the five path kinds), Stroke (thickness, round or flat), Union, Output, exposed parameters in the layer panel; the graph is edited from a list view of the chain of the selected layer (the model is a graph from the start, the canvas comes later). Then the canvas (REQ-052), then generators, booleans, Offset, Negate and the foliage.

**REQ-050 Node library.** Sources: circle, polygon, lines with rounded nodes, table line, outline of objects (REQ-048), later layer stamp. Path modifiers: Offset path, Round corners, Trim (start and length), Wobble, Reverse. Shape makers: Stroke, Sine wave, Running dog, Interlace and braid (strands, strand thickness), Foliage (seed, branches). Shape operators: Union (any number of inputs), Intersect (any number), Subtract (A minus all others), Xor, Offset (grow or shrink), Negate (universe minus shape; the universe is a parameter: a closed path such as a table outline, or the box round the input plus a margin). Random nodes carry a seed.

**REQ-051 Exposed parameters.** As in note 4. The pin is a small button next to a parameter in the node panel. Open: whether a pinned parameter can be driven by a number node later (not now).

**REQ-052 Node editor.** SVG canvas in the Artwork tab or a window: nodes with typed ports (path and shape in different colours), wires by dragging from a port, a wrong type is refused with a reason, move, delete (with its wires), a node panel for the parameters of the selected node, click a node to preview its output on the stage, a filter to the selected layer, zoom and pan.

**Status:** Discussed, not built.

**Answers of 2026-11-08 (maintainer):** halo only on the output plus an Offset node inside the graph: accepted as described (an Offset node grows or shrinks a shape by a distance; with a positive value it makes a fat copy that can be subtracted from something else, which is the "gap to layers below" and a halo-like ring). An output that receives only a path shows that path as a line; whether such a path is also exported as a cut line is open (default: not cut). He can also just edit a path and let another item use it, which the wiring already allows. The conversion of V113 paths and patterns into the graph: decided by the assistant (convert, it is small).

## REQ-053 Splitter between the stage and the side panel (discussion 2026-11-08)

Maintainer: between the drawing area (the table) and the tool panels on the right there should be a splitter that can be dragged. Moving it makes the stage smaller and gives the panels more room; it helps most when the procedural graph is shown. It can be built before the graph.

Notes: a vertical bar (`role="separator"`, pointer drag, arrow keys move it, double click resets, Esc during a drag cancels as every drag does through `startDrag`); minimum widths for both sides; the stage must refit when its size changes (check how the stage learns about it); the width is a view setting of the user, saved in the settings file, not in the project, and an Options-style default; the graph editor would also want height, so later an optional bottom dock with a horizontal splitter, or a wide mode that the graph switches on while it is open. The hint line and the drag readout apply.

**Status:** Discussed, not built.

**Answers of 2026-11-08 (maintainer), later:** an output that gets only a path draws it as a helper line and it is NOT cut; later a per-path choice for exporting it as a cut line in the SVG may come, but not now. Saved V113 paths and patterns may be forgotten: there are no old files to keep, so no conversion into the graph is needed (this replaces the migration note in REQ-049).

## REQ-054 Dockable work areas (discussion 2026-11-08)

Maintainer: the window is made of the top menu, the work area with the cloth picture (the stage) and the text line under it, and the panels on the right. They should all be tool windows (panes) whose size can be set, like in other editors; when the graph editor comes it can open between the stage and the panels. The splitter of REQ-053 is the first step.

Notes and counter-proposal: (1) Three levels. Level 1 is REQ-053, one vertical splitter. Level 2 is a layout tree with a fixed set of panes (stage, side panel, hint line, graph editor) and splitters in both directions, each pane with a collapse button and a maximise button (double click on its header); the graph editor opens as a pane of its own. Level 3 would let the user drag panes to other places, tab them together or float them; that is a large piece of work with little gain for one user, so it is not proposed. (2) Build the splitter in REQ-053 as a reusable component (two panes, direction, minimum sizes, an id for saving, keyboard and pointer, Esc cancels), so that level 2 only adds panes. (3) The graph editor wants width and height and the stage should stay visible for the node preview, so the default place is a bottom dock under the stage, with a horizontal splitter and a maximise toggle; a column between the stage and the side panel can be a layout choice later. (4) The layout is a setting of the user (settings file), not of the project, with a Reset layout button. (5) The default layout is exactly today's, so the existing browser tests that read the stage keep working. (6) A narrow window needs a fallback (the side panel collapses to a drawer). (7) The glyph editor and the JSON window stay modal windows; they are not panes. (8) Splitters get `role="separator"`, `aria-valuenow` and arrow keys.

**Status:** Discussed, not built.

## REQ-049 to REQ-052 as built in V115 (choices made while implementing)

Built without questions, as the maintainer asked; every choice below can be reversed. Files: `js/graph.js` (engine, tested in Node by `tests/graph.test.js`), `js/pathsui.js` (panel and editor), browser test `tests/e2e-graph.js`.

1. **Data.** `artwork.graph = { nodes: [{ id, type, x, y, p, exp }], wires: [{ from, to, port }] }`, one graph per project. `p` holds the parameters of the node (a source node holds a whole V113 path object: kind, reverse, start, circle or polygon numbers, lines, table, objects). `exp` lists the pinned parameters (key, label, slider min and max). A pattern layer has `pattern = { out: id of its Output node }` and caches its shape in `frozen`. The V113 `artwork.paths` and the old stack recipe are dropped, as agreed (a file that has them simply loads without patterns).
2. **Types and wires.** Two kinds of value, path (gold) and shape (cyan). Each input port has a kind; Output takes either. Inputs of shape operators take many wires, all others one (a new wire replaces the old). A wire is refused with a reason when the types differ, when it would make a loop, or when the node has no such input. Loading a file repairs bad wires and cycles by dropping the wire that closes the cycle.
3. **Evaluation.** Recursive from the Output node; every node result is cached by a signature of its type, parameters, the signatures of its inputs and what it reads from outside (tables, the artwork origin, the ink of followed objects). The cache holds at most 400 entries and is cleared whenever a text outline is still pending. A node with a problem gives a result with a message, so one broken node does not break the others; the message shows in the layer panel.
4. **Path nodes.** Sources: Circle, Polygon, Lines, Table line, Around objects (the REQ-048 maths unchanged). Changers: Offset path (closed: a true offset, open: sideways), Round corners, Trim (start and length as fractions), Reverse, **Sine bend** and **Wiggle**. *Sine bend* moves every point sideways by `amp * sin(2 pi (freq * t + phase))`, where t runs 0 to 1 along the whole path, so **frequency is the number of repeats over the path**; on a closed path the frequency is rounded to a whole number so that the ends meet. *Wiggle* is smooth random sway like the After Effects effect: seeded value noise with one cell per `size` millimetres, smoothed between cells (a closed path wraps so there is no seam), amplitude in millimetres; the same seed always gives the same wobble. Both bend the path by displacing a dense copy of it (a point every 2 mm), so patterns made from the bent path curve with it: a running dog on a sine-bent path leans and swings with the curve. Self-intersections are allowed (the union cleans them).
5. **Shape nodes.** Stroke, Sine wave, Running dog, Interlace, Foliage (all the V113 generators; one node each, with the same fields), Union, Intersect, Subtract (the first wire minus all others), Xor, Offset, Negate. Negate: the universe is the closed path wired to its Universe input (a table outline, say), otherwise the box round the shape plus a margin; the result is universe minus shape.
6. **Output and layers.** An Output node is a layer. `+ Add pattern` makes circle, stroke and output at once; `+ Output layer` in the editor adds another layer fed by the selected node, which is how one chain is shared; the node that feeds more than one output shows a "shared" marker on its pinned sliders. An Output node whose layer is gone is removed on the next render; cloning a layer makes a new Output wired to the same input. An output that gets only a path draws and cuts nothing (the layer says so); the result of any node is shown in the small preview of the node panel.
7. **Pins.** The ○ button next to a number or whole-number field pins it: the layer panel then shows a slider and number field with the label and range chosen in the node panel (both editable, default label is the field name, default range from the field's limits or a guess from the value). Typing a value beyond the slider range is allowed.
8. **Editor.** SVG canvas in the dock under the stage: drag a node by its header, drag from a round output port to an input port (or onto a node body, which picks the first input that fits) to wire, double-click a wire to remove it, Delete removes the selected node (an Output node refuses: delete the layer), wheel zooms about the pointer, dragging the background pans, Fit refits. "Only this layer" (on by default) shows the chain of the selected layer plus loose nodes that feed no output, so a new node never vanishes. The dock opens when a pattern layer is selected and closes when none is (REQ-054). **Not built, deliberately:** the preview of the selected node on the stage itself (the small preview in the node panel is used instead), the helper line of a path-only output on the stage (same reason), per-path cut export, the stamp node, number-driven pins, Bezier nodes, the list-style chain editor (the canvas was built straight away).
9. **Cycles across layers.** An objects source can follow a pattern layer; a loop through such layers is refused when it is made, with a message that names the chain, and the change is undone.
10. **Known limits.** Patterns turn about the artwork origin, not their own centre; no coarse recompute while dragging; text outlines without a font file are traced (rough); the merge of a partial project file does not merge graphs (only a whole project or the artwork part carries `graph`).

**V116 fix and additions to the editor (maintainer's report 2026-11-08):** dragging a node made all nodes jump, because the canvas was rebuilt when the node was selected and the drag kept using the old canvas; the view is now frozen at the first press and the new canvas is used. Added a faint grid (20 units) behind the graph, nodes snap to it when dragged, and a **Tidy** button that packs the visible nodes into columns by depth (sources left, outputs right) with 20-unit gaps, then fits the view.

**V118 editor additions (maintainer's report 2026-11-08):** (1) **Delete** in the editor deletes the selected nodes; the editor has the keys while the pointer last pressed inside the dock (a press on the stage gives them back to the artwork), and fields in the dock keep their own Delete. An Output node refuses (delete the layer). (2) **Several nodes:** Shift or Ctrl click toggles a node, Shift plus dragging the background draws a rubber band, a drag moves all selected nodes together. (3) **Wires can be picked up from either end:** dragging from a connected input port carries the output end away; dragging a wire itself takes the end nearer to the pointer; dropped on another input (or output) it is moved, dropped on nothing it is removed; dragging from an empty input port draws a wire backwards to an output. (4) **Right-click menu:** on a node (Delete, Disconnect inputs, Disconnect outputs, Duplicate), on a wire (Remove wire), on the background (Tidy, Fit view and every node type to add at the pointer). (5) A node that lacks an input says so in its panel, and a node added while such a node is selected is wired into its free input and placed to its left (so a Source can be added after the fact). The earlier report that the source node was missing could not be reproduced: a new pattern always has its circle node; most likely it had been deleted with the old Delete key handling.

**V119 live update (maintainer, 2026-11-08):** the stage follows the graph while it is edited: every change of a graph (wire, node, value) redraws the stage at once, and since V119 a slider or a number field also updates it on every movement or keystroke (the undo step and the panels wait for the end of the edit). Moving a node changes no result, so the stage does not redraw then.

