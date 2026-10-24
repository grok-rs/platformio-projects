# crop.py SHOTS: splits each full-page PNG into viewport-sized views X-c1.png, X-c2.png … (max 16 per page).
# Views of tall pages that check.mjs already saved as X-cN.png (no X.png beside them) are kept as they are.
import sys, os, glob, re
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
d = sys.argv[1]
for f in glob.glob(os.path.join(d, '*-c[0-9]*.png')):
    if os.path.exists(re.sub(r'-c\d+\.png$', '.png', f)): os.remove(f)
for f in sorted(glob.glob(os.path.join(d, '*.png'))):
    if re.search(r'-c\d+\.png$', f): continue
    im = Image.open(f); w, h = im.size; step = 1500 if w > 600 else 1300
    b = f[:-4]
    for i, y in enumerate(range(0, h, step)[:16], 1):
        im.crop((0, y, w, min(h, y + step))).save(f'{b}-c{i}.png')
