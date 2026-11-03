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

The project-driven version (outline from data, rail solid, textured cloth, room sized to the table) has
**not** been run in real Blender yet. An early build of it never called `main()` at the end of the script,
so Blender built nothing and the old scene stayed on screen. That is fixed, and `tests/blender_mock.py`
now guards it: it runs the generated script against a stand-in for `bpy`, `bmesh` and `mathutils` and
checks that the scene is built, that the outline, rail and texture of the project are used, that the UV
coordinates cover 0..1 and that the table, rail and cloth are closed solids. This does not prove the
picture looks right: materials, lights and the camera are untested.

When a script runs, the Blender console (Window > Toggle System Console on Windows, or the terminal)
prints a line starting with `PTD:` that names the table, the number of outline points and whether a
texture was used. If it says `NO PROJECT DATA`, the script did not come from the app. If a script stops
with an error, copy the message. Light strengths are estimates: `LIGHT_SCALE` at the top scales every light (0.25 is the value the maintainer settled on), `EXPOSURE` sets the overall brightness. If the felt still looks too bright
or not green enough, the next things to try are the felt sheen (0.6) and the warm light tint.

On the Export tab, "Preview the Blender table" draws the shape and the texture from above before you open
Blender, and can save the texture as a PNG.

## Editing

Edit `src/scene_template.py`, never the generated files. After a change run
`python3 make_scripts.py` here and `python3 ../scripts/make-blender-js.py` in the repository root so
the app uses the new template too (`js/blender-template.js` is generated).

## Data the app passes in (`PROJECT`)

Metres, Blender axes (Y up the page, so the drawing is flipped top to bottom), table bounding box
centred on 0, 0: `outline` (cloth polygon), `rail_outer`, `rail_tris` (triangles between the two
loops, indices into `rail_outer + outline`), `texture` (PNG as base64), `tex_bounds`, `rail_color`,
`felt_color`.

The cloth colour comes from the printed texture, so `FELT_GREEN_*` only matter without a texture. To change the look of the printed felt use `CLOTH_SATURATION`, `CLOTH_VALUE` and `CLOTH_SHEEN`. The script also switches the view transform from AgX to Standard, because AgX greys out dark saturated colours.
