"""Turns the PNGs that render_kit.py makes into the small WebP files the app uses.

    python tools/blender/pack_assets.py  <folder with the rendered PNGs>  [output folder, default assets]

Pairs that must line up (the cannon, the monster's faces) are cropped with the same box.
Needs Pillow. It also prints the cannon's pivot point, which styles.css and src/arena.js use.
"""
import json, os, sys
from PIL import Image

A = sys.argv[1]
O = sys.argv[2] if len(sys.argv) > 2 else 'assets'
os.makedirs(O, exist_ok=True)
load = lambda n: Image.open(os.path.join(A, n + '.png')).convert('RGBA')
bbox = lambda im: im.getchannel('A').point(lambda a: 255 if a > 10 else 0).getbbox()

def union(ims, pad=6):
    bs = [bbox(i) for i in ims]
    b = (min(x[0] for x in bs), min(x[1] for x in bs), max(x[2] for x in bs), max(x[3] for x in bs))
    return (max(0, b[0] - pad), max(0, b[1] - pad), min(ims[0].width, b[2] + pad), min(ims[0].height, b[3] + pad))

def save(name, im, width):
    im = im.resize((width, max(1, round(im.height * width / im.width))), Image.LANCZOS)
    im.save(os.path.join(O, name + '.webp'), 'WEBP', quality=90, method=6)
    print(name, im.size, os.path.getsize(os.path.join(O, name + '.webp')) // 1024, 'KB')
    return im.size

for n in ('bubble_blue', 'bubble_pink', 'bubble_green'):
    im = load(n); save(n.replace('_', '-'), im.crop(union([im], 4)), 240)
base, barrel = load('cannon_base'), load('cannon_barrel'); box = union([base, barrel], 4)
cx = base.width / 2  # the barrel is drawn on the centre line
pivot = ((cx - box[0]) / (box[2] - box[0]), (bbox(barrel)[3] - box[1]) / (box[3] - box[1]))
save('cannon-base', base.crop(box), 300); save('cannon-barrel', barrel.crop(box), 300)
print('cannon pivot (x, y as a fraction of the image):', [round(p, 4) for p in pivot])
moods = [load('monster_happy'), load('monster_oh'), load('monster_sad')]; box = union(moods)
for n, im in zip(('monster-happy', 'monster-oh', 'monster-sad'), moods): save(n, im.crop(box), 340)
im = load('dragon'); save('dragon', im.crop(union([im])), 340)
for n, w in (('icon_starts', 230), ('icon_bubbles', 200), ('icon_build', 200), ('icon_read', 160), ('star', 150), ('house', 150), ('trophy', 260)):
    im = load(n); save(n.replace('_', '-'), im.crop(union([im], 4)), w)
