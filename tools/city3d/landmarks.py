"""Hero buildings: Kevin's tower, one headquarters per project, station modules, empty plot.

Front = -Y in Blender (+Z in glTF). Each has a screen quad (<name>_screen) for real project images.
No client names appear on the court-booking or export-tool buildings.
"""
import math
from lib import Model, rect, chamfer, ngon, xform, grad, shade, mixc, C

LANDMARKS = []


def lm(project=None, **kw):
    def deco(fn):
        def make():
            m = Model(fn.__name__, 'landmark', project=project, **kw)
            fn(m)
            return m
        LANDMARKS.append(make)
        return fn
    return deco


# ------------------------------------------------------------------ helpers
def lot(m, w, d, col='paving', h=0.3, cy=0.0):
    m.box(-w / 2, w / 2, cy - d / 2, cy + d / 2, 0, h, 'stone', col)
    return h


def front(m, pts, y, col):
    """Polygon facing -Y from (x, z) points given counter-clockwise as seen from the front."""
    m.poly([(x, y, z) for x, z in pts], col)


def disc(m, cx, z, r, n, y, col, rot=0.0):
    front(m, [(cx + r * math.cos(rot + 2 * math.pi * i / n), z + r * math.sin(rot + 2 * math.pi * i / n)) for i in range(n)], y, col)


def star(cx, z, r, k=5, inner=0.45, rot=math.pi / 2):
    return [(cx + (r if i % 2 == 0 else r * inner) * math.cos(rot + math.pi * i / k), z + (r if i % 2 == 0 else r * inner) * math.sin(rot + math.pi * i / k)) for i in range(2 * k)]


def heart(cx, z, r, n=16):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx - x * r / 17, z + y * r / 17))
    return pts


def sticker(m, pts, y, col, cx, cz, border=1.18):
    front(m, [(cx + (x - cx) * border, cz + (z - cz) * border) for x, z in pts], y, 'white')
    front(m, pts, y - 0.12, col)


def barrel(m, x0, x1, y0, y1, z0, rise, n, col, end=None):
    """Barrel-vault roof spanning Y, running along X."""
    cy, hw = (y0 + y1) / 2, (y1 - y0) / 2
    arc = [(cy - hw * math.cos(math.pi * i / n), z0 + rise * math.sin(math.pi * i / n)) for i in range(n + 1)]
    for i in range(n):
        (ya, za), (yb, zb) = arc[i], arc[i + 1]
        m.poly([(x1, ya, za), (x1, yb, zb), (x0, yb, zb), (x0, ya, za)], col)
    e = end if end is not None else col
    m.poly([(x0, y, z) for y, z in arc], e)
    m.poly([(x1, y, z) for y, z in arc][::-1], e)


def flag(m, x, y, h, col, z=0.0):
    m.cyl(x, y, z, z + h, 0.1, 4, 'metal_light')
    for o in (1, -1):
        p = [(x, y, z + h - 0.2), (x, y, z + h - 2.0), (x + 2.6, y, z + h - 1.1)]
        m.poly(p if o > 0 else p[::-1], col)


def roundel(m, x, y, z, r=1.4):
    """Metro roundel on a pole (neutral; the canopy part is tinted per line in code)."""
    m.cyl(x, y, 0, z, 0.12, 5, 'steel', cap=False)
    m.hcyl((x, y + 0.15, z + r), (x, y - 0.15, z + r), r, 10, 'white')


# ================================================================== K TOWER
@lm(None, ao=20, seed=1)
def k_tower(m):
    """Kevin's tower: a tapered octagonal supertall with exposed K-bracing, an observation
    ring, a four-blade open crown and a spire. Plaza podium with metro entrances at its base."""
    m.box(-58, 58, -58, 58, 0, 0.9, 'stone', 'paving')
    m.box(-34, 34, -63, -58, 0, 0.45, 'stone', 'paving')
    pod = chamfer(80, 66, 8, 0, 4)
    zp = m.facade(pod, 0.9, 4, 5.0, 'curtain', grad('glass_deep', 'glass_blue'), ground='shop', gh=7.5, bay=4.0)
    m.parapet(pod, zp, 1.3, 'stone_light', roof='paving')
    for x, y in ((-30, -18), (-30, 22), (30, -18), (30, 22), (-32, 2), (32, 2)):
        m.tree(x, y, 0.9, z=zp)
    # shaft
    base = chamfer(54, 54, 10)
    tap = lambda t: 1.0 - 0.37 * t ** 1.55
    shape = lambda t: xform(base, tap(t), 0, 0, 4)
    floors, fh, mod = 77, 4.0, 11
    col = grad('glass_dark', 'glass_sky')
    prev = shape(0.0)
    for f in range(floors):
        t0, t1 = f / floors, (f + 1) / floors
        nxt = shape(t1)
        za, zb = zp + f * fh, zp + (f + 1) * fh
        obs = f in (66, 67)
        for i in range(8):
            j = (i + 1) % 8
            if i % 2 == 1:
                m.wall(prev[i], prev[j], za, zb, 'metal_light', q0=nxt[i], q1=nxt[j])
            else:
                st = 'louver' if f % mod == mod - 1 else ('ribbon' if obs else 'sleek')
                c0, c1 = ('glass_dark', 'glass_dark') if obs else (col(t0), col(t1))
                m.wall(prev[i], prev[j], za, zb, c0, st, 4.0, col1=c1, q0=nxt[i], q1=nxt[j], u0=m.rng.randrange(16) / 16)
        prev = nxt
    zt = zp + floors * fh
    m.cap(prev, zt, 'metal')

    def P(i, t, out=0.0):
        """Point on shaft vertex i at height fraction t, pushed outward."""
        x, y = shape(t)[i % 8]
        d = math.hypot(x, y - 4) or 1
        return (x + x / d * out, y + (y - 4) / d * out, zp + t * floors * fh)

    # K-bracing on the four main faces: a mid-height node on the left chord, two diagonals to the right chord
    for k in range(floors // mod):
        ta, tb = k * mod / floors, (k + 1) * mod / floors
        tm = (ta + tb) / 2
        for i in (0, 2, 4, 6):
            m.beam(P(i, tm, 0.8), P(i + 1, tb, 0.8), 2.4, 1.4, 'white')
            m.beam(P(i, tm, 0.8), P(i + 1, ta, 0.8), 2.4, 1.4, 'white')
    # observation ring
    to = 66 / floors
    ring_in = shape(to)
    ring_out = xform(base, tap(to) * 1.16, 0, 0, 4)
    zo = zp + 66 * fh
    m.cap_ring(ring_out, ring_in, zo, 'cobalt')
    m.frustum(ring_in, ring_out, zo - 2.2, zo, 'white', top=False)
    for i in range(8):
        m.wall(ring_out[i], ring_out[(i + 1) % 8], zo, zo + 1.3, 'glass_sky')
    # crown: glass lantern + four blades + spire
    lan = xform(base, tap(1.0) * 0.72, 0, 0, 4)
    zl, ltop = m.stack(lambda t: xform(base, tap(1.0) * (0.72 - 0.30 * t), 0, 0, 4), zt, 8, 3.75, 'sleek', grad('glass_sky', 'white'), bay=4.0)
    m.cap(ltop, zl, 'metal_light')
    for i in (1, 3, 5, 7):
        a0, a1 = P(i, 1.0, 0.6), P(i + 1, 1.0, 0.6)
        c = ((a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2, zt)
        d = math.hypot(c[0], c[1] - 4)
        tip = (c[0] / d * 4.5, 4 + (c[1] - 4) / d * 4.5, zt + 56)
        m.beam(c, tip, 5.0, 1.6, 'white')
    m.cyl(0, 4, zt + 30, zt + 58, 1.4, 6, 'metal_light', r2=0.9)
    m.cyl(0, 4, zt + 58, zt + 86, 0.9, 6, 'metal_light', r2=0.1)
    m.sphere(0, 4, zt + 58, 1.6, 6, 4, 'cobalt')
    # K roundel and media wall on the podium
    m.hcyl((0, -29.2, zp + 9), (0, -30.0, zp + 9), 7.5, 16, 'cobalt')
    m.text('K', 10.5, 0.4, -30.1, zp + 5.4, 'white', depth=0.5)
    m.beam((-3, -29.4, zp), (-3, -29.4, zp + 3), 0.8, 0.8, 'steel')
    m.beam((3, -29.4, zp), (3, -29.4, zp + 3), 0.8, 0.8, 'steel')
    m.screen((-24, -29.25), (-6, -29.25), 9.5, 19.5, frame=0.8)
    m.screen((6, -29.25), (24, -29.25), 9.5, 19.5, suffix='screen2', frame=0.8)
    # metro entrances on the plaza
    for sx in (-1, 1):
        x = sx * 42
        m.facade(rect(10, 7, x, -46), 0.9, 1, 4.2, 'shop', 'glass_teal', bay=3.3)
        m.part('canopy')
        m.box(x - 6.5, x + 6.5, -51, -41, 5.1, 5.7, 'white', bottom=True)
        m.part('')
        roundel(m, x + sx * 8, -50, 6.5)
    for x in (-48, -36, 36, 48):
        m.tree(x, 44, 1.0, z=0.9)
        m.tree(x, -30 if abs(x) > 40 else 30, 1.0, z=0.9)


# ================================================================== SOFTWARE
@lm('hirvo', ao=12, seed=2)
def hq_hirvo(m):
    """Tech tower with a media facade and a giant résumé sheet (with a green check) on the plaza."""
    z0 = lot(m, 66, 56)
    pod = rect(52, 40, 2, 6)
    zp = m.facade(pod, z0, 3, 4.6, 'curtain', 'glass_blue', ground='shop', gh=6.5)
    m.parapet(pod, zp, 1.2, 'stone_light', roof='paving')
    tw = rect(36, 24, 4, 10)
    z = m.facade(tw, zp, 24, 4.0, 'sleek', grad('glass_deep', 'glass_sky'), band={23: 'louver'})
    m.parapet(tw, z, 2.2, 'metal')
    m.roof_kit(-12, 20, 0, 20, z, n=3)
    m.screen((-9, -2.4), (17, -2.4), zp + 8, zp + 60, frame=1.2, depth=0.6)
    m.box(-15.6, -14, -2.6, 22.6, zp, z + 9, 'red', 'red')
    m.text('HIRVO', 4.6, 6, -2.2, z + 3.4, 'white', depth=0.5)
    m.beam((-4, -1.9, z + 2.6), (16, -1.9, z + 2.6), 0.5, 0.5, 'steel')
    m.box(-12, 12, -18, -14, 6.3, 6.9, 'white', bottom=True)
    # résumé sheet sculpture
    m.push(x=-23, y=-20, z=z0, rz=0.3)
    m.box(-3.4, 3.4, -0.35, 0.35, 0, 10, 'white', bottom=True)
    for k in range(6):
        w = (4.6, 2.6, 5.2, 4.4, 5.2, 3.4)[k]
        m.box(-2.6, -2.6 + w, -0.45, -0.35, 8.4 - k * 1.05, 8.9 - k * 1.05, 'cobalt' if k == 0 else 'concrete_dark', bottom=True)
    m.beam((0.2, -0.5, 1.9), (1.2, -0.5, 0.9), 0.5, 0.3, 'green')
    m.beam((1.0, -0.5, 0.9), (2.9, -0.5, 3.0), 0.5, 0.3, 'green')
    m.pop()
    for x, y in ((26, -22), (18, -23), (-30, 6), (-30, 16)):
        m.tree(x, y, 0.9, z=z0)


@lm('trade', ao=9, seed=3)
def hq_trade(m):
    """Export terminal office: control tower, risk board, containers, flags."""
    z0 = lot(m, 72, 50, 'asphalt')
    off = rect(36, 18, -10, 8)
    z = m.facade(off, z0, 5, 3.9, 'ribbon', 'concrete', ground='shop', gh=5.2)
    m.parapet(off, z, 1.0, 'concrete')
    m.roof_kit(-26, 6, 1, 15, z, n=3)
    m.screen((-22, -1.25), (2, -1.25), z0 + 8.2, z0 + 18.4, frame=0.9)
    # control tower
    zc = m.facade(rect(8, 8, 22, 10), z0, 9, 4.0, 'none', 'white')
    m.box(18.2, 25.8, 5.9, 6.0, z0 + 6, zc - 2, 'red', bottom=True)
    m.frustum(rect(8, 8, 22, 10), rect(14, 14, 22, 10), zc, zc + 2.2, 'white', top=False)
    m.frustum(rect(14, 14, 22, 10), rect(15.6, 15.6, 22, 10), zc + 2.2, zc + 6.2, 'glass_dark', top=False)
    m.box(13.6, 30.4, 1.6, 18.4, zc + 6.2, zc + 7.0, 'white', 'roof_light', bottom=True)
    m.cyl(22, 10, zc + 7.0, zc + 15, 0.25, 5, 'steel')
    m.beam((18.5, 10, zc + 10.5), (25.5, 10, zc + 10.5), 0.5, 1.4, 'metal_light')
    m.cyl(26, 14, zc + 7.0, zc + 8.2, 1.6, 8, 'white', r2=2.2)
    # containers
    for i, (cx, cy, n) in enumerate(((-24, -15, 2), (-10, -15, 3), (4, -15, 2), (-17, -18.2, 1), (18, -16, 2), (30, -16, 1))):
        for k in range(n):
            col = ('red', 'cobalt', 'orange', 'teal', 'yellow', 'green')[(i + k * 2) % 6]
            m.facade(rect(12.2, 2.44, cx, cy), z0 + k * 2.6, 1, 2.6, 'container', col, bay=3.05)
            m.cap(rect(12.2, 2.44, cx, cy), z0 + (k + 1) * 2.6, shade(col, 0.85))
    for i, c in enumerate(('red', 'cobalt', 'yellow', 'green')):
        flag(m, 8 + i * 3.4, -22, 11, c, z0)


@lm('court', ao=9, seed=4)
def hq_court(m):
    """Sports hall with a barrel roof, a rooftop court, a giant booking phone and a basketball."""
    z0 = lot(m, 84, 56)
    m.facade(rect(48, 34, -14, 6), z0, 1, 9.0, 'corrugated', 'white', bay=4.8)
    barrel(m, -38, 10, -11, 23, z0 + 9, 8.5, 8, 'cobalt', end='glass_sky')
    m.box(-22, -6, -13.5, -11, z0, z0 + 5.5, 'glass_teal', 'white')
    an = rect(26, 34, 25, 6)
    za = m.facade(an, z0, 2, 4.3, 'ribbon', 'stone_light', ground='shop', gh=5)
    m.cap(an, za, 'roof_green')
    Z = za + 0.06
    def line(x0, x1, y0, y1):
        m.poly([(x0, y0, Z), (x1, y0, Z), (x1, y1, Z), (x0, y1, Z)], 'white')
    line(14, 36, -8.6, -8.3); line(14, 36, 20.3, 20.6); line(14, 14.3, -8.6, 20.6); line(35.7, 36, -8.6, 20.6); line(14, 36, 5.85, 6.15)
    m.poly([(22, -8.6, Z), (28, -8.6, Z), (28, -2.8, Z), (22, -2.8, Z)], 'orange')
    m.poly([(22, 14.8, Z), (28, 14.8, Z), (28, 20.6, Z), (22, 20.6, Z)], 'orange')
    for sy, yy in ((-1, -9.6), (1, 21.6)):
        m.cyl(25, yy, za, za + 3.4, 0.14, 5, 'steel', cap=False)
        m.box(24.1, 25.9, yy - sy * 1.0 - 0.06, yy - sy * 1.0 + 0.06, za + 2.9, za + 4.1, 'white', bottom=True)
        m.beam((25, yy, za + 3.3), (25, yy - sy * 1.0, za + 3.3), 0.12, 0.12, 'steel')
        m.torus(25, yy - sy * 1.5, za + 3.05, 0.42, 0.05, 8, 3, 'orange', axis='z')
    for x, y in ((12.2, -10.8), (37.8, -10.8), (37.8, 22.8), (12.2, 22.8)):
        m.cbox(x, y, 0.3, 0.3, za, za + 5, 'steel')
    for a, b in (((12.2, -10.8), (37.8, -10.8)), ((37.8, -10.8), (37.8, 22.8)), ((37.8, 22.8), (12.2, 22.8)), ((12.2, 22.8), (12.2, -10.8))):
        for h in (1.2, 5.0):
            m.beam((*a, za + h), (*b, za + h), 0.12, 0.12, 'steel')
    # giant phone = booking screen
    m.box(-4.6, 4.6, -22.0, -20.9, z0 + 1.2, z0 + 19.2, 'black', bottom=True)
    m.box(-6, 6, -23.2, -19.8, z0, z0 + 1.2, 'stone_light')
    m.screen((-4.0, -22.06), (4.0, -22.06), z0 + 2.4, z0 + 18.0, frame=0)
    m.sphere(-30, -19, z0 + 3.4, 3.4, 10, 6, 'orange')
    m.torus(-30, -19, z0 + 3.4, 3.42, 0.09, 10, 3, 'black', axis='z')
    m.torus(-30, -19, z0 + 3.4, 3.42, 0.09, 10, 3, 'black', axis='x')
    for x in (-36, -24, 18, 34):
        m.tree(x, -24, 0.85, z=z0)


@lm('uhome', ao=10, seed=5)
def hq_uhome(m):
    """Apartment complex: two balcony slabs joined by a glass showroom with a model home on top."""
    z0 = lot(m, 78, 56, 'grass')
    m.poly([(-39, -28, z0 + 0.02), (39, -28, z0 + 0.02), (39, -14, z0 + 0.02), (-39, -14, z0 + 0.02)], 'paving')
    a = rect(30, 16, -20, 14)
    za = m.facade(a, z0, 14, 3.1, 'balcony', 'cream', ground='shop', gh=4.6)
    m.parapet(a, za, 1.0, 'cream')
    m.roof_kit(-33, -7, 8, 20, za, n=2, tank=True)
    b = rect(26, 16, 22, 12)
    zb = m.facade(b, z0, 10, 3.1, 'balcony', 'stone_light', ground='shop', gh=4.6)
    m.parapet(b, zb, 1.0, 'stone_light')
    m.roof_kit(11, 33, 6, 18, zb, n=2)
    m.box(-35.6, -35, 8, 20, z0 + 4.6, za + 2, 'orange', bottom=True)
    m.box(35, 35.6, 6, 18, z0 + 4.6, zb + 2, 'orange', bottom=True)
    sh = rect(40, 16, 0, -6)
    zs = m.facade(sh, z0, 2, 4.4, 'curtain', 'glass_teal', bay=4.0)
    m.parapet(sh, zs, 0.8, 'white', roof='paving')
    m.screen((-17, -14.2), (-1, -14.2), z0 + 1.6, z0 + 7.6, frame=0.5)
    # model home on the showroom roof
    m.box(4, 14, -10, -2, zs, zs + 4.4, 'white', False)
    m.gable(4, 14, -10, -2, zs + 4.4, 3.0, 'orange', axis='x', over=0.6, end='white')
    m.box(7.6, 9.4, -10.08, -10, zs, zs + 2.6, 'wood_dark', bottom=True)
    m.box(10.6, 13, -10.08, -10, zs + 1.2, zs + 3.0, 'glass_dark', bottom=True)
    for x, y in ((-30, -20), (-22, -22), (24, -21), (32, -19), (0, 22), (-4, 14)):
        m.tree(x, y, 0.9, z=z0)


# ================================================================== BOOKS & APPS
def _book(m, x, w, h, col, d=15.0, y0=-6.0, z=0.0, band='gold'):
    """Upright book with its spine to the front."""
    m.box(x - w / 2, x - w / 2 + 0.45, y0, y0 + d, z, z + h, col, bottom=True)
    m.box(x + w / 2 - 0.45, x + w / 2, y0, y0 + d, z, z + h, col, bottom=True)
    m.box(x - w / 2 + 0.45, x + w / 2 - 0.45, y0, y0 + 0.5, z, z + h, col, bottom=True)
    m.box(x - w / 2 + 0.45, x + w / 2 - 0.45, y0 + 0.5, y0 + d - 0.6, z + 0.4, z + h - 0.6, 'cream')
    for zz in (0.72, 0.2):
        m.box(x - w / 2 + 0.2, x + w / 2 - 0.2, y0 - 0.08, y0, z + h * zz, z + h * zz + 0.7, band, bottom=True)


@lm('books', ao=8, seed=6)
def hq_books(m):
    """Bookshop and publishing house: a shelf of giant books above the shop; the front book's cover is the screen."""
    z0 = lot(m, 62, 44)
    shop = rect(46, 22, 0, 4)
    zs = m.facade(shop, z0, 1, 5.6, 'shop', 'cream', bay=3.8)
    m.box(-23.6, 23.6, -7.6, 15.6, zs, zs + 0.9, 'wood_dark', 'wood')
    zs += 0.9
    m.awning(-21, -3, -7, z0 + 5.2, 2.6, 'yellow', drop=0.8)
    m.awning(3, 21, -7, z0 + 5.2, 2.6, 'yellow', drop=0.8)
    x = -21.5
    for w, h, col in ((5.5, 17, 'red'), (4.2, 20, 'teal'), (6.5, 15.5, 'yellow'), (4.8, 19, 'cobalt'), (5.6, 16.5, 'purple'), (4.0, 14, 'green')):
        _book(m, x + w / 2, w, h, col, z=zs)
        x += w + 0.15
    m.push(x=x + 4.2, y=0, z=zs, ry=math.radians(-13))
    _book(m, 0, 5.0, 18, 'orange')
    m.pop()
    # display book standing cover-forward on the plaza: the cover is the screen
    m.push(x=13.5, y=-15.5, z=z0, rz=math.radians(-8))
    m.box(-6.4, 6.4, -0.3, 0.2, 0, 17.4, 'red', bottom=True)
    m.box(-6.0, 6.0, 0.2, 2.6, 0.4, 16.9, 'cream')
    m.box(-6.4, 6.4, 2.6, 3.1, 0, 17.4, 'red', bottom=True)
    m.box(-6.9, -6.4, -0.3, 3.1, 0, 17.4, 'red', bottom=True)
    m.screen((-5.6, -0.36), (5.6, -0.36), 0.9, 16.5, frame=0)
    m.pop()
    # open book canopy over the door
    for sx in (-1, 1):
        p = [(0, -13, z0 + 5.0), (sx * 5.2, -13, z0 + 6.4), (sx * 5.2, -7, z0 + 6.4), (0, -7, z0 + 5.0)]
        m.poly(p if sx > 0 else p[::-1], 'white')
        m.poly(p[::-1] if sx > 0 else p, 'cream')
        m.cyl(sx * 4.8, -12.6, z0, z0 + 6.3, 0.18, 5, 'wood_dark', cap=False)
    for xx, yy in ((-27, -17), (-18, -18), (27, 16)):
        m.tree(xx, yy, 0.85, z=z0)


@lm('ipad', ao=7, seed=7)
def hq_ipad(m):
    """Kids' colouring studio: giant crayons, a rainbow door arch and a giant tablet as the screen."""
    z0 = lot(m, 58, 44)
    st = rect(34, 20, -2, 8)
    z = m.facade(st, z0, 2, 4.2, 'punch', 'white', ground='shop', gh=5, bay=3.4)
    cols = ['red', 'orange', 'yellow', 'green', 'cobalt', 'purple']
    for i in range(6):
        x0 = -19 + i * 34 / 6
        m.box(x0, x0 + 34 / 6, -2.2, -2.0, z, z + 1.6, cols[i], bottom=False)
    m.box(-19, 15, -2, 18, z, z + 1.0, 'white', False)
    m.cap(st, z + 0.4, 'roof_light')
    for i, (cx, cy, s, c) in enumerate(((-12, 10, 4.5, 'yellow'), (-6, 13, 3.4, 'pink'), (4, 11, 5.2, 'teal'))):
        m.cbox(cx, cy, s, s, z + 0.4, z + 0.4 + s, c)
    # crayons
    for i, (x, y, h, c) in enumerate(((-25, -4, 17, 'red'), (-25.5, -11, 13, 'yellow'), (-21, -16, 19, 'cobalt'), (-15, -18, 11.5, 'green'), (-9.5, -17, 15, 'orange'))):
        m.cyl(x, y, z0, z0 + h, 1.7, 8, c, cap=False)
        m.cyl(x, y, z0 + h * 0.25, z0 + h * 0.62, 1.78, 8, shade(c, 0.72), cap=False)
        m.cyl(x, y, z0 + h, z0 + h + 0.5, 1.7, 8, c, r2=1.25, cap=False)
        m.cyl(x, y, z0 + h + 0.5, z0 + h + 3.4, 1.25, 8, c, r2=0.25)
    # rainbow arch over the door
    for k, c in enumerate(('red', 'yellow', 'cobalt')):
        r1, r0 = 6.2 - k * 1.1, 5.2 - k * 1.1
        n = 10
        for i in range(n):
            a0, a1 = math.pi * i / n, math.pi * (i + 1) / n
            front(m, [(r0 * math.cos(a0), z0 + r0 * math.sin(a0)), (r1 * math.cos(a0), z0 + r1 * math.sin(a0)),
                      (r1 * math.cos(a1), z0 + r1 * math.sin(a1)), (r0 * math.cos(a1), z0 + r0 * math.sin(a1))], -2.5 - k * 0.02, c)
            if k == 0:
                m.poly([(r1 * math.cos(a0), -2.5, z0 + r1 * math.sin(a0)), (r1 * math.cos(a0), -2.0, z0 + r1 * math.sin(a0)),
                        (r1 * math.cos(a1), -2.0, z0 + r1 * math.sin(a1)), (r1 * math.cos(a1), -2.5, z0 + r1 * math.sin(a1))], c)
    # giant tablet on an easel
    m.push(x=17, y=-13, z=z0 + 1.0, rz=math.radians(-14), rx=math.radians(-14))
    m.box(-8.6, 8.6, -0.5, 0.4, 0, 12.4, 'charcoal', bottom=True)
    m.screen((-7.8, -0.56), (7.8, -0.56), 0.9, 11.5, frame=0)
    m.pop()
    m.box(9, 25, -15.5, -9, z0, z0 + 1.0, 'wood', 'wood')
    m.beam((17.8, -9.5, z0 + 1), (16.4, -11.2, z0 + 9), 0.6, 0.6, 'wood_dark')
    for xx, yy in ((26, 14), (24, 4), (-27, 16)):
        m.tree(xx, yy, 0.85, z=z0)


# ================================================================== FILM & MEDIA
@lm('yae', ao=9, seed=8)
def hq_yae(m):
    """Natural-history picture house: marquee, film reel, a rib-cage entrance and two sabre tusks."""
    z0 = lot(m, 66, 52)
    hall = rect(42, 28, 0, 9)
    z = m.facade(hall, z0, 1, 14, 'none', 'brick_dark')
    m.parapet(hall, z, 1.2, 'brick_dark')
    for x in (-21.2, -10.6, 0, 10.6, 21.2):
        m.box(x - 0.9, x + 0.9, -5.5, -5.0, z0, z + 1.2, 'stone', bottom=False)
    zl = m.facade(rect(30, 8, 0, -9), z0, 1, 6.2, 'shop', 'stone_light', bay=3.75)
    m.cap(rect(30, 8, 0, -9), zl, 'roof')
    # marquee
    m.box(-12, 12, -19, -13, zl - 0.4, zl + 0.5, 'white', 'roof_light', bottom=True)
    m.poly([(-12, -19, zl - 0.42), (-12, -13, zl - 0.42), (12, -13, zl - 0.42), (12, -19, zl - 0.42)], 'lit')
    m.box(-12.3, 12.3, -19.4, -19, zl - 0.6, zl + 2.6, 'cobalt', bottom=True)
    m.text('YOU ARE EXTINCT', 1.75, 0, -19.5, zl + 0.3, 'white', depth=0.25)
    m.box(-16.9, -15.1, -14.2, -13, z0 + 4, z + 6, 'cobalt', 'cobalt', bottom=True)
    for k in range(7):
        m.box(-16.6, -15.4, -14.3, -14.2, z0 + 5.4 + k * 2.2, z0 + 6.8 + k * 2.2, 'lit', bottom=True)
    # roof screen
    m.screen((-13, -4.6), (13, -4.6), z + 3.0, z + 14.5, frame=0.9, depth=0.8)
    for x in (-11, 11):
        m.beam((x, -4.2, z), (x, -4.2, z + 2.2), 0.7, 0.7, 'steel')
        m.beam((x, -3.9, z + 12), (x, 4, z), 0.5, 0.5, 'steel')
    # film reel
    cx, cz = 16.5, z + 7.2
    m.hcyl((cx, 9, cz), (cx, 7.4, cz), 6.2, 16, 'metal_light')
    m.hcyl((cx, 10.6, cz), (cx, 9, cz), 2.0, 10, 'steel')
    m.hcyl((cx, 12.2, cz), (cx, 10.6, cz), 6.2, 16, 'metal_light')
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        disc(m, cx + 3.7 * math.cos(a), cz + 3.7 * math.sin(a), 1.35, 8, 7.33, 'charcoal')
    disc(m, cx, cz, 0.9, 8, 7.33, 'charcoal')
    m.box(cx - 3, cx + 3, 7.6, 12, z, z + 1.2, 'steel')
    # rib-cage walk to the door
    for k in range(5):
        y = -22.5 - k * 2.6
        s = 1.0 - k * 0.07
        n = 8
        pts = [(5.6 * s * math.cos(math.pi * i / n), y, z0 + 7.4 * s * math.sin(math.pi * i / n)) for i in range(n + 1)]
        for i in range(n):
            if i in (3, 4) and k % 2:
                continue
            m.beam(pts[i], pts[i + 1], 0.55, 0.5, 'cream')
    m.beam((0, -21.5, z0 + 7.5), (0, -34, z0 + 5.4), 0.9, 0.8, 'cream')
    # sabre tusks either side of the lobby
    for sx in (-1, 1):
        prev, r = None, 1.25
        for i in range(7):
            a = math.radians(-20 + i * 19)
            p = (sx * (19.5 + 5.5 * math.cos(a)), -17, z0 + 0.4 + 6.5 * math.sin(a) + 3.5)
            if prev:
                m.hcyl(prev, p, r, 6, 'cream', cap=(i == 1))
                r *= 0.78
            prev = p
        m.cbox(sx * 25, -17, 3.2, 3.2, z0, z0 + 1.4, 'stone')


@lm('noir', ao=7, seed=9)
def hq_noir(m):
    """Jazz club on a corner: navy brick, a big arched window (the screen), a neon blade sign and a moon."""
    z0 = lot(m, 42, 40)
    b = rect(27, 22, 0, 3)
    z = m.facade(b, z0, 4, 3.8, 'brick', 'navy', ground='shop', gh=5.2, bay=3.4)
    m.parapet(b, z, 1.3, 'navy')
    m.roof_kit(-12, 12, -6, 12, z, n=1, tank=True)
    m.box(-13.7, 13.7, -8.3, -8, z - 0.4, z + 0.5, 'gold', bottom=True)
    # the window
    m.screen((-6.5, -8.3), (6.5, -8.3), z0 + 6.4, z0 + 14.0, frame=0.55, frame_col='gold', depth=0.4)
    n = 8
    arc = [(7.05 * math.cos(math.pi * i / n), z0 + 14.55 + 2.4 * math.sin(math.pi * i / n)) for i in range(n + 1)]
    front(m, arc, -8.32, 'gold')
    front(m, [(x * 0.84, z0 + 14.55 + (zz - z0 - 14.55) * 0.78) for x, zz in arc], -8.4, 'lit')
    m.awning(-5.5, 5.5, -8, z0 + 4.9, 2.4, 'charcoal', drop=0.7)
    # blade sign
    m.box(11.2, 13.4, -10.3, -9.7, z0 + 6, z0 + 18.5, 'black', bottom=True)
    m.beam((12.3, -9.7, z0 + 16), (12.3, -8, z0 + 16), 0.2, 0.2, 'steel')
    m.beam((12.3, -9.7, z0 + 8), (12.3, -8, z0 + 8), 0.2, 0.2, 'steel')
    for i, ch in enumerate('NOIR'):
        m.text(ch, 2.3, 12.3, -10.36, z0 + 15.4 - i * 2.9, 'pink', depth=0.18)
    # fire escape
    for f in range(1, 4):
        zf = z0 + 5.2 + f * 3.8 - 3.8 + 3.6
        m.box(-12.5, -8, -9.6, -8, zf, zf + 0.14, 'steel', bottom=True)
        m.beam((-12.5, -9.6, zf + 1.0), (-8, -9.6, zf + 1.0), 0.08, 0.08, 'steel')
        if f < 3:
            m.beam((-12 if f % 2 else -8.5, -9.1, zf), (-8.5 if f % 2 else -12, -9.1, zf + 3.8), 0.7, 0.1, 'steel')
    # crescent moon on the roof
    m.beam((6, 2, z), (6, 2, z + 4), 0.4, 0.4, 'steel')
    m.hcyl((6, 2.3, z + 7), (6, 1.7, z + 7), 3.2, 14, 'lit')
    m.hcyl((7.5, 1.9, z + 7.7), (7.5, 1.55, z + 7.7), 2.7, 14, 'navy')
    # street lamp and planters
    m.cyl(-16, -14, z0, z0 + 6.5, 0.12, 5, 'steel', cap=False)
    m.sphere(-16, -14, z0 + 6.9, 0.6, 6, 4, 'lit')
    m.tree(16.5, -14, 0.8, z=z0)
    m.tree(16.5, 12, 0.8, z=z0)


@lm('influencers', ao=8, seed=10)
def hq_influencers(m):
    """Creator studio: white box, giant ring light, softbox, camera on a tripod and a phone-shaped screen."""
    z0 = lot(m, 52, 42)
    b = rect(30, 22, -4, 6)
    z = m.facade(b, z0, 3, 4.2, 'ribbon', 'white', ground='shop', gh=5.2, bay=3.75)
    m.parapet(b, z, 1.0, 'white')
    m.box(-19.3, -19, -5.2, 17.2, z0, z + 1, 'pink', bottom=True)
    m.box(4.6, 11.2, -5.4, -5, z0, z + 1.0, 'cobalt', bottom=True)
    # ring light on the roof
    m.torus(-6, 4, z + 9.5, 6.0, 0.75, 16, 5, 'lit', axis='y')
    for dx in (-3.2, 3.2):
        m.beam((-6 + dx, 4.4, z), (-6, 4.4, z + 3.6), 0.35, 0.35, 'steel')
    m.beam((-6, 6.5, z), (-6, 4.4, z + 3.6), 0.35, 0.35, 'steel')
    m.beam((-6, 4.4, z + 3.4), (-6, 4.4, z + 4.2), 0.4, 0.4, 'steel')
    # softbox
    m.cyl(7, 12, z, z + 5.5, 0.14, 5, 'steel', cap=False)
    m.push(x=7, y=12, z=z + 6.6, rz=math.radians(25), rx=math.radians(-18))
    m.box(-2.2, 2.2, -0.5, 1.2, -1.6, 1.6, 'black', bottom=True)
    m.poly([(-2.0, -0.52, -1.4), (2.0, -0.52, -1.4), (2.0, -0.52, 1.4), (-2.0, -0.52, 1.4)], 'white')
    m.pop()
    # phone-shaped screen on the plaza
    m.box(8.5, 17.5, -15.6, -14.6, z0 + 1.0, z0 + 17.4, 'black', bottom=True)
    m.box(7.5, 18.5, -16.6, -13.6, z0, z0 + 1.0, 'stone_light')
    m.screen((9.2, -15.66), (16.8, -15.66), z0 + 1.9, z0 + 16.6, frame=0)
    # camera on a tripod
    cx, cy = -14, -13
    for a in (0.5, 2.6, 4.7):
        m.beam((cx + 2.2 * math.cos(a), cy + 2.2 * math.sin(a), z0), (cx, cy, z0 + 4.6), 0.22, 0.22, 'steel')
    m.box(cx - 1.4, cx + 1.4, cy - 1.0, cy + 2.2, z0 + 4.6, z0 + 6.6, 'charcoal', bottom=True)
    m.hcyl((cx, cy - 1.0, z0 + 5.6), (cx, cy - 2.6, z0 + 5.6), 0.85, 8, 'black')
    m.hcyl((cx, cy - 2.6, z0 + 5.6), (cx, cy - 2.75, z0 + 5.6), 0.7, 8, 'glass_blue')
    m.sphere(cx + 1.0, cy - 0.6, z0 + 6.9, 0.35, 6, 3, 'red')
    for xx, yy in ((21, 14), (-22, 16)):
        m.tree(xx, yy, 0.85, z=z0)


# ================================================================== GAMES
@lm('stickers', ao=7, seed=11)
def hq_stickers(m):
    """Arcade and toy store: giant stickers on the facade, toy blocks and a joystick on the roof."""
    z0 = lot(m, 52, 40)
    b = rect(32, 20, 0, 6)
    zg = m.facade(b, z0, 1, 5.4, 'shop', 'yellow', bay=4.0)
    z = zg + 9.6
    m.box(-16, 16, -4, 16, zg, z, 'purple', False)
    m.parapet(b, z, 1.0, 'purple')
    m.box(-16.4, 16.4, -4.5, -4, zg - 0.3, zg + 0.5, 'white', bottom=True)
    m.screen((-6.5, -4.3), (6.5, -4.3), zg + 1.6, zg + 8.4, frame=0.5, frame_col='white', depth=0.3)
    sticker(m, star(-11.4, zg + 5.6, 3.3), -4.1, 'yellow', -11.4, zg + 5.6)
    sticker(m, heart(11.4, zg + 5.2, 3.0), -4.1, 'pink', 11.4, zg + 5.2)
    # round smiley and a bolt on the side wall strip above the roofline
    m.hcyl((-5, 6.3, z + 6.2), (-5, 5.7, z + 6.2), 4.8, 16, 'white')
    m.hcyl((-5, 5.72, z + 6.2), (-5, 5.5, z + 6.2), 4.2, 16, 'taxi')
    for dx in (-1.5, 1.5):
        disc(m, -5 + dx, z + 7.4, 0.55, 6, 5.46, 'black')
    for i in range(5):
        a0, a1 = math.pi * (1.15 + 0.14 * i), math.pi * (1.15 + 0.14 * (i + 1))
        m.beam((-5 + 2.5 * math.cos(a0), 5.44, z + 6.4 + 2.5 * math.sin(a0)), (-5 + 2.5 * math.cos(a1), 5.44, z + 6.4 + 2.5 * math.sin(a1)), 0.3, 0.42, 'black')
    m.beam((-5, 6, z), (-5, 6, z + 1.6), 1.2, 0.5, 'steel')
    # toy blocks
    for (cx, cy, s, c, zz) in ((9, 9, 5.0, 'red', 0), (9.6, 9.4, 4.0, 'cobalt', 5.0), (3.2, 12, 3.6, 'green', 0)):
        m.cbox(cx, cy, s, s, z + zz, z + zz + s, c)
        for dx in (-1, 1):
            for dy in (-1, 1):
                m.cyl(cx + dx * s * 0.24, cy + dy * s * 0.24, z + zz + s, z + zz + s + 0.5, s * 0.14, 6, c)
    # joystick on the plaza
    m.cbox(-19, -12, 6.5, 6.5, z0, z0 + 1.8, 'charcoal')
    m.cyl(-19, -12, z0 + 1.8, z0 + 2.3, 1.6, 8, 'black')
    m.hcyl((-19, -12, z0 + 2.3), (-20.4, -12.6, z0 + 7.6), 0.45, 6, 'metal_light')
    m.sphere(-20.6, -12.7, z0 + 8.6, 1.7, 8, 5, 'red')
    for i, c in enumerate(('yellow', 'cobalt')):
        m.cyl(-16.8 + i * 0.0, -13.6 + i * 3.0, z0 + 1.8, z0 + 2.2, 0.6, 6, c)
    for xx, yy in ((21, -13), (21, 14)):
        m.tree(xx, yy, 0.85, z=z0)


@lm('party', ao=6, seed=12)
def hq_party(m):
    """Party house: purple gabled house, disco ball, balloons, bunting, party cups and three giant cards."""
    z0 = lot(m, 46, 40, 'grass')
    m.poly([(-6, -20, z0 + 0.02), (6, -20, z0 + 0.02), (6, -3, z0 + 0.02), (-6, -3, z0 + 0.02)], 'paving')
    b = rect(22, 14, 0, 5)
    z = m.facade(b, z0, 2, 3.5, 'brick', 'purple', bay=3.6)
    m.gable(-11, 11, -2, 12, z, 5.0, 'navy', axis='x', over=0.8, end='purple')
    m.box(-2.2, -0.2, -2.1, -2, z0, z0 + 2.7, 'yellow', bottom=True)
    m.box(-4.5, 2.5, -4.6, -2, z0, z0 + 0.4, 'stone_light', 'wood')
    m.cbox(7, 8, 1.1, 1.1, z + 2, z + 6.6, 'brick_dark')
    m.screen((2.4, -2.12), (9.6, -2.12), z0 + 0.8, z0 + 5.0, frame=0.3, frame_col='white', depth=0.2)
    # disco ball
    m.cyl(-4, 5, z + 5.0, z + 8.0, 0.1, 4, 'steel', cap=False)
    m.sphere(-4, 5, z + 9.4, 1.6, 8, 6, 'metal_light')
    # balloons
    for i, (x, y, h, c) in enumerate(((-15, -8, 11, 'red'), (-13.4, -9.4, 13.5, 'yellow'), (-16.4, -10.2, 12.4, 'cobalt'), (14, -6, 12, 'pink'), (15.6, -7.6, 14, 'teal'), (13, -8.6, 10.6, 'orange'))):
        gx, gy = (-15, -9) if i < 3 else (14.4, -7.4)
        m.beam((gx, gy, z0), (x, y, z0 + h - 1.3), 0.06, 0.06, 'white')
        m.sphere(x, y, z0 + h, 1.25, 7, 5, c, sz=1.2)
    for gx, gy in ((-15, -9), (14.4, -7.4)):
        m.cbox(gx, gy, 1.2, 1.2, z0, z0 + 0.8, 'wood_dark')
    # bunting between two poles
    for x in (-19, 19):
        m.cyl(x, -15, z0, z0 + 7.5, 0.12, 5, 'white')
    n = 12
    cols = ['red', 'yellow', 'cobalt', 'green', 'pink', 'orange']
    for i in range(n):
        xa, xb = -19 + 38 * i / n, -19 + 38 * (i + 1) / n
        sag = lambda x: z0 + 7.3 - 1.7 * (1 - (x / 19) ** 2)
        for o in (1, -1):
            p = [(xa, -15, sag(xa)), ((xa + xb) / 2, -15, sag((xa + xb) / 2) - 1.5), (xb, -15, sag(xb))]
            m.poly(p if o > 0 else p[::-1], cols[i % 6])
    # party cups pyramid
    for (cx, cz) in ((8, 0), (10.2, 0), (12.4, 0), (9.1, 2.4), (11.3, 2.4), (10.2, 4.8)):
        m.cyl(cx, -14, z0 + cz, z0 + cz + 2.3, 0.75, 8, 'red', r2=1.05, cap=False, bottom=True)
        m.cyl(cx, -14, z0 + cz + 2.3, z0 + cz + 2.42, 1.08, 8, 'white')
    # three giant cards
    for i, (rz, c) in enumerate(((0.35, 'red'), (0.0, 'black'), (-0.35, 'red'))):
        m.push(x=-8 + i * 2.2, y=-15 - abs(i - 1) * 0.6, z=z0, rz=rz, rx=math.radians(-12))
        m.box(-1.9, 1.9, -0.12, 0.12, 0, 5.6, 'white', bottom=True)
        front(m, heart(0, 2.9, 0.95, 12) if c == 'red' else star(0, 2.8, 1.05, 4, 0.5), -0.14, c)
        m.pop()


# ================================================================== HEALTH
@lm('duiyao', ao=8, seed=13)
def hq_duiyao(m):
    """Clinic and pharmacy: white block with a green band, a green cross and a giant capsule on the roof."""
    z0 = lot(m, 52, 40)
    b = rect(32, 20, 0, 5)
    z = m.facade(b, z0, 4, 3.7, 'ribbon', 'white', ground='shop', gh=5.2, bay=4.0)
    m.parapet(b, z, 1.1, 'white')
    m.box(-16.3, 16.3, -5.3, 15.3, z0 + 5.0, z0 + 5.9, 'green', bottom=True)
    m.awning(-6, 6, -5.3, z0 + 5.0, 2.6, 'green', drop=0.8)
    m.screen((-14, -5.25), (-2, -5.25), z0 + 7.4, z0 + 15.0, frame=0.5, frame_col='white', depth=0.3)
    # green cross sign on a pylon
    m.box(9.2, 10.8, -6.6, -5, z0, z + 9, 'white', bottom=True)
    for (w, h) in ((6.4, 2.2), (2.2, 6.4)):
        m.box(10 - w / 2, 10 + w / 2, -7.3, -6.6, z + 4.2 - h / 2, z + 4.2 + h / 2, 'green', bottom=True)
    # giant capsule on the roof
    cz = z + 4.2
    m.cbox(-8, 6, 0.8, 4, z, z + 1.6, 'steel')
    m.cbox(-1, 6, 0.8, 4, z, z + 1.6, 'steel')
    m.hcyl((-9.5, 6, cz), (-4.5, 6, cz), 2.7, 12, 'red', cap=False)
    m.hcyl((-4.5, 6, cz), (0.5, 6, cz), 2.7, 12, 'white', cap=False)
    m.push(x=-9.5, y=6, z=cz, ry=math.radians(-90))
    m.dome(0, 0, 0, 2.7, 12, 4, 'red')
    m.pop()
    m.push(x=0.5, y=6, z=cz, ry=math.radians(90))
    m.dome(0, 0, 0, 2.7, 12, 4, 'white')
    m.pop()
    m.roof_kit(2, 15, 6, 14, z, n=2)
    # ambulance bay canopy and a pill-blister bench
    m.box(-15, -7, -11, -5.3, z0 + 4.2, z0 + 4.7, 'white', bottom=True)
    for x in (-14.4, -7.6):
        m.cyl(x, -10.6, z0, z0 + 4.2, 0.18, 5, 'white', cap=False)
    for i in range(4):
        m.sphere(15 + (i % 2) * 2.6, -12 - (i // 2) * 2.6, z0 + 0.3, 1.0, 8, 3, ('white', 'teal')[i % 2], sz=0.6)
    m.box(13.2, 19.4, -16.4, -10.2, z0, z0 + 0.3, 'metal_light')
    for xx, yy in ((-21, -13), (-21, 12), (21, 12)):
        m.tree(xx, yy, 0.85, z=z0)


@lm('hackathons', ao=9, seed=14)
def hq_hackathons(m):
    """Hackathon hall: sawtooth shed, flags, a countdown board and a giant laptop whose display is the screen."""
    z0 = lot(m, 72, 52)
    hall = rect(50, 28, 0, 9)
    z = m.facade(hall, z0, 1, 11, 'corrugated', 'charcoal', bay=5)
    for i in range(5):
        x0 = -25 + i * 10
        m.wedge(x0, x0 + 10, -5, 23, z, 4.6, 0.2, 'roof_grey', 'roof_grey')
        m.box(x0, x0 + 0.12, -4.4, 22.4, z + 0.5, z + 4.2, 'glass_sky', bottom=True)
    zl = m.facade(rect(34, 6, 0, -8), z0, 1, 7.2, 'curtain', 'glass_green', bay=4.25)
    m.cap(rect(34, 6, 0, -8), zl, 'roof_light')
    m.text('</>', 5.2, -16, -5.15, z0 + 12.0 - 4.2, 'green', depth=0.3)
    m.box(8, 23, -5.4, -5, z0 + 8.2, z0 + 10.6, 'black', bottom=True)
    m.text('48:00:00', 1.7, 15.5, -5.45, z0 + 8.7, 'green', depth=0.15)
    # giant laptop
    m.push(x=-18, y=-18, z=z0, rz=math.radians(18))
    m.box(-7.5, 7.5, -5, 5, 0, 0.7, 'metal_light', 'metal')
    for r in range(3):
        m.poly([(-6.2, -3.6 + r * 2.0, 0.72), (6.2, -3.6 + r * 2.0, 0.72), (6.2, -2.2 + r * 2.0, 0.72), (-6.2, -2.2 + r * 2.0, 0.72)], 'charcoal')
    m.push(y=5, z=0.7, rx=math.radians(-16))
    m.box(-7.5, 7.5, -0.35, 0.3, 0, 10, 'metal_light', bottom=True)
    m.screen((-6.9, -0.41), (6.9, -0.41), 0.6, 9.4, frame=0)
    m.pop()
    m.pop()
    for i, c in enumerate(('green', 'cobalt', 'red', 'yellow', 'purple')):
        flag(m, 8 + i * 5.2, -21, 12, c, z0)
    # trophy
    m.cbox(30, -16, 3, 3, z0, z0 + 1.6, 'charcoal')
    m.cyl(30, -16, z0 + 1.6, z0 + 3.2, 0.4, 6, 'gold', cap=False)
    m.cyl(30, -16, z0 + 3.2, z0 + 6.2, 0.7, 8, 'gold', r2=2.0, cap=False)
    m.cap(ngon(2.0, 8, 30, -16), z0 + 5.9, shade('gold', 0.6))
    for xx, yy in ((-32, 12), (32, 12)):
        m.tree(xx, yy, 0.85, z=z0)


# ================================================================== SMALL STORE
@lm('pindou', ao=6, seed=15)
def hq_pindou(m):
    """Bead craft store: a pegboard facade with a bead-pixel heart, giant fuse beads on the roof."""
    z0 = lot(m, 42, 36)
    b = rect(24, 15, 0, 4)
    zg = m.facade(b, z0, 1, 4.8, 'shop', 'cream', bay=4.0)
    z = zg + 8.6
    m.box(-12, 12, -3.5, 11.5, zg, z, 'white', False)
    m.parapet(b, z, 0.8, 'white')
    m.awning(-11, 11, -3.5, z0 + 4.7, 2.2, 'pink', drop=0.7)
    # bead pixel art, 11 x 9
    art = ["..RR...RR..", ".RPPR.RPPR.", "RPPPPRPPPPR", "RPPPPPPPPPR", "RPPPPPPPPPR", ".RPPPPPPPR.", "..RPPPPPR..", "...RPPPR...", "....RPR...."]
    cm = {'R': 'red', 'P': 'pink'}
    s = 0.86
    for r, row in enumerate(art):
        for c, ch in enumerate(row):
            x0, zc = -11 + 0.5 + c * s, z - 0.6 - (r + 1) * s
            col = cm.get(ch) or (('yellow', 'teal', 'cobalt', 'green', 'orange', 'purple')[(r * 3 + c * 5) % 6] if (r + c) % 4 == 0 else None)
            if col:
                front(m, [(x0 + 0.08, zc + 0.08), (x0 + s - 0.08, zc + 0.08), (x0 + s - 0.08, zc + s - 0.08), (x0 + 0.08, zc + s - 0.08)], -3.58, col)
    m.screen((1.0, -3.6), (10.6, -3.6), zg + 1.5, zg + 7.2, frame=0.35, frame_col='pink', depth=0.2)
    # giant beads on the roof
    for (cx, cy, c, zz) in ((-6.5, 4, 'teal', 0), (-1.6, 7, 'yellow', 0), (-4.2, 5.6, 'red', 2.5), (4.6, 4.5, 'purple', 0)):
        m.cyl(cx, cy, z + zz, z + zz + 2.5, 2.3, 10, c, cap=False)
        m.cap_ring(ngon(2.3, 10, cx, cy), ngon(1.0, 10, cx, cy), z + zz + 2.5, c)
        m.cap(ngon(1.0, 10, cx, cy), z + zz + 2.2, shade(c, 0.45))
    # bead jars at the door
    for i, c in enumerate(('cobalt', 'orange', 'green')):
        m.cyl(-15 - (i % 2) * 2.4, -9 - i * 2.6, z0, z0 + 2.6, 1.1, 8, 'glass_sky', cap=False)
        m.cyl(-15 - (i % 2) * 2.4, -9 - i * 2.6, z0 + 2.6, z0 + 3.0, 1.2, 8, c)
    m.tree(16, -11, 0.8, z=z0)
    m.tree(16, 10, 0.8, z=z0)


# ================================================================== RÉSUMÉ / NEWS / CONTACT
@lm('resume', ao=10, seed=16)
def hq_resume(m):
    """University hall with a clock tower, a columned entrance, lawn and a notice board (the screen)."""
    z0 = lot(m, 84, 60, 'grass')
    m.poly([(-4, -30, z0 + 0.02), (4, -30, z0 + 0.02), (4, -4, z0 + 0.02), (-4, -4, z0 + 0.02)], 'paving')
    hall = rect(58, 18, 0, 8)
    z = m.facade(hall, z0, 3, 4.0, 'brick', 'brick', bay=3.6)
    m.gable(-29, 29, -1, 17, z, 6, 'roof_grey', axis='x', over=0.7, end='brick')
    for x in (-29.2, 29.2):
        m.box(x - 0.6, x + 0.6, -1.6, 17.6, z0, z + 7.5, 'stone_light', bottom=False)
    # portico
    m.box(-9, 9, -6.5, -1, z0, z0 + 1.2, 'stone_light', 'paving')
    for x in (-7.5, -2.5, 2.5, 7.5):
        m.cyl(x, -5.5, z0 + 1.2, z0 + 10.2, 0.6, 8, 'stone_light', cap=False)
    m.box(-9.2, 9.2, -6.7, -1, z0 + 10.2, z0 + 11.4, 'stone_light', bottom=True)
    m.gable(-9.2, 9.2, -6.7, -1, z0 + 11.4, 3.2, 'roof_grey', axis='y', over=0.0, end='stone_light')
    m.box(-1.6, 1.6, -1.1, -1, z0 + 1.2, z0 + 5.0, 'wood_dark', bottom=True)
    # clock tower
    tx, ty = 20, 20
    zt = m.facade(rect(9, 9, tx, ty), z0, 9, 4.0, 'brick', 'brick', bay=4.5)
    m.box(tx - 5, tx + 5, ty - 5, ty + 5, zt, zt + 1.0, 'stone_light', bottom=True)
    zc = zt + 1.0
    m.box(tx - 4.5, tx + 4.5, ty - 4.5, ty + 4.5, zc, zc + 8.0, 'stone_light', False)
    for dx, dy, r in ((0, -1, 0), (1, 0, 1), (0, 1, 2), (-1, 0, 3)):
        a = (tx + dx * 4.5, ty + dy * 4.5, zc + 4.0)
        bb = (tx + dx * 4.75, ty + dy * 4.75, zc + 4.0)
        m.hcyl(a, bb, 3.2, 12, 'white')
        c2 = (tx + dx * 4.8, ty + dy * 4.8)
        px, py = -dy, dx
        m.beam((c2[0], c2[1], zc + 4.0), (c2[0] + px * 0.2, c2[1] + py * 0.2, zc + 6.6), 0.3, 0.3, 'black')
        m.beam((c2[0], c2[1], zc + 4.0), (c2[0] + px * 1.8, c2[1] + py * 1.8, zc + 4.9), 0.3, 0.3, 'black')
    zb = zc + 8.0
    m.box(tx - 5, tx + 5, ty - 5, ty + 5, zb, zb + 0.8, 'stone_light', bottom=True)
    for dx in (-1, 1):
        for dy in (-1, 1):
            m.cbox(tx + dx * 3.7, ty + dy * 3.7, 1.4, 1.4, zb + 0.8, zb + 6.0, 'brick', top=False)
    m.box(tx - 4.6, tx + 4.6, ty - 4.6, ty + 4.6, zb + 6.0, zb + 6.9, 'stone_light', bottom=True)
    m.cyl(tx, ty, zb + 1.2, zb + 4.4, 1.5, 8, 'gold', r2=2.0, bottom=True)
    m.hip(tx - 4.6, tx + 4.6, ty - 4.6, ty + 4.6, zb + 6.9, 11, 'copper', over=0.4)
    m.cyl(tx, ty, zb + 17.4, zb + 21, 0.2, 4, 'gold')
    # notice board + flag + trees
    for x in (-27, -15):
        m.cbox(x, -20, 0.4, 0.4, z0, z0 + 7.6, 'wood_dark')
    m.screen((-26.4, -20.3), (-15.6, -20.3), z0 + 2.0, z0 + 7.2, frame=0.4, frame_col='wood_dark', depth=0.3)
    flag(m, 12, -22, 14, 'gold', z0)
    for xx, yy in ((-36, -22), (-36, -8), (34, -22), (26, -24), (36, -6), (-34, 22), (-10, 24)):
        m.tree(xx, yy, 1.0, z=z0)


@lm('news', ao=9, seed=17)
def hq_news(m):
    """Daily AI newsroom: glass block with a wrap-around ticker, a corner screen and a broadcast mast."""
    z0 = lot(m, 58, 46)
    b = rect(38, 26, 0, 4)
    z = m.facade(b, z0, 9, 4.0, 'curtain', grad('glass_dark', 'glass_blue'), ground='shop', gh=6)
    m.parapet(b, z, 1.4, 'metal')
    m.roof_kit(-17, 4, -6, 14, z, n=3)
    # ticker ring
    t = rect(39.6, 27.6, 0, 4)
    m.prism(t, z0 + 10.2, z0 + 12.8, 'black', bottom=True)
    for i in range(4):
        a, bb = t[i], t[(i + 1) % 4]
        dx, dy = bb[0] - a[0], bb[1] - a[1]
        ln = math.hypot(dx, dy)
        nx, ny = dy / ln * 0.06, -dx / ln * 0.06
        for k in range(int(ln // 4)):
            f0, f1 = (k * 4 + 0.6) / ln, (k * 4 + 3.2) / ln
            p0 = (a[0] + dx * f0 + nx, a[1] + dy * f0 + ny)
            p1 = (a[0] + dx * f1 + nx, a[1] + dy * f1 + ny)
            m.wall(p0, p1, z0 + 11.0, z0 + 12.0, 'lit' if k % 3 else 'red')
    m.screen((-18, -9.3), (-2, -9.3), z0 + 16, z0 + 34, frame=0.8)
    m.text('DAILY AI', 3.4, 8, -8.6, z + 2.0, 'white', depth=0.45)
    m.beam((0, -8.4, z + 1.6), (16, -8.4, z + 1.6), 0.4, 0.4, 'steel')
    # broadcast mast
    mx, my = 11, 9
    for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        m.beam((mx + dx * 2.4, my + dy * 2.4, z), (mx + dx * 0.35, my + dy * 0.35, z + 26), 0.3, 0.3, 'white')
    for k in range(1, 5):
        s = 2.4 - k * 0.41
        m.prism(rect(2 * s + 0.3, 2 * s + 0.3, mx, my), z + k * 5.2, z + k * 5.2 + 0.3, 'red' if k % 2 else 'white', bottom=True)
    m.cyl(mx, my, z + 26, z + 36, 0.2, 4, 'red')
    for (dx, zz, rz) in ((2.8, 9, 0.5), (-2.6, 14, 2.6)):
        m.push(x=mx + dx, y=my, z=z + zz, rz=rz, rx=math.radians(-70))
        m.cyl(0, 0, 0, 0.9, 0.3, 8, 'white', r2=1.8, cap=False)
        m.cyl(0, 0, 0.9, 0.9, 1.8, 8, 'metal_light', r2=0.0, cap=False)
        m.pop()
    # news van + trees
    m.box(-26, -20, -19, -16.4, z0 + 0.5, z0 + 3.0, 'white', bottom=True)
    m.box(-25.6, -24, -19.1, -16.3, z0, z0 + 0.9, 'rubber')
    m.box(-22, -20.4, -19.1, -16.3, z0, z0 + 0.9, 'rubber')
    m.cyl(-22.5, -17.7, z0 + 3.0, z0 + 3.7, 0.3, 6, 'white', r2=1.2)
    for xx, yy in ((24, -18), (24, 16), (-25, 16)):
        m.tree(xx, yy, 0.9, z=z0)


@lm('nonstop', ao=10, seed=18)
def hq_nonstop(m):
    """Observatory on a small hill. The dome, slit and telescope are a separate node (hq_nonstop_dome)
    centred on the origin so code can turn it. A sign board carries the screen."""
    hill = 6.0
    m.frustum(ngon(30, 14), ngon(18, 14), 0, hill, 'grass', top='paving', col1='grass')
    # path steps up the front
    for k in range(6):
        y0 = -30 + k * 2.1
        m.box(-3, 3, y0, y0 + 2.2, 0, (k + 1) * hill / 6, 'stone', 'paving')
    m.cyl(0, 0, hill, hill + 9.5, 11.5, 14, 'white', cap=False, col1='stone_light')
    m.cap_ring(ngon(12.1, 14), ngon(10.9, 14), hill + 9.5, 'metal')
    m.cyl(0, 0, hill + 8.9, hill + 9.5, 12.1, 14, 'metal', cap=False)
    m.box(-1.8, 1.8, -11.9, -11.2, hill, hill + 3.6, 'wood_dark', bottom=True)
    for a in (0.9, 2.2, 3.9, 5.4):
        x, y = 11.45 * math.cos(a), 11.45 * math.sin(a)
        m.hcyl((x, y, hill + 5.6), (x * 1.02, y * 1.02, hill + 5.6), 1.1, 8, 'glass_dark')
    # annex and a small radio dish
    m.box(11, 19, -4, 5, hill - 0.2, hill + 4.6, 'white', 'roof_light')
    m.cyl(15, 0.5, hill + 4.6, hill + 6.2, 0.18, 5, 'steel', cap=False)
    m.push(x=15, y=0.5, z=hill + 6.4, rx=math.radians(-50), rz=0.5)
    m.cyl(0, 0, 0, 0.9, 0.3, 8, 'white', r2=2.0, cap=False)
    m.cyl(0, 0, 0.9, 0.9, 2.0, 8, 'metal_light', r2=0, cap=False)
    m.pop()
    # sign board
    for x in (-15.6, -7.4):
        m.cbox(x, -19.5, 0.4, 0.4, 0, 8.6, 'steel')
    m.screen((-15, -19.8), (-8, -19.8), 4.4, 8.2, frame=0.4, depth=0.3)
    for xx, yy in ((20, -16), (-22, 8), (22, 14), (-12, 24), (8, 26)):
        m.tree(xx, yy, 0.9, 'tall', z=1.0)
    # turning part: dome + slit + telescope
    m.part('dome')
    zd = hill + 9.5
    m.dome(0, 0, zd, 10.9, 14, 5, 'metal_light')
    n = 6
    for i in range(n):
        a0, a1 = math.radians(8 + i * 80 / n), math.radians(8 + (i + 1) * 80 / n)
        r = 11.02
        p = lambda a, x: (x, -r * math.cos(a), zd + r * math.sin(a))
        m.poly([p(a0, -1.5), p(a0, 1.5), p(a1, 1.5), p(a1, -1.5)], 'black')
    d = (0, -math.cos(math.radians(52)), math.sin(math.radians(52)))
    o = (0, 0, zd + 1.5)
    tip = lambda k: (o[0] + d[0] * k, o[1] + d[1] * k, o[2] + d[2] * k)
    m.hcyl(tip(4), tip(15), 1.25, 10, 'white')
    m.hcyl(tip(15), tip(16.4), 1.5, 10, 'cobalt')
    m.hcyl(tip(16.4), tip(16.5), 1.15, 10, 'glass_dark')
    m.part('')


# ================================================================== STATIONS
def _platform_furniture(m, sy, zp, L):
    y_out = sy * 12.0
    for i in range(int(L // 8)):
        x = -L / 2 + 4 + i * 8
        m.wall((x - 3.6, y_out), (x + 3.6, y_out), zp, zp + 2.4, 'glass_sky')
        m.wall((x + 3.6, y_out), (x - 3.6, y_out), zp, zp + 2.4, 'glass_sky')
    m.poly([(-L / 2, sy * 7.5 - 0.25, zp + 0.02), (L / 2, sy * 7.5 - 0.25, zp + 0.02), (L / 2, sy * 7.5 + 0.25, zp + 0.02), (-L / 2, sy * 7.5 + 0.25, zp + 0.02)], 'yellow')
    for x in (-24, 0, 24):
        m.box(x - 1.4, x + 1.4, sy * 10.6 - 0.3, sy * 10.6 + 0.3, zp, zp + 0.5, 'wood')


def _canopy(m, sy, zp, L, h=4.6):
    """Butterfly canopy over one platform (in the tintable canopy part) on steel columns."""
    m.part('')
    for i in range(int(L // 12) + 1):
        x = -L / 2 + 4 + i * 12 * (L - 8) / (12 * int(L // 12))
        m.cyl(x, sy * 10.0, zp, zp + h, 0.22, 6, 'steel', cap=False)
        m.beam((x, sy * 6.8, zp + h + 0.5), (x, sy * 12.6, zp + h - 0.1), 0.25, 0.3, 'steel')
    m.part('canopy')
    a, b = sy * 6.4, sy * 12.8
    za, zb = zp + h + 0.9, zp + h + 0.15
    top = [(-L / 2 - 1, a, za), (L / 2 + 1, a, za), (L / 2 + 1, b, zb), (-L / 2 - 1, b, zb)]
    m.poly(top if sy > 0 else top[::-1], 'white')
    bot = [(x, y, z - 0.3) for x, y, z in top]
    m.poly(bot[::-1] if sy > 0 else bot, 'white')
    for p, q in ((0, 1), (1, 2), (2, 3), (3, 0)):
        quad = [bot[p], bot[q], top[q], top[p]]
        m.poly(quad if sy > 0 else quad[::-1], 'white')
    m.part('')


@lm(None, ao=8, seed=19)
def station_elevated(m):
    """Elevated station. Track runs along X; rails at 9.0 m, platforms at 10.1 m either side of a
    14 m clear trackway (the viaduct deck itself is drawn by the line code). Stairs to the street."""
    L, zr, zp = 92.0, 9.0, 10.1
    m.meta.update({'rail': zr, 'platform': zp, 'length': L, 'trackClear': 7.0})
    for sy in (-1, 1):
        m.box(-L / 2, L / 2, min(sy * 7.0, sy * 12.2), max(sy * 7.0, sy * 12.2), zr - 1.2, zp, 'concrete', 'paving', bottom=True)
        for x in (-36, -12, 12, 36):
            m.cbox(x, sy * 9.6, 1.8, 1.8, 0, zr - 2.6, 'concrete', top=False)
            m.box(x - 1.3, x + 1.3, min(sy * 6.6, sy * 12.4), max(sy * 6.6, sy * 12.4), zr - 2.6, zr - 1.2, 'concrete', bottom=True)
        _platform_furniture(m, sy, zp, L)
        _canopy(m, sy, zp, L)
        # stairs down to the street at both ends
        for sx in (-1, 1):
            x0, x1 = sx * 30, sx * 49
            yy = sy * 14.6
            m.beam((x0, yy, zp - 0.25), (x1, yy, 0.4), 3.4, 0.5, 'concrete')
            for o in (-1.7, 1.7):
                m.beam((x0, yy + o, zp + 0.9), (x1, yy + o, 1.5), 0.12, 1.5, 'glass_sky')
            m.box(min(x0, x0 - sx * 5), max(x0, x0 - sx * 5), min(sy * 12.2, sy * 16.4), max(sy * 12.2, sy * 16.4), zp - 0.5, zp, 'concrete', 'paving', bottom=True)
            m.cbox(x0 - sx * 2.5, sy * 15.6, 0.7, 0.7, 0, zp - 0.5, 'concrete', top=False)
        # lift tower
        m.facade(rect(3.4, 3.4, 0, sy * 14.4), 0, 1, zp + 3.2, 'none', 'glass_sky')
        m.cap(rect(3.6, 3.6, 0, sy * 14.4), zp + 3.2, 'metal')
    # concourse bridge under the tracks linking both sides
    m.box(-7, 7, -12.2, 12.2, zr - 6.2, zr - 2.7, 'glass_teal', 'concrete', bottom=True)
    # street entrances with name boards (screens) and roundels
    for sy, suf in ((-1, 'screen'), (1, 'screen2')):
        yy = sy * 19.5
        m.box(-9, 9, min(yy - 0.3, yy + 0.3), max(yy - 0.3, yy + 0.3), 4.4, 5.0, 'steel', bottom=True)
        for x in (-8.6, 8.6):
            m.cbox(x, yy, 0.4, 0.4, 0, 4.4, 'steel', top=False)
        if sy < 0:
            m.screen((-7, yy - 0.34), (7, yy - 0.34), 5.3, 7.5, suffix=suf, frame=0.25, depth=0.3)
        else:
            m.screen((7, yy + 0.34), (-7, yy + 0.34), 5.3, 7.5, suffix=suf, frame=0.25, depth=0.3)
        m.part('canopy')
        m.box(-10, 10, min(sy * 16.6, sy * 21), max(sy * 16.6, sy * 21), 8.2, 8.6, 'white', bottom=True)
        m.hcyl((11.4, yy + 0.2, 6.2), (11.4, yy - 0.2, 6.2), 1.5, 12, 'white')
        m.part('')
        m.cyl(11.4, yy, 0, 4.8, 0.14, 5, 'steel', cap=False)
        m.beam((-10, sy * 16.8, 5.0), (-10, sy * 16.8, 8.2), 0.3, 0.3, 'steel')
        m.beam((10, sy * 16.8, 5.0), (10, sy * 16.8, 8.2), 0.3, 0.3, 'steel')


@lm(None, ao=6, seed=20)
def station_grade(m):
    """Street-level station. Track runs along X; rails at 0.3 m, platforms at 1.1 m, a station
    building on the front and a glazed footbridge across the tracks."""
    L, zr, zp = 92.0, 0.3, 1.1
    m.meta.update({'rail': zr, 'platform': zp, 'length': L, 'trackClear': 7.0})
    for sy in (-1, 1):
        m.box(-L / 2, L / 2, min(sy * 7.0, sy * 12.2), max(sy * 7.0, sy * 12.2), 0, zp, 'concrete', 'paving')
        m.wedge(-L / 2 - 6, -L / 2, min(sy * 7.0, sy * 12.2), max(sy * 7.0, sy * 12.2), 0, 0.05, zp, 'concrete', 'paving')
        m.wedge(L / 2, L / 2 + 6, min(sy * 7.0, sy * 12.2), max(sy * 7.0, sy * 12.2), 0, zp, 0.05, 'concrete', 'paving')
        _platform_furniture(m, sy, zp, L)
        _canopy(m, sy, zp, L, h=4.4)
        # footbridge stair towers
        m.facade(rect(5, 5, 30, sy * 14.8), 0, 1, 11.2, 'none', 'stone_light')
        m.cap(rect(5.4, 5.4, 30, sy * 14.8), 11.2, 'metal')
        m.beam((27.5, sy * 14.8, 7.0), (12, sy * 14.8, zp), 2.6, 0.5, 'concrete')
    m.facade(rect(4.2, 24.6, 30, 0), 7.0, 1, 3.4, 'ribbon', 'white', bay=4.1)
    m.cap(rect(4.6, 25, 30, 0), 10.4, 'metal')
    m.cap(rect(4.2, 24.6, 30, 0), 7.0, 'concrete', up=False)
    # station building on the front
    sb = rect(30, 9, -12, -17.6)
    z = m.facade(sb, 0, 1, 5.6, 'shop', 'brick_tan', bay=3.75)
    m.parapet(sb, z, 0.8, 'brick_tan')
    m.box(-17, -7, -22.4, -22.1, z - 0.2, z + 3.4, 'stone_light', bottom=True)
    m.hcyl((-12, -22.4, z + 1.7), (-12, -22.65, z + 1.7), 1.3, 12, 'white')
    m.beam((-12, -22.7, z + 1.7), (-12, -22.7, z + 2.7), 0.14, 0.14, 'black')
    m.beam((-12, -22.7, z + 1.7), (-11.3, -22.7, z + 1.9), 0.14, 0.14, 'black')
    m.screen((-26, -22.2), (-18.4, -22.2), 3.6, 5.2, frame=0.2, depth=0.2)
    m.part('canopy')
    m.box(-28, 4, -25.4, -22.1, z - 0.9, z - 0.5, 'white', bottom=True)
    m.hcyl((7.4, -24.2, 6.2), (7.4, -24.6, 6.2), 1.5, 12, 'white')
    m.part('')
    m.cyl(7.4, -24.4, 0, 4.8, 0.14, 5, 'steel', cap=False)
    for x in (-27, -19, -5, 3):
        m.cyl(x, -25, 0, z - 0.9, 0.16, 5, 'steel', cap=False)
    for x in (-40, -34, 14, 20):
        m.tree(x, -19, 0.8)


# ================================================================== EMPTY PLOT
@lm(None, ao=7, seed=21)
def plot_empty(m):
    """Construction lot for the next project: hoarding (with a screen), foundations, site cabin,
    digger and a tower crane. The crane's jib is a separate node (plot_empty_jib) on the origin."""
    m.box(-25, 25, -25, 25, 0, 0.2, 'dirt', 'dirt')
    # hoarding with a gate gap on the front
    H = 2.6
    for a, b in (((-25, -25), (-9, -25)), ((9, -25), (25, -25)), ((25, -25), (25, 25)), ((25, 25), (-25, 25)), ((-25, 25), (-25, -25))):
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy)
        nx, ny = dy / ln * 0.12, -dx / ln * 0.12
        m.prism([(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)], 0.2, 0.2 + H, 'white')
        m.wall((a[0] + nx * 1.1, a[1] + ny * 1.1), (b[0] + nx * 1.1, b[1] + ny * 1.1), 0.2 + H - 0.7, 0.2 + H - 0.3, 'cobalt')
    m.screen((-23, -25.2), (-11, -25.2), 3.4, 8.0, frame=0.35, depth=0.3)
    for x in (-22, -12):
        m.cbox(x, -25, 0.35, 0.35, 0.2, 3.4, 'steel', top=False)
    # foundations and first columns
    m.box(-14, 14, -8, 14, 0.2, 0.9, 'concrete', 'concrete')
    for i, x in enumerate((-12, -6, 6, 12)):
        for j, y in enumerate((-6, 2, 10)):
            h = (4.2, 2.2, 3.4, 1.6)[(i + j) % 4]
            m.cbox(x, y, 0.9, 0.9, 0.9, 0.9 + h, 'concrete')
            for dx, dy in ((-0.25, -0.25), (0.25, 0.25)):
                m.cyl(x + dx, y + dy, 0.9 + h, 0.9 + h + 1.1, 0.05, 3, 'brick', cap=False)
    m.box(-14, -3, 5, 14, 5.1, 5.5, 'concrete', bottom=True)
    # site cabin, dirt, pallets
    m.facade(rect(9, 3.2, -17, -18), 0.2, 1, 2.9, 'ribbon', 'white', bay=3.0)
    m.cap(rect(9.3, 3.5, -17, -18), 3.1, 'roof_light')
    m.cyl(16, -14, 0.2, 3.4, 5.0, 7, 'dirt', r2=0.4, col1=shade('dirt', 1.1))
    m.cyl(19, -7, 0.2, 2.2, 3.4, 6, 'dirt', r2=0.3)
    for k in range(3):
        m.cbox(18, 16 + k * 0.0, 3, 2.2, 0.2 + k * 0.7, 0.8 + k * 0.7, 'brick' if k else 'wood')
    # digger
    m.push(x=6, y=-17, z=0.2, rz=0.5)
    for sy in (-1.3, 1.3):
        m.box(-2.4, 2.4, sy - 0.45, sy + 0.45, 0, 0.9, 'rubber')
    m.box(-2.0, 2.0, -1.5, 1.5, 0.9, 2.5, 'yellow', bottom=True)
    m.box(-0.2, 1.8, -1.4, 0.2, 2.5, 3.9, 'glass_dark', 'yellow')
    m.beam((1.6, 0.9, 2.2), (4.6, 0.9, 5.2), 0.5, 0.6, 'yellow')
    m.beam((4.6, 0.9, 5.2), (6.6, 0.9, 2.2), 0.4, 0.5, 'yellow')
    m.box(6.2, 7.2, 0.4, 1.4, 1.2, 2.2, 'steel', bottom=True)
    m.pop()
    # crane mast (fixed) on the origin
    m.box(-2.6, 2.6, -2.6, 2.6, 0.2, 1.4, 'concrete')
    for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        m.cbox(dx * 0.95, dy * 0.95, 0.26, 0.26, 1.4, 50, 'yellow', top=False)
    for k in range(12):
        za, zb = 1.4 + k * 4.05, 1.4 + (k + 1) * 4.05
        for (a, b) in (((-0.95, -0.95), (0.95, -0.95)), ((0.95, -0.95), (0.95, 0.95)), ((0.95, 0.95), (-0.95, 0.95)), ((-0.95, 0.95), (-0.95, -0.95))):
            p, q = (a, b) if k % 2 else (b, a)
            m.beam((*p, za), (*q, zb), 0.14, 0.14, 'yellow')
    m.part('jib')
    zj = 50.0
    m.cyl(0, 0, zj, zj + 1.6, 1.7, 8, 'steel')
    m.box(0.9, 3.1, -1.1, 1.1, zj + 0.2, zj + 2.6, 'white', 'yellow', bottom=True)
    m.beam((0, 14, zj + 2.2), (0, -44, zj + 2.2), 1.3, 1.3, 'yellow')
    for k in range(11):
        ya, yb = 14 - k * 5.27, 14 - (k + 1) * 5.27
        m.beam((0, ya, zj + 2.85), (0, (ya + yb) / 2, zj + 4.2), 0.14, 0.14, 'yellow')
        m.beam((0, (ya + yb) / 2, zj + 4.2), (0, yb, zj + 2.85), 0.14, 0.14, 'yellow')
    m.beam((0, 14, zj + 4.2), (0, -44, zj + 4.2), 0.22, 0.22, 'yellow')
    for dx in (-0.6, 0.6):
        m.beam((dx, 0, zj + 1.6), (0, 0, zj + 11), 0.3, 0.3, 'yellow')
    m.beam((0, 0, zj + 11), (0, -30, zj + 4.3), 0.12, 0.12, 'steel')
    m.beam((0, 0, zj + 11), (0, 12, zj + 4.3), 0.12, 0.12, 'steel')
    m.box(-1.3, 1.3, 9.5, 13.5, zj - 0.6, zj + 1.5, 'concrete_dark', bottom=True)
    m.box(-0.8, 0.8, -27, -25, zj + 0.9, zj + 1.5, 'steel', bottom=True)
    m.cyl(0, -26, zj - 22, zj + 0.9, 0.06, 3, 'steel', cap=False)
    m.box(-0.5, 0.5, -26.5, -25.5, zj - 23.2, zj - 22, 'yellow', bottom=True)
    m.part('')
