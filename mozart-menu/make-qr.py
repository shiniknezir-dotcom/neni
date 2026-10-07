#!/usr/bin/env python3
"""Generate the QR codes for the Mozart digital menu.

Usage:  python3 make-qr.py [URL]
Default URL is the GitHub Pages address of this folder. Re-run with a new URL
(e.g. a custom domain such as https://menu.mozart-wuerzburg.de) and every QR
file in qr/ is regenerated. Requires: pip install qrcode pillow segno
"""
import os, sys
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
from qrcode.image.styles.colormasks import SolidFillColorMask
from PIL import Image
import segno

HERE = os.path.dirname(os.path.abspath(__file__))
URL = sys.argv[1] if len(sys.argv) > 1 else "https://shiniknezir-dotcom.github.io/neni/mozart-menu/"
OUT = os.path.join(HERE, "qr")
os.makedirs(OUT, exist_ok=True)

PLUM = (19, 7, 11)
CREAM = (244, 236, 220)
LOGO = os.path.join(HERE, "assets", "icon-512.png")

def styled(front, back, logo, name, box=24):
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=box, border=3)
    qr.add_data(URL)
    qr.make(fit=True)
    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(radius_ratio=0.85),
        color_mask=SolidFillColorMask(back_color=back, front_color=front),
        embeded_image_path=logo,
    ).convert("RGB")
    img.save(os.path.join(OUT, name), optimize=True)
    return img

# 1) Brand version: plum modules on cream, Mozart wordmark in the centre (print on cards, stickers)
styled(PLUM, CREAM, LOGO, "mozart-menu-qr.png")
# 2) Inverted brand version for dark backgrounds (cream modules on plum) — scanners read this fine,
#    but print the cream one if in doubt.
styled(CREAM, PLUM, LOGO, "mozart-menu-qr-dark.png")
# 3) Maximum-compatibility version: plain black on white, no logo (for tiny prints / newspaper / laminates)
styled((0, 0, 0), (255, 255, 255), None, "mozart-menu-qr-plain.png")
# 4) Vector versions for the print shop
s = segno.make(URL, error="h")
s.save(os.path.join(OUT, "mozart-menu-qr.svg"), scale=12, border=3, dark="#13070b", light="#f4ecdc")
s.save(os.path.join(OUT, "mozart-menu-qr-plain.svg"), scale=12, border=3, dark="#000000", light="#ffffff")
s.save(os.path.join(OUT, "mozart-menu-qr.pdf"), scale=12, border=3, dark="#13070b", light="#f4ecdc")

with open(os.path.join(OUT, "URL.txt"), "w") as f:
    f.write(URL + "\n")
print("QR codes written to", OUT, "for", URL)
