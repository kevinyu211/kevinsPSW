"""Facade atlas: 1024x1024, 16 rows x 16 bays, one row per facade style.

Every row is one floor high and repeats in U, so a facade is drawn as one quad per floor.
Texture values are multiplied by the vertex colour (wall tint) in the shared material.
Run inside Blender (uses numpy + bpy to save the PNG).
"""
import numpy as np

SIZE = 1024
ROWS = 16
BAYS = 16
T = SIZE // ROWS  # 64 px tile

STYLES = ['none', 'punch', 'deco', 'curtain', 'ribbon', 'balcony', 'shop', 'brick', 'sleek',
          'corrugated', 'shikumen', 'hotel', 'louver', 'container', 'planks', 'tiles']
STYLE = {n: i for i, n in enumerate(STYLES)}

GLASS = np.array([0.20, 0.27, 0.36])
LIT = np.array([1.0, 0.84, 0.55])


def build():
    rng = np.random.default_rng(7)
    img = np.ones((SIZE, SIZE, 3), dtype=np.float32)

    def rect(row, bay, x0, y0, x1, y1, col):
        ox, oy = bay * T, row * T
        img[oy + y0:oy + y1, ox + x0:ox + x1] = col

    def glass(k=1.0, lit=0.0, jitter=0.05):
        if rng.random() < lit:
            return LIT * (0.8 + 0.2 * rng.random())
        return np.clip(GLASS * k + rng.uniform(-jitter, jitter), 0, 1)

    for b in range(BAYS):
        # 1 punch: stone office with punched windows
        r = STYLE['punch']
        rect(r, b, 11, 9, 53, 52, 0.72)
        rect(r, b, 13, 11, 51, 50, glass(lit=0.08))
        rect(r, b, 31, 11, 33, 50, 0.55)
        rect(r, b, 13, 11, 51, 11 + int(rng.integers(0, 14)), 0.80)  # blinds
        rect(r, b, 9, 52, 55, 55, 0.84)
        # 2 deco: vertical piers, paired tall windows, dark spandrels
        r = STYLE['deco']
        rect(r, b, 8, 0, 56, 64, 0.80)
        rect(r, b, 28, 0, 36, 64, 1.0)
        rect(r, b, 9, 6, 27, 46, glass(lit=0.07))
        rect(r, b, 37, 6, 55, 46, glass(lit=0.07))
        rect(r, b, 12, 52, 24, 58, 0.68)
        rect(r, b, 40, 52, 52, 58, 0.68)
        # 3 curtain wall: two panes, spandrel band, mullions
        r = STYLE['curtain']
        for p in range(2):
            v = 0.84 + 0.16 * rng.random()
            rect(r, b, p * 32, 0, p * 32 + 32, 46, np.array([v, v, v]))
            if rng.random() < 0.05:
                rect(r, b, p * 32, 0, p * 32 + 32, 46, LIT * 0.95)
        rect(r, b, 0, 46, 64, 64, np.array([0.60, 0.64, 0.68]))
        rect(r, b, 0, 0, 2, 64, 0.34)
        rect(r, b, 31, 0, 33, 64, 0.42)
        rect(r, b, 0, 45, 64, 47, 0.40)
        rect(r, b, 0, 62, 64, 64, 0.40)
        # 4 ribbon windows
        r = STYLE['ribbon']
        rect(r, b, 0, 17, 64, 47, glass(k=1.05, lit=0.06))
        rect(r, b, 0, 15, 64, 17, 0.70)
        rect(r, b, 0, 47, 64, 49, 0.80)
        rect(r, b, 0, 17, 2, 47, 0.55)
        rect(r, b, 31, 17, 33, 47, 0.62)
        # 5 balcony: residential bay with a balcony
        r = STYLE['balcony']
        rect(r, b, 6, 8, 40, 52, 0.76)
        rect(r, b, 8, 10, 38, 52, glass(lit=0.14))
        rect(r, b, 22, 10, 24, 52, 0.6)
        rect(r, b, 46, 16, 58, 40, glass(lit=0.10))
        rect(r, b, 2, 36, 62, 38, 0.58)
        rect(r, b, 2, 38, 62, 52, np.array([0.80, 0.84, 0.86]))
        for x in range(2, 62, 10):
            rect(r, b, x, 38, x + 1, 52, 0.62)
        rect(r, b, 0, 52, 64, 57, 0.66)
        # 6 shopfront
        r = STYLE['shop']
        rect(r, b, 0, 0, 64, 4, 0.82)
        rect(r, b, 2, 5, 62, 17, 0.90)
        rect(r, b, 2, 17, 62, 19, 0.6)
        warm = rng.random() < 0.45
        g = (LIT * 0.82) if warm else np.array([0.22, 0.32, 0.38])
        rect(r, b, 4, 21, 60, 56, g)
        rect(r, b, 31, 21, 33, 56, 0.45)
        rect(r, b, 4, 21, 60, 23, 0.45)
        if b % 4 == 1:
            rect(r, b, 20, 24, 44, 62, 0.42)
            rect(r, b, 22, 26, 42, 62, np.array([0.16, 0.20, 0.24]))
        rect(r, b, 0, 56 if b % 4 != 1 else 62, 64, 64, 0.58)
        # 7 brick walk-up window
        r = STYLE['brick']
        rect(r, b, 0, 0, 64, 64, 0.84)
        for y in range(0, 64, 8):
            rect(r, b, 0, y, 64, y + 1, 0.74)
        rect(r, b, 18, 8, 46, 13, 1.0)
        rect(r, b, 20, 13, 44, 48, glass(lit=0.12))
        rect(r, b, 20, 30, 44, 32, 0.80)
        rect(r, b, 31, 13, 33, 48, 0.80)
        rect(r, b, 17, 48, 47, 52, 1.0)
        # 8 sleek glass: fine mullions, no spandrel
        r = STYLE['sleek']
        for p in range(4):
            v = 0.82 + 0.18 * rng.random()
            rect(r, b, p * 16, 0, p * 16 + 16, 64, np.array([v, v, v]))
            if rng.random() < 0.04:
                rect(r, b, p * 16, 4, p * 16 + 16, 60, LIT * 0.9)
            rect(r, b, p * 16, 0, p * 16 + 1, 64, 0.58)
        rect(r, b, 0, 61, 64, 64, 0.52)
        # 9 corrugated metal
        r = STYLE['corrugated']
        for x in range(0, 64, 4):
            rect(r, b, x, 0, x + 2, 64, 0.90)
        rect(r, b, 0, 56, 64, 64, 0.72)
        if b % 3 == 0:
            rect(r, b, 18, 8, 46, 20, glass())
        # 10 shikumen lane house
        r = STYLE['shikumen']
        rect(r, b, 0, 0, 64, 64, 0.86)
        for y in range(0, 64, 6):
            rect(r, b, 0, y, 64, y + 1, 0.78)
        rect(r, b, 0, 0, 64, 4, np.array([1.0, 0.56, 0.46]))
        rect(r, b, 0, 54, 64, 58, np.array([1.0, 0.56, 0.46]))
        rect(r, b, 16, 8, 48, 12, 1.0)
        rect(r, b, 18, 12, 46, 50, np.array([0.34, 0.22, 0.17]))
        rect(r, b, 24, 14, 40, 48, glass(lit=0.15))
        rect(r, b, 31, 14, 33, 48, np.array([0.34, 0.22, 0.17]))
        # 11 hotel
        r = STYLE['hotel']
        rect(r, b, 14, 12, 50, 50, 0.74)
        rect(r, b, 16, 14, 48, 48, glass(lit=0.38))
        rect(r, b, 31, 14, 33, 48, 0.6)
        rect(r, b, 20, 53, 44, 58, 0.72)
        # 12 louvers
        r = STYLE['louver']
        for y in range(0, 64, 4):
            rect(r, b, 0, y, 64, y + 2, 0.78)
            rect(r, b, 0, y + 2, 64, y + 4, 0.52)
        # 13 container side
        r = STYLE['container']
        for x in range(0, 64, 4):
            rect(r, b, x, 0, x + 2, 64, 0.86)
        rect(r, b, 0, 0, 64, 3, 0.68)
        rect(r, b, 0, 61, 64, 64, 0.68)
        rect(r, b, 0, 0, 2, 64, 0.62)
        # 14 planks
        r = STYLE['planks']
        for y in range(0, 64, 8):
            v = 0.86 + 0.14 * rng.random()
            rect(r, b, 0, y, 64, y + 8, np.array([v, v, v]))
            rect(r, b, 0, y, 64, y + 1, 0.70)
        # 15 roof tiles
        r = STYLE['tiles']
        for i, y in enumerate(range(0, 64, 8)):
            rect(r, b, 0, y, 64, y + 1, 0.76)
            for x in range((i % 2) * 8, 64, 16):
                rect(r, b, x, y, x + 1, y + 8, 0.84)
    return img


def save(path):
    import bpy
    img = build()
    rgba = np.concatenate([img[::-1], np.ones((SIZE, SIZE, 1), dtype=np.float32)], axis=2)
    im = bpy.data.images.new('atlas', SIZE, SIZE, alpha=False)
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw = path
    im.file_format = 'PNG'
    im.save()
    return im
