#!/usr/bin/env python3
"""Generate the two standalone Blender scripts from src/scene_template.py."""
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
MARKER = "PROFILE = {}"

PROFILES = {
    "render_preview.py": {
        "name": "preview", "engine": "EEVEE", "resolution": (1280, 720),
        "samples": 64, "bounces": 4, "volume_fog": False, "spot_beam": True,
        "output_name": "table_preview.png",
    },
    "render_final.py": {
        "name": "final", "engine": "CYCLES", "resolution": (1920, 1080),
        "samples": 1024, "bounces": 12, "volume_fog": True, "spot_beam": True,
        "output_name": "table_final.png",
    },
}

template = (HERE / "src" / "scene_template.py").read_text(encoding="utf-8")
assert template.count(MARKER) == 1
for filename, profile in PROFILES.items():
    text = template.replace(MARKER, "PROFILE = " + repr(profile))
    (HERE / filename).write_text(text, encoding="utf-8")
    print("wrote", filename)
