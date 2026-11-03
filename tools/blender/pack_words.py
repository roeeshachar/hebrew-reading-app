"""Packs the word pictures rendered by tools/blender/words/render_words.py into assets/words/*.webp.

    python tools/blender/pack_words.py <folder with the rendered PNGs> [output folder, default assets/words]

Each picture is trimmed to its content and scaled to fit 230 px, so they all sit well in the games.
"""
import os, sys
from PIL import Image

A = sys.argv[1]
O = sys.argv[2] if len(sys.argv) > 2 else 'assets/words'
os.makedirs(O, exist_ok=True)
total = 0
for f in sorted(os.listdir(A)):
    if not f.endswith('.png'): continue
    im = Image.open(os.path.join(A, f)).convert('RGBA')
    bb = im.getchannel('A').point(lambda a: 255 if a > 10 else 0).getbbox()
    pad = 6
    im = im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)))
    s = 230 / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    out = os.path.join(O, f[:-4] + '.webp')
    im.save(out, 'WEBP', quality=86, method=6)
    total += os.path.getsize(out)
print(f'{len(os.listdir(O))} pictures, {total // 1024} KB')
