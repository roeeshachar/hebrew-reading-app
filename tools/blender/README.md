# Art made in Blender

The pictures in `assets/` (bubbles, cannon, monster, dragon, icons, star, trophy) are rendered from
`render_kit.py`, a Blender script, so any of them can be changed and rendered again.

## One-time setup
```
python3.13 -m venv .blender && . .blender/bin/activate     # the bpy wheel matches your Python version
pip install bpy fonttools brotli pillow                    # Blender as a Python module (~400 MB)
python - <<'PY'                                            # a TTF with Hebrew letters, for the 3D blocks
from fontTools.ttLib import TTFont
f = TTFont('fonts/rubik-hebrew-800-normal.woff2'); f.flavor = None; f.save('rubik800.ttf')
PY
```

## Render and pack
```
mkdir renders
python tools/blender/render_kit.py -- renders             # all of it, a few minutes on a laptop CPU
python tools/blender/render_kit.py -- renders star house  # only some, by name
python tools/blender/pack_assets.py renders assets
```
`render_kit.py` expects `rubik800.ttf` next to the output folder. The pack step prints the
cannon's pivot point; if it changes, update `src/arena.js` (`muzzle`) and the `.shooter .barrel`
rule in `styles.css`.

Then bump `VERSION` in `sw.js` so phones fetch the new pictures.

## Notes
- Colours and shapes are at the top of each scene function. Characters are simple shapes on purpose;
  an artist's model can replace them, as long as the file names stay the same.

## The word pictures
The 41 pictures in `assets/words/` come from `tools/blender/words/` (one function per word, in `words_a.py`,
`words_b.py`, `words_c.py`, with shared helpers in `words_lib.py`).
```
python tools/blender/words/render_words.py -- renders/words              # all of them (about 5 minutes)
python tools/blender/words/render_words.py -- renders/words kelev etz    # only some, by word id
python tools/blender/pack_words.py renders/words assets/words
```
A new word needs its function, a picture in `assets/words/`, and its id in the list in `sw.js`. A test checks all three.
