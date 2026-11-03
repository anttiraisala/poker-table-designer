#!/usr/bin/env python3
"""Convert index.html into the fragment format the Claude Artifact tool expects.

The Artifact host wraps the published file in its own document skeleton, so the
file must not contain <!doctype>, <html>, <head> or <body> tags. index.html stays
the source of truth (a complete standalone page); this script only strips the
wrapper and checks that the Artifact-specific pieces are still there.

Usage: python3 scripts/make-artifact.py [input.html] [output.html]
Defaults: index.html -> dist/artifact.html
"""
import pathlib
import re
import sys

REQUIRED = '<meta name="claude:viewport-fit-sides" content="cover">'

src_path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "index.html")
out_path = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "dist/artifact.html")

text = src_path.read_text(encoding="utf-8")

# The host skeleton provides charset and viewport.
text = re.sub(r'<meta\s+charset="[^"]*"\s*>\s*', "", text, flags=re.I)
text = re.sub(r'<meta\s+name="viewport"[^>]*>\s*', "", text, flags=re.I)
# Wrapper tags (\b keeps <header> and similar tags untouched).
text = re.sub(r"<!doctype[^>]*>\s*", "", text, flags=re.I)
text = re.sub(r"</?(html|head|body)\b[^>]*>\s*", "", text, flags=re.I)

if REQUIRED not in text:
    sys.exit("error: the claude:viewport-fit-sides meta tag is missing from " + str(src_path))
if re.search(r"<title>.+?</title>", text[:8192], flags=re.S) is None:
    sys.exit("error: <title> must be within the first 8 KB of the artifact file")

out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(text.strip() + "\n", encoding="utf-8")
print("wrote %s (%d bytes)" % (out_path, out_path.stat().st_size))
