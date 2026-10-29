#!/usr/bin/env python3
"""Give every page asset a new ?v= number so browsers fetch fresh copies after a deploy.

Updates style.css, app.js and the local modules (imports in app.js + modulepreload
links in index.html) to the same version. Run from the repo root before committing:
    python3 tools/bump-version.py
"""
import re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
index, app = root / "index.html", root / "app.js"
html, js = index.read_text(), app.read_text()
mods = ["firebase-config.js", "settle.js", "icons.js", "i18n.js", "legal.js"]

nums = [int(n) for n in re.findall(r"\?v=(\d+)", html)]
v = max(nums + [0]) + 1

for name in ["style.css", "app.js"] + mods:
    pat = re.escape(name) + r'(\?v=\d+)?"'
    html = re.sub(r'(href|src)="' + pat, lambda m: f'{m.group(1)}="{name}?v={v}"', html)
for name in mods:
    js = re.sub(r'from "\./' + re.escape(name) + r'(\?v=\d+)?"', f'from "./{name}?v={v}"', js)

index.write_text(html)
app.write_text(js)
print(f"assets now at ?v={v}")
