#!/usr/bin/env python3
"""Build the upload-ready zip for Netlify's drag-and-drop deploy. Python standard library only.

  python3 tools/make_zip.py            # writes dist/bluetensturm-netlify.zip

The zip holds the CONTENTS of site/ at its root (index.html, _headers, _redirects,
assets/ …), which is what Netlify publishes. Run tools/check_site.py first; this
script refuses to build while it reports errors.
"""
import os, subprocess, sys, zipfile

BASE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SITE = os.path.join(BASE, 'site')
OUT = os.path.join(BASE, 'dist', 'bluetensturm-netlify.zip')
SKIP = {'.DS_Store', 'Thumbs.db'}

check = subprocess.run([sys.executable, os.path.join(BASE, 'tools', 'check_site.py')], capture_output=True, text=True)
if check.returncode != 0:
    print(check.stdout[-2000:])
    sys.exit('check_site.py reports errors: fix them before building the zip')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
files = []
for root, dirs, names in os.walk(SITE):
    dirs[:] = sorted(d for d in dirs if not d.startswith('.'))
    for n in sorted(names):
        if n in SKIP or n.startswith('.'):
            continue
        files.append(os.path.join(root, n))
with zipfile.ZipFile(OUT, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in files:
        arc = os.path.relpath(f, SITE).replace(os.sep, '/')
        info = zipfile.ZipInfo(arc, date_time=(2026, 1, 1, 0, 0, 0))   # fixed date: same files, same zip
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        with open(f, 'rb') as fh:
            z.writestr(info, fh.read(), compresslevel=9)
print(f'{OUT}: {len(files)} files, {os.path.getsize(OUT) / 1e6:.2f} MB')
for must in ('index.html', '_headers', '_redirects', '404.html'):
    if must not in {os.path.relpath(f, SITE).replace(os.sep, '/') for f in files}:
        sys.exit(f'missing {must} in the zip')
