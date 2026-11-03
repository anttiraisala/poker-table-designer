#!/usr/bin/env python3
"""Convert index.html into the fragment format the Claude Artifact tool expects.

The Artifact host wraps the published file in its own document skeleton, so the
file must not contain <!doctype>, <html>, <head> or <body> tags, and it has no
folder to load js/ and css/ files from. index.html stays the source of truth (a
complete standalone page that loads local files); this script strips the wrapper,
inlines the local scripts and stylesheets, and checks that the Artifact-specific
pieces are still there.

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
base = src_path.resolve().parent


def inline_script(match):
    code = (base / match.group(1)).read_text(encoding="utf-8")
    return "<script>\n" + code.replace("</script", "<\\/script") + "\n</script>"


def inline_css(match):
    return "<style>\n" + (base / match.group(1)).read_text(encoding="utf-8") + "\n</style>"


# Local files only: anything with a scheme (http:, https:) or a leading slash stays as it is.
text = re.sub(r'<script\s+src="(?![a-z]+:|/)([^"]+)"\s*>\s*</script>', inline_script, text)
text = re.sub(r'<link\s+rel="stylesheet"\s+href="(?![a-z]+:|/)([^"]+)"\s*>', inline_css, text)

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
