#!/usr/bin/env python3
"""Runs a generated Blender script against a stand-in for bpy, bmesh and mathutils.

Blender itself is not available in the development environment, so this does NOT prove the scene looks
right. It does prove the parts that fail silently or with a plain Python error:
  - the script really builds the scene (main() is called),
  - the project data is used (outline, rail, texture, UVs),
  - the solids are closed (every edge is shared by two faces) and no face is invalid or duplicated.

Usage: python3 tests/blender_mock.py path/to/script.py [--expect-project]
"""
import base64
import collections
import json
import os
import re
import sys
import tempfile
import types
from unittest.mock import MagicMock


class Vert:
    def __init__(self, i, co):
        self.index = i
        self.co = types.SimpleNamespace(x=co[0], y=co[1], z=co[2])


class Loop:
    def __init__(self, vert):
        self.vert = vert
        self.uv = {}

    def __getitem__(self, layer):
        return types.SimpleNamespace(set=None) if False else _LoopUV(self, layer)


class _LoopUV:
    def __init__(self, loop, layer):
        object.__setattr__(self, "_loop", loop)
        object.__setattr__(self, "_layer", layer)

    def __setattr__(self, name, value):
        if name == "uv":
            self._loop.uv[self._layer] = value
        else:
            object.__setattr__(self, name, value)


class Face:
    def __init__(self, verts):
        self.verts = verts
        self.loops = [Loop(v) for v in verts]


class BM:
    def __init__(self):
        self.verts = Verts(self)
        self.faces = Faces()
        self.loops = types.SimpleNamespace(layers=types.SimpleNamespace(uv=types.SimpleNamespace(new=lambda name: name)))
        self.freed = False

    def to_mesh(self, mesh):
        MESHES.append((mesh.name, self))

    def free(self):
        self.freed = True


class Verts(list):
    def __init__(self, bm):
        super().__init__()
        self.bm = bm

    def new(self, co):
        v = Vert(len(self), co)
        self.append(v)
        return v


class Faces(list):
    def new(self, verts):
        verts = list(verts)
        keys = [v.index for v in verts]
        if len(set(keys)) != len(keys):
            raise ValueError("face has duplicate vertices: %r" % keys)
        if len(keys) < 3:
            raise ValueError("face has fewer than 3 vertices")
        sig = frozenset(keys)
        for f in self:
            if frozenset(v.index for v in f.verts) == sig:
                raise ValueError("face already exists: %r" % keys)
        face = Face(verts)
        self.append(face)
        return face


MESHES = []
IMAGES = []


def install_fakes():
    bpy = MagicMock(name="bpy")
    bpy.app.tempdir = tempfile.gettempdir() + os.sep

    def new_mesh(name):
        return types.SimpleNamespace(name=name, polygons=[], from_pydata=lambda *a, **k: None, update=lambda: None, materials=MagicMock())
    bpy.data.meshes.new = new_mesh
    bpy.data.objects.__iter__ = lambda self: iter([])
    bpy.data.meshes.__iter__ = lambda self: iter([])

    def load_image(path):
        with open(path, "rb") as handle:
            head = handle.read(8)
        IMAGES.append(head)
        return types.SimpleNamespace(size=(4096, 2048), pack=lambda: None)
    bpy.data.images.load = load_image

    bmesh = types.ModuleType("bmesh")
    bmesh.new = lambda: BM()
    ops = MagicMock(name="bmesh.ops")
    ops.recalc_face_normals = lambda bm, faces=None: None
    bmesh.ops = ops
    mathutils = types.ModuleType("mathutils")
    mathutils.Vector = lambda v=(0, 0, 0): MagicMock(name="Vector")
    sys.modules.update({"bpy": bpy, "bmesh": bmesh, "mathutils": mathutils})
    return bpy


def edge_report(bm):
    counts = collections.Counter()
    for f in bm.faces:
        n = len(f.verts)
        for i in range(n):
            a, b = f.verts[i].index, f.verts[(i + 1) % n].index
            counts[tuple(sorted((a, b)))] += 1
    return counts


def main():
    path = sys.argv[1]
    expect_project = "--expect-project" in sys.argv
    src = open(path, encoding="utf-8").read()
    problems = []
    if not re.search(r"^main\(\)\s*$", src, re.M):
        problems.append("the script never calls main(), so Blender would build nothing")
    install_fakes()
    ns = {"__name__": "__main__", "__file__": path}
    out = []
    real_print = print
    ns["print"] = lambda *a, **k: out.append(" ".join(str(x) for x in a))
    exec(compile(src, path, "exec"), ns)
    for line in out:
        real_print("  script says:", line[:200])
    names = [n for n, _ in MESHES]
    for need in ("TableBody", "TableRail", "Cloth"):
        if need not in names:
            problems.append("no %s mesh was built (got %s)" % (need, names))
    project = ns["PROJECT"]
    if expect_project:
        if not project:
            problems.append("PROJECT data is empty but the app should have written it")
        else:
            outline = project["outline"]
            cloth = [bm for n, bm in MESHES if n == "Cloth"]
            if cloth:
                bm = cloth[0]
                if len(bm.verts) != 2 * len(outline):
                    problems.append("cloth has %d vertices, expected %d from the project outline" % (len(bm.verts), 2 * len(outline)))
                else:
                    for i, p in enumerate(outline):
                        v = bm.verts[i].co
                        if abs(v.x - p[0]) > 1e-9 or abs(v.y - p[1]) > 1e-9:
                            problems.append("cloth vertex %d differs from the project outline" % i)
                            break
                uvs = [lp.uv["UVMap"] for f in bm.faces for lp in f.loops if "UVMap" in lp.uv]
                if not uvs:
                    problems.append("the cloth has no UV coordinates")
                else:
                    us = [u for u, _ in uvs]
                    vs = [v for _, v in uvs]
                    if min(us) < -1e-6 or max(us) > 1 + 1e-6 or min(vs) < -1e-6 or max(vs) > 1 + 1e-6:
                        problems.append("UVs leave the 0..1 range: u %.3f..%.3f v %.3f..%.3f" % (min(us), max(us), min(vs), max(vs)))
                    real_print("  cloth UV range: u %.3f..%.3f, v %.3f..%.3f" % (min(us), max(us), min(vs), max(vs)))
            if project.get("texture"):
                if not IMAGES or IMAGES[0] != b"\x89PNG\r\n\x1a\n":
                    problems.append("the cloth texture was not written as a PNG file")
            else:
                problems.append("the project has no texture")
    for name, bm in MESHES:
        if name in ("TableBody", "TableRail", "Cloth"):
            bad = [e for e, c in edge_report(bm).items() if c != 2]
            if bad:
                problems.append("%s is not a closed solid: %d edges are not shared by exactly two faces" % (name, len(bad)))
    real_print("meshes built:", ", ".join(names))
    if problems:
        for p in problems:
            real_print("PROBLEM:", p)
        sys.exit(1)
    real_print("blender mock: ok")


if __name__ == "__main__":
    main()
