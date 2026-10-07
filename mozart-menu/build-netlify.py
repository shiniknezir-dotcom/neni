#!/usr/bin/env python3
"""Pack the menu site into mozart-menu-netlify.zip for Netlify's drag-and-drop deploy
(https://app.netlify.com/drop). index.html sits at the zip root, as Netlify expects.
Run after any change to the menu: python3 build-netlify.py
"""
import os, zipfile, glob

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "mozart-menu-netlify.zip")
FILES = [
    "index.html", "style.css", "app.js", "menu-data.js", "manifest.webmanifest", "netlify.toml",
    "qr-card.html",
] + sorted(glob.glob(os.path.join(HERE, "assets", "*"))) + sorted(glob.glob(os.path.join(HERE, "qr", "*.png")))

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for f in FILES:
        src = f if os.path.isabs(f) else os.path.join(HERE, f)
        if not os.path.exists(src):
            raise SystemExit(f"missing: {src}")
        z.write(src, os.path.relpath(src, HERE))
names = zipfile.ZipFile(OUT).namelist()
print(f"{OUT}: {len(names)} files, {os.path.getsize(OUT) // 1024} KB")
for n in names: print("  ", n)
