# Blender scene

Two Python scripts that build a dim, warm casino corner in Blender: panelled room, wavy red
curtains, the poker table, a simple chandelier, lights and a camera with depth of field.

| Script | Engine | Resolution | Use |
|--------|--------|------------|-----|
| `render_preview.py` | EEVEE, 64 samples, no haze | 1280x720 | Quick check, seconds |
| `render_final.py` | Cycles, 1024 samples, denoise when the build has it, 12 bounces, volumetric fog and a light beam | 1920x1080 | Final image, minutes |

## Two ways to get a script

1. **From the app (normal way).** On the Export tab, "Blender scene" writes the same script with the
   open project built in: the table outline (lines and arcs), the rail, the cloth colour and the printed
   artwork as a texture. Nothing else needs editing.
2. **From this folder.** `render_preview.py` and `render_final.py` build a default 2.4 x 1.2 m stadium
   table without artwork. They are generated from `src/scene_template.py` by `python3 make_scripts.py`.

## How to use a script

1. Open Blender (3.6 or newer) and switch to the **Scripting** workspace.
2. Open the script (Text > Open) and press **Run Script**.
3. Press **F12** to render, then **Image > Save As** to keep the picture.

Running a script again clears the scene and rebuilds it.

## Status

The first version (default table, text logo) was run in Blender by the maintainer in preview mode.
The project-driven version (outline from data, rail solid, textured cloth, room sized to the table)
has **not** been run in Blender yet. If a script stops with an error, copy the message from the
Scripting workspace console. Light strengths are estimates: change `EXPOSURE` at the top if the
image is too dark or too bright.

## Editing

Edit `src/scene_template.py`, never the generated files. After a change run
`python3 make_scripts.py` here and `python3 ../scripts/make-blender-js.py` in the repository root so
the app uses the new template too (`js/blender-template.js` is generated).

## Data the app passes in (`PROJECT`)

Metres, Blender axes (Y up the page, so the drawing is flipped top to bottom), table bounding box
centred on 0, 0: `outline` (cloth polygon), `rail_outer`, `rail_tris` (triangles between the two
loops, indices into `rail_outer + outline`), `texture` (PNG as base64), `tex_bounds`, `rail_color`,
`felt_color`.
