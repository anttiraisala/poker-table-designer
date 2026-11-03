"""Poker Table Designer - Blender scene (mood version).

Builds a dim, warm 1920s-style casino corner: a dark panelled room with wavy red
curtains, the poker table of the project (outline made of lines and arcs, dark wood
rail, cloth with the artwork printed on it), a simple chandelier, warm lights and a
camera with depth of field.

Open this file in Blender's Scripting workspace, press "Run Script", then render
with F12 (Render > Render Image). Units are metres. Written for Blender 3.6 to 4.x
(socket and engine names that changed between versions are handled).

Poker Table Designer writes the PROJECT data below from the open project. Run
standalone (PROJECT empty) the script builds a default stadium table without artwork.
"""

import base64
import json
import math
import os

import bmesh
import bpy
from mathutils import Vector

# __PROFILE_MARKER__ (replaced by the generator)
PROFILE = {}
# Project data from Poker Table Designer. Metres, Blender axes (Y up the page), table centred on 0, 0.
PROJECT = {}

# ---------------------------------------------------------------------------
# Scene settings (metres)
# ---------------------------------------------------------------------------
TABLE_HEIGHT = 0.74              # top of the table body, cloth lies on it
RAIL_HEIGHT = 0.05
CLOTH_THICKNESS = 0.006
LIGHT_SCALE = 0.25               # all lights, 1.0 = original strength (tuned by the maintainer from 0.75)
CLOTH_SATURATION = 1.5           # colour boost of the printed cloth, 1.0 = as in the artwork
CLOTH_VALUE = 1.6                # brightness boost of the printed cloth, 1.0 = as in the artwork
CLOTH_SHEEN = 0.1                # white sheen veil on the cloth, lower = deeper colour
EXPOSURE = 0.5                   # overall brightness, raise if the image is dark
ROOM_HEIGHT = 2.8

FELT_GREEN_DARK = (0.012, 0.065, 0.045, 1.0)
FELT_GREEN_LIGHT = (0.020, 0.095, 0.065, 1.0)
GOLD_YELLOW = (0.85, 0.62, 0.12, 1.0)
BRASS = (0.75, 0.52, 0.18, 1.0)
WARM_WHITE = (1.0, 0.82, 0.55)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def clear_scene():
    """Remove everything so the script can be run repeatedly."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.lights,
                       bpy.data.cameras, bpy.data.materials):
        for block in list(collection):
            collection.remove(block)


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_object(name, verts, faces, location=(0.0, 0.0, 0.0), smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    return link(obj)


def bmesh_object(name, bm, location=(0.0, 0.0, 0.0), smooth=False):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    return link(obj)


def room_box(name, size, location):
    """A box whose faces point inside. Floor, ceiling and walls get slots 1, 2, 0."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    obj = bmesh_object(name, bm, location)
    for poly in obj.data.polygons:
        if poly.normal.z > 0.9:
            poly.material_index = 1
        elif poly.normal.z < -0.9:
            poly.material_index = 2
    return obj


def rounded_rect_points(size_x, size_y, radius, segments=12):
    """Counter-clockwise outline of a rounded rectangle (stadium if radius is max)."""
    hx, hy = size_x / 2 - radius, size_y / 2 - radius
    points = []
    for (cx, cy), start in (((hx, hy), 0), ((-hx, hy), 90),
                            ((-hx, -hy), 180), ((hx, -hy), 270)):
        for k in range(segments + 1):
            angle = math.radians(start + 90.0 * k / segments)
            points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    return points


def slab(name, points, z0, z1):
    n = len(points)
    verts = [(x, y, z0) for x, y in points] + [(x, y, z1) for x, y in points]
    faces = [list(range(n, 2 * n)), list(range(n - 1, -1, -1))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    return mesh_object(name, verts, faces)


def ring(name, outer, inner, z0, z1):
    """A closed ring (rail) between two outlines with the same point count."""
    n = len(outer)
    verts = ([(x, y, z0) for x, y in outer] + [(x, y, z1) for x, y in outer]
             + [(x, y, z0) for x, y in inner] + [(x, y, z1) for x, y in inner])
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append((n + i, n + j, 3 * n + j, 3 * n + i))      # top
        faces.append((i, j, n + j, n + i))                       # outer wall
        faces.append((2 * n + i, 3 * n + i, 3 * n + j, 2 * n + j))  # inner wall
    return mesh_object(name, verts, faces)


def curtain(name, start, end, height, wave, pitch, z0=0.05):
    """A wavy curtain along a wall from start to end (plan view, metres)."""
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = math.hypot(dx, dy)
    dx, dy = dx / length, dy / length
    nx, ny = dy, -dx  # inward normal for the quad winding used below
    columns, rows = 160, 4
    verts = []
    for i in range(columns + 1):
        t = i * length / columns
        fold = wave * (0.5 + 0.5 * math.sin(t * 2 * math.pi / pitch))
        for j in range(rows + 1):
            z = z0 + height * j / rows
            sag = 1.0 + 0.15 * math.sin(t * 0.7 + j)  # slightly uneven folds
            verts.append((start[0] + dx * t + nx * fold * sag,
                          start[1] + dy * t + ny * fold * sag, z))
    faces = []
    for i in range(columns):
        for j in range(rows):
            a = i * (rows + 1) + j
            b = (i + 1) * (rows + 1) + j
            faces.append((a, b, b + 1, a + 1))
    return mesh_object(name, verts, faces, smooth=True)


def set_input(node, names, value):
    """Set the first existing input socket; socket names differ per version."""
    for name in names:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return True
    return False


def simple_material(name, color, roughness, metallic=0.0, sheen=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    set_input(bsdf, ("Base Color",), color)
    set_input(bsdf, ("Roughness",), roughness)
    set_input(bsdf, ("Metallic",), metallic)
    if sheen:
        set_input(bsdf, ("Sheen Weight", "Sheen"), sheen)
    return mat


def emission_material(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = color
    emission.inputs["Strength"].default_value = strength
    links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return mat


def felt_material(name):
    """Procedural wool felt: soft colour variation, fibre bump and sheen."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]

    coords = nodes.new("ShaderNodeTexCoord")

    cloud = nodes.new("ShaderNodeTexNoise")
    cloud.inputs["Scale"].default_value = 40.0
    cloud.inputs["Detail"].default_value = 4.0
    links.new(coords.outputs["Object"], cloud.inputs["Vector"])

    tint = nodes.new("ShaderNodeMixRGB")
    tint.inputs["Color1"].default_value = FELT_GREEN_DARK
    tint.inputs["Color2"].default_value = FELT_GREEN_LIGHT
    links.new(cloud.outputs["Fac"], tint.inputs["Fac"])
    links.new(tint.outputs["Color"], bsdf.inputs["Base Color"])

    fibre = nodes.new("ShaderNodeTexNoise")
    fibre.inputs["Scale"].default_value = 1200.0
    fibre.inputs["Detail"].default_value = 8.0
    fibre.inputs["Roughness"].default_value = 0.7
    links.new(coords.outputs["Object"], fibre.inputs["Vector"])

    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    bump.inputs["Distance"].default_value = 0.002
    links.new(fibre.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    set_input(bsdf, ("Roughness",), 0.95)
    set_input(bsdf, ("Sheen Weight", "Sheen"), 0.6)
    set_input(bsdf, ("Sheen Roughness",), 0.5)
    return mat


# ---------------------------------------------------------------------------
# Scene parts
# ---------------------------------------------------------------------------
def default_project():
    """A plain 2.4 x 1.2 m stadium table, used when the script runs without project data."""
    inner = rounded_rect_points(2.4, 1.2, 0.599)
    outer = rounded_rect_points(2.7, 1.5, 0.749)
    return {
        "name": "Default table", "outline": [list(p) for p in inner], "rail_outer": [list(p) for p in outer],
        "rail_tris": [], "texture": "", "tex_bounds": [-1.2, -0.6, 1.2, 0.6],
        "rail_color": [0.10, 0.045, 0.02], "felt_color": [0.012, 0.065, 0.045],
    }


def load_project():
    data = PROJECT if PROJECT else default_project()
    outline = [tuple(p) for p in data["outline"]]
    xs = [p[0] for p in outline]
    ys = [p[1] for p in outline]
    bbox = (min(xs), min(ys), max(xs), max(ys))
    return data, outline, bbox


def room_size(bbox):
    length = bbox[2] - bbox[0]
    width = bbox[3] - bbox[1]
    return (max(8.0, length + 5.0), max(7.0, width + 5.5), ROOM_HEIGHT)


def camera_setup(bbox):
    length = bbox[2] - bbox[0]
    scale = max(1.0, length / 2.4)
    location = (1.0 * scale, -1.2 * scale - 0.9, 1.0 * scale + 0.8)
    return location, (0.0, 0.0, TABLE_HEIGHT + 0.06)


def build_room(room):
    obj = room_box("Room", room, (0.0, 0.0, room[2] / 2))
    obj.data.materials.append(simple_material("PanelWood", (0.07, 0.035, 0.02, 1.0), 0.45))
    obj.data.materials.append(simple_material("Carpet", (0.05, 0.012, 0.014, 1.0), 0.95, sheen=0.5))
    obj.data.materials.append(simple_material("Ceiling", (0.16, 0.11, 0.07, 1.0), 0.9))

    velvet = simple_material("RedVelvet", (0.22, 0.008, 0.014, 1.0), 0.8, sheen=1.0)
    half_x, half_y = room[0] / 2, room[1] / 2
    back = curtain("CurtainBack", (-half_x + 0.5, half_y - 0.05), (half_x - 0.5, half_y - 0.05),
                   room[2] - 0.15, 0.12, 0.35)
    left = curtain("CurtainLeft", (-half_x + 0.05, -half_y + 1.0), (-half_x + 0.05, half_y - 0.5),
                   room[2] - 0.15, 0.12, 0.35)
    for curtain_obj in (back, left):
        curtain_obj.data.materials.append(velvet)


def extrude_polygon(name, points, z0, z1):
    """A closed solid from a (possibly concave) polygon; normals are fixed afterwards."""
    bm = bmesh.new()
    bottom = [bm.verts.new((x, y, z0)) for x, y in points]
    top = [bm.verts.new((x, y, z1)) for x, y in points]
    bm.faces.new(bottom)
    bm.faces.new(top)
    n = len(points)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def rail_solid(name, outer, inner, tris, z0, z1):
    """The rail: closed solid between the outer and the inner outline."""
    m, n = len(outer), len(inner)
    bm = bmesh.new()
    low = [bm.verts.new((x, y, z0)) for x, y in list(outer) + list(inner)]
    high = [bm.verts.new((x, y, z1)) for x, y in list(outer) + list(inner)]
    if not tris:
        assert m == n, "rail_tris is needed when the outlines have different point counts"
        tris = []
        for i in range(m):
            j = (i + 1) % m
            tris.append((i, j, m + j))
            tris.append((i, m + j, m + i))
    for a, b, c in tris:
        bm.faces.new((high[a], high[b], high[c]))
        bm.faces.new((low[a], low[b], low[c]))
    for i in range(m):
        j = (i + 1) % m
        bm.faces.new((low[i], low[j], high[j], high[i]))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((low[m + i], low[m + j], high[m + j], high[m + i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def cloth_material(data):
    mat = bpy.data.materials.new("Cloth")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    coords = nodes.new("ShaderNodeTexCoord")
    fibre = nodes.new("ShaderNodeTexNoise")
    fibre.inputs["Scale"].default_value = 1200.0
    fibre.inputs["Detail"].default_value = 8.0
    fibre.inputs["Roughness"].default_value = 0.7
    links.new(coords.outputs["Object"], fibre.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    bump.inputs["Distance"].default_value = 0.002
    links.new(fibre.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    if data.get("texture"):
        path = os.path.join(bpy.app.tempdir, "ptd_cloth.png")
        with open(path, "wb") as handle:
            handle.write(base64.b64decode(data["texture"]))
        image = bpy.data.images.load(path)
        image.pack()
        print("PTD: cloth texture loaded, %d x %d px" % (image.size[0], image.size[1]))
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.interpolation = "Smart"
        uv = nodes.new("ShaderNodeUVMap")
        uv.uv_map = "UVMap"
        links.new(uv.outputs["UV"], tex.inputs["Vector"])
        tint = nodes.new("ShaderNodeHueSaturation")
        tint.inputs["Saturation"].default_value = CLOTH_SATURATION
        tint.inputs["Value"].default_value = CLOTH_VALUE
        links.new(tex.outputs["Color"], tint.inputs["Color"])
        links.new(tint.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        c = data["felt_color"]
        set_input(bsdf, ("Base Color",), (c[0], c[1], c[2], 1.0))
    set_input(bsdf, ("Roughness",), 0.95)
    set_input(bsdf, ("Sheen Weight", "Sheen"), CLOTH_SHEEN)
    set_input(bsdf, ("Sheen Roughness",), 0.5)
    return mat


def build_table(data, outline, bbox):
    outer = [tuple(p) for p in data["rail_outer"]]
    inner = outline
    wood_color = data["rail_color"]
    wood = simple_material("TableWood", (wood_color[0], wood_color[1], wood_color[2], 1.0), 0.35)

    body = bmesh_object("TableBody", extrude_polygon("TableBody", outer, 0.0, TABLE_HEIGHT))
    body.data.materials.append(wood)
    rail = bmesh_object("TableRail", rail_solid("TableRail", outer, inner, data.get("rail_tris") or [],
                                                TABLE_HEIGHT, TABLE_HEIGHT + RAIL_HEIGHT))
    rail.data.materials.append(wood)

    bm = extrude_polygon("Cloth", inner, TABLE_HEIGHT, TABLE_HEIGHT + CLOTH_THICKNESS)
    tb = data.get("tex_bounds") or list(bbox)
    uv_layer = bm.loops.layers.uv.new("UVMap")
    width, height = max(tb[2] - tb[0], 1e-6), max(tb[3] - tb[1], 1e-6)
    for face in bm.faces:
        for loop in face.loops:
            x, y = loop.vert.co.x, loop.vert.co.y
            loop[uv_layer].uv = (min(1.0, max(0.0, (x - tb[0]) / width)), min(1.0, max(0.0, (y - tb[1]) / height)))   # rounding of the bounds must not push UVs outside the picture
    cloth = bmesh_object("Cloth", bm)
    cloth["ptd_project"] = str(data.get("name", "table"))
    cloth.data.materials.append(cloth_material(data))
    return cloth


def png_image(name, b64):
    """A small PNG (base64) as a packed Blender image."""
    path = os.path.join(bpy.app.tempdir, "ptd_%s.png" % name)
    with open(path, "wb") as handle:
        handle.write(base64.b64decode(b64))
    image = bpy.data.images.load(path)
    image.pack()
    return image


def cap_material(name, image, roughness=0.45):
    """Material that shows an image (the top of a chip, card or button)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    set_input(bsdf, ("Roughness",), roughness)
    return mat


def solid_mesh(name, bm):
    """Turns a bmesh into a mesh datablock (no object), so many objects can share it."""
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def disc_mesh(name, radius, height, segments=32):
    """A round disc (chip, dealer button) standing on z = 0. Slot 0 is the rim, slot 1 the top and bottom faces."""
    bm = bmesh.new()
    bottom = [bm.verts.new((radius * math.cos(2 * math.pi * i / segments), radius * math.sin(2 * math.pi * i / segments), 0.0)) for i in range(segments)]
    top = [bm.verts.new((v.co.x, v.co.y, height)) for v in bottom]
    uv_layer = bm.loops.layers.uv.new("UVMap")
    caps = [bm.faces.new(top), bm.faces.new(list(reversed(bottom)))]
    for face in caps:
        face.material_index = 1
        for loop in face.loops:
            loop[uv_layer].uv = ((loop.vert.co.x / radius + 1.0) / 2.0, (loop.vert.co.y / radius + 1.0) / 2.0)
    for i in range(segments):
        j = (i + 1) % segments
        face = bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
        face.material_index = 0
        face.smooth = True
        for loop in face.loops:
            loop[uv_layer].uv = (0.0, 0.0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return solid_mesh(name, bm)


def box_mesh(name, width, depth, height):
    """A thin box (playing card) standing on z = 0. Slot 1 is the top face, slot 0 the rest."""
    bm = bmesh.new()
    hx, hy = width / 2, depth / 2
    low = [bm.verts.new(c) for c in ((-hx, -hy, 0.0), (hx, -hy, 0.0), (hx, hy, 0.0), (-hx, hy, 0.0))]
    high = [bm.verts.new((v.co.x, v.co.y, height)) for v in low]
    uv_layer = bm.loops.layers.uv.new("UVMap")
    faces = [(high, 1), (list(reversed(low)), 0)]
    for i in range(4):
        j = (i + 1) % 4
        faces.append(([low[i], low[j], high[j], high[i]], 0))
    for verts, slot in faces:
        face = bm.faces.new(verts)
        face.material_index = slot
        for loop in face.loops:
            loop[uv_layer].uv = ((loop.vert.co.x / width) + 0.5, (loop.vert.co.y / depth) + 0.5) if slot == 1 else (0.0, 0.0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return solid_mesh(name, bm)


def place(name, mesh, x, y, z, rot_deg):
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (x, y, z)
    obj.rotation_euler = (0.0, 0.0, math.radians(rot_deg))
    return link(obj)


def build_things(data):
    """Chips, cards and the dealer button lying on the cloth: real objects sharing a few meshes.
    Heights already include the small air gaps, so nothing touches and nothing z-fights."""
    things = data.get("things")
    if not things:
        return
    z0 = TABLE_HEIGHT + CLOTH_THICKNESS
    for index, colour in enumerate(things["colours"]):
        rgb = colour["rgb"]
        mesh = disc_mesh("ChipMesh_%s" % colour["id"], things["chip_r"], things["chip_th"])
        mesh.materials.append(simple_material("ChipRim_%s" % colour["id"], (rgb[0], rgb[1], rgb[2], 1.0), 0.4))
        mesh.materials.append(cap_material("ChipTop_%s" % colour["id"], png_image("chip_%s" % colour["id"], colour["tex"])))
        for x, y, z, ci, rot in things["chips"]:
            if ci == index:
                place("Chip", mesh, x, y, z0 + z, rot)
    if things["cards"]:
        mesh = box_mesh("CardMesh", things["card_w"], things["card_h"], things["card_th"])
        mesh.materials.append(simple_material("CardEdge", (0.5, 0.02, 0.03, 1.0), 0.5))
        mesh.materials.append(cap_material("CardBack", png_image("card_back", things["card_tex"]), 0.5))
        for x, y, z, rot in things["cards"]:
            place("Card", mesh, x, y, z0 + z, rot)
    if things["buttons"]:
        mesh = disc_mesh("ButtonMesh", things["btn_r"], things["btn_th"], 48)
        mesh.materials.append(simple_material("ButtonRim", (0.9, 0.88, 0.82, 1.0), 0.3))
        mesh.materials.append(cap_material("ButtonTop", png_image("button", things["btn_tex"]), 0.3))
        for x, y, z, rot in things["buttons"]:
            place("DealerButton", mesh, x, y, z0 + z, rot)


def build_chandelier(room):
    """A simple two-tier brass chandelier with glowing bulbs."""
    brass = simple_material("Brass", BRASS, 0.3, 1.0)
    glow = emission_material("BulbGlow", (1.0, 0.7, 0.35, 1.0), 150.0 * LIGHT_SCALE)
    top = room[2]

    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.015,
                          radius2=0.015, depth=top - 2.15)
    rod = bmesh_object("ChandelierRod", bm, (0.0, 0.0, (top + 2.15) / 2), smooth=True)
    rod.data.materials.append(brass)

    for tier, (radius, z, count) in enumerate(((0.55, 2.15, 12), (0.3, 2.4, 8))):
        # Brass ring (torus).
        major_segments, minor_segments, minor = 48, 10, 0.012
        verts, faces = [], []
        for i in range(major_segments):
            a = 2 * math.pi * i / major_segments
            for j in range(minor_segments):
                b = 2 * math.pi * j / minor_segments
                r = radius + minor * math.cos(b)
                verts.append((r * math.cos(a), r * math.sin(a), minor * math.sin(b)))
        for i in range(major_segments):
            for j in range(minor_segments):
                i2, j2 = (i + 1) % major_segments, (j + 1) % minor_segments
                faces.append((i * minor_segments + j, i2 * minor_segments + j,
                              i2 * minor_segments + j2, i * minor_segments + j2))
        ring_obj = mesh_object("ChandelierRing%d" % tier, verts, faces, (0.0, 0.0, z), smooth=True)
        ring_obj.data.materials.append(brass)
        # Bulbs.
        for k in range(count):
            a = 2 * math.pi * k / count
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=0.035)
            bulb = bmesh_object("Bulb%d_%d" % (tier, k), bm,
                                (radius * math.cos(a), radius * math.sin(a), z + 0.05), smooth=True)
            bulb.data.materials.append(glow)


def add_light(name, kind, location, energy, color=WARM_WHITE, target=None, radius=0.1):
    data = bpy.data.lights.new(name, type=kind)
    data.energy = energy * LIGHT_SCALE
    data.color = color
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    if target is not None:
        direction = Vector(target) - Vector(location)
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    link(obj)
    return data


def build_lights(room):
    # Light from the chandelier (the glowing bulbs only add the visible glow).
    add_light("ChandelierLight", "POINT", (0.0, 0.0, 2.05), 350.0, radius=0.2)
    # Pendant spot over the table, off-centre so the chandelier rod does not block it.
    beam = add_light("TableSpot", "SPOT", (0.6, -0.5, 2.7), 700.0,
                     target=(0.0, 0.0, TABLE_HEIGHT), radius=0.12)
    beam.spot_size = math.radians(60)
    beam.spot_blend = 0.7
    # Faint warm fill so the corners of the room are not pure black.
    add_light("RoomFill", "POINT", (-room[0] / 3, room[1] / 3, 2.4), 40.0, (1.0, 0.7, 0.45), radius=0.3)


def build_world():
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    background = nodes.get("Background")
    if background:
        set_input(background, ("Color",), (0.01, 0.01, 0.012, 1.0))
        set_input(background, ("Strength",), 1.0)
    if PROFILE["volume_fog"]:
        output = nodes.get("World Output")
        haze = nodes.new("ShaderNodeVolumePrincipled")
        set_input(haze, ("Color",), (1.0, 0.85, 0.65, 1.0))
        set_input(haze, ("Density",), 0.02)
        set_input(haze, ("Anisotropy",), 0.5)
        links.new(haze.outputs["Volume"], output.inputs["Volume"])


def check_camera_inside_room(room, location):
    half_x, half_y = room[0] / 2, room[1] / 2
    x, y, z = location
    if abs(x) >= half_x or abs(y) >= half_y or not 0.0 < z < room[2]:
        raise ValueError("The camera is outside the room: the table is too big for the default room.")


def build_camera(focus_object, room, location, target):
    check_camera_inside_room(room, location)
    data = bpy.data.cameras.new("Camera")
    data.lens = 35.0
    data.dof.use_dof = True
    data.dof.focus_object = focus_object
    data.dof.aperture_fstop = 2.8
    cam = bpy.data.objects.new("Camera", data)
    cam.location = location
    direction = Vector(target) - Vector(location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    link(cam)
    bpy.context.scene.camera = cam


def configure_render():
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = PROFILE["resolution"]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = "//" + PROFILE["output_name"]
    # AgX (the default in Blender 4) greys out dark saturated colours; Standard keeps the felt green.
    try:
        scene.view_settings.view_transform = "Standard"
    except TypeError:
        pass
    scene.view_settings.exposure = EXPOSURE

    if PROFILE["engine"] == "EEVEE":
        # The engine identifier changed in Blender 4.2.
        for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
            try:
                scene.render.engine = engine
                break
            except TypeError:
                continue
        scene.eevee.taa_render_samples = PROFILE["samples"]
        for prop in ("use_gtao", "use_soft_shadows", "use_ssr"):
            if hasattr(scene.eevee, prop):
                setattr(scene.eevee, prop, True)
    else:
        scene.render.engine = "CYCLES"
        cycles = scene.cycles
        cycles.samples = PROFILE["samples"]
        # Some Blender builds (for example Linux distribution packages) ship
        # without OpenImageDenoise, and enabling denoising there aborts the
        # render. Only denoise when the build supports it.
        has_oidn = getattr(bpy.app.build_options, "openimagedenoise", False)
        cycles.use_denoising = bool(has_oidn)
        if has_oidn:
            cycles.denoiser = "OPENIMAGEDENOISE"
        # Tame fireflies, which matter more when there is no denoiser.
        cycles.sample_clamp_indirect = 10.0
        cycles.max_bounces = PROFILE["bounces"]
        cycles.volume_bounces = 4
        # Uncomment to render on the GPU if one is configured in Preferences:
        # cycles.device = "GPU"


def describe_project(data, outline):
    """Prints what the script is about to build, so the Blender console shows which table it is."""
    if not PROJECT:
        print("PTD: NO PROJECT DATA in this script. Building the default 2.4 x 1.2 m stadium table. "
              "Export the script from Poker Table Designer to get your own table.")
        return
    xs = [p[0] for p in outline]
    ys = [p[1] for p in outline]
    print("PTD: project '%s': cloth outline %d points, %.3f x %.3f m, rail %d points, texture %s" % (
        data.get("name", "table"), len(outline), max(xs) - min(xs), max(ys) - min(ys),
        len(data.get("rail_outer") or []), "yes" if data.get("texture") else "NO (plain felt colour)"))
    things = data.get("things")
    if things:
        print("PTD: things on the table: %d chips, %d cards, %d dealer button(s)" % (len(things["chips"]), len(things["cards"]), len(things["buttons"])))


def main():
    clear_scene()
    data, outline, bbox = load_project()
    describe_project(data, outline)
    room = room_size(bbox)
    location, target = camera_setup(bbox)
    build_room(room)
    cloth = build_table(data, outline, bbox)
    build_things(data)
    build_chandelier(room)
    build_lights(room)
    build_world()
    build_camera(cloth, room, location, target)
    configure_render()
    print("Scene ready (%s, %s). Press F12 to render." % (PROFILE["name"], data.get("name", "table")))


main()
