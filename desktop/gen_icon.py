#!/usr/bin/env python3
"""Build the Windows .ico from the rasterized classic Scratch Cat.

Source: desktop/icon_tmp/icon_raw.png — a 512x512 white-background render of
packages/scratch-gui/src/lib/default-project/bcf454acf82e4504149f7ffe07081dbc.svg
(the default Scratch Cat costume) produced with headless Chrome.
"""
import os
from PIL import Image, ImageChops

ROOT = r"F:/Workspace/Buddy/fork/fork-scratch-editor"
RAW = os.path.join(ROOT, "desktop/icon_tmp/icon_raw.png")
OUT_DIR = os.path.join(ROOT, "desktop/resources")
OUT_ICO = os.path.join(OUT_DIR, "icon.ico")
OUT_PNG = os.path.join(OUT_DIR, "icon.png")

img = Image.open(RAW).convert("RGB")

# 1) Crop the white margins down to the cat.
bg = Image.new("RGB", img.size, (255, 255, 255))
bbox = ImageChops.difference(img, bg).getbbox()
if bbox:
    img = img.crop(bbox)
print("cropped cat bbox:", bbox, "->", img.size)

# 2) Square it on white, centered, with a little padding.
def to_square(src, size):
    sq = Image.new("RGB", (size, size), (255, 255, 255))
    target = int(size * 0.92)
    ratio = min(target / src.width, target / src.height)
    w = max(1, round(src.width * ratio))
    h = max(1, round(src.height * ratio))
    resized = src.resize((w, h), Image.LANCZOS)
    sq.paste(resized, ((size - w) // 2, (size - h) // 2))
    return sq

square = to_square(img, 256)

# 3) Save a high-res PNG (also useful as a fallback / macOS source).
square.resize((512, 512), Image.LANCZOS).save(OUT_PNG, "PNG")
print("wrote", OUT_PNG)

# 4) Build the .ico with the sizes Windows expects.
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
# Pillow resizes the source per size when given `sizes`.
square.save(OUT_ICO, "ICO", sizes=sizes)
print("wrote", OUT_ICO, "sizes:", sizes)
