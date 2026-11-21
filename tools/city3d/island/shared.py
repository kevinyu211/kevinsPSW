"""Shared level models (the empty lot and the two building sites), Kevin's tower, and the two metro stations.

Front = -Y in Blender (+Z in glTF). Stations: the two lanes run along X either side of the origin. There is no
track: the trains float in, 10 m above the ground, and dock between the platforms, so that space stays open.
"""
import math
from mathutils import Vector
from ilib import IModel, rrect, rect, ngon, shade, tint, mixc, C, disc2, star2, rrect2, cross2, xsec
from parts2 import *
from detail import *

MODELS = []
DECK = 10.0          # top of the track deck above the ground
PLAT = 11.1          # top of the platforms
EDGE = 2.3           # distance from the track centre to the platform edge


def model(name, cls, **kw):
    def deco(fn):
        def make():
            m = IModel(name, cls, **kw)
            fn(m)
            return m
        MODELS.append((name, make))
        return fn
    return deco


# ================================================================== level 1: the lot
def marker(m, x, y, h=1.5, col='lamp'):
    """A slim plot marker: a white post with a cap of light."""
    m.cyl(x, y, 0, h, 0.13, 6, 'pearl', r2=0.1, cap=False)
    with m.use('glow'):
        m.lathe(x, y, [(0.16, h), (0.16, h + 0.22), (0.0, h + 0.34)], 6, col, cap=False, bottom=True)


@model('lot', 'level', seed=5, smooth=62.0)
def lot(m):
    """Level 1: a tidy plot waiting for its building: a lawn inside a paved edge, a line of light on the ground
    where the building will stand, four markers, and a sign."""
    W, Dp = 34.0, 26.0
    ph = m.pad(W, Dp, h=0.3, col='pave_light', r=2.0, edge='kerb')
    m.meta.update(level=1, door=[0, round(Dp / 2, 2)])
    m.push(0, 0, ph)
    m.cap(rrect(W - 4.4, Dp - 4.4, 1.6, 3), 0.03, 'grass_g')
    m.box(-1.5, 1.5, -Dp / 2 + 0.3, -Dp / 2 + 2.3, 0.0, 0.05, 'pave_light')          # the way in from the street
    # the building to come, drawn on the grass as a line of light
    fx, fy, fw, fd = 0.5, 1.2, 17.0, 11.5
    outer, inner = rrect(fw, fd, 3.2, 4, fx, fy), rrect(fw - 0.5, fd - 0.5, 2.95, 4, fx, fy)
    with m.use('glow'):
        m.cap_ring(outer, inner, 0.07, 'lamp')
    for sx in (-1, 1):
        for sy in (-1, 1):
            marker(m, fx + sx * (fw / 2 + 0.6), fy + sy * (fd / 2 + 0.6))
    # the sign: a smooth white board on a slim foot, with a red top edge
    with m.at(-10.6, -Dp / 2 + 4.2, 0, 0.2):
        m.cbox(0, 0.1, 0.5, 0.3, 0, 1.3, 'pearl_shade', top=False)
        m.plate(rrect2(0, 3.0, 6.4, 3.4, 0.7, 3), 0.28, 0.36, 'pearl', edge='pearl_shade', back=True)
        with m.use('glow'):
            m.fq(-2.5, 2.5, 4.28, 4.42, -0.1, 'line')
        m.text('COMING', 0.82, 0, 3.15, 'iron', y=-0.1, bold=0.02)
        m.text('SOON', 0.82, 0, 2.15, 'iron', y=-0.1, bold=0.02)
    # a young tree, a bench and a few shrubs: the plot is looked after
    m.cyl(11.5, 7.6, 0, 2.3, 0.12, 5, 'bark', cap=False)
    m.blob(11.5, 7.6, 3.2, 1.5, 'leaf_light', n=7, rings=4)
    m.bench(11.3, -8.6, math.pi, 2.4, col='pearl_shade')
    for gx, gy, gr in ((-12.6, 8.2, 0.9), (-11.2, 9.0, 0.6), (12.8, -5.6, 0.7), (8.8, 8.9, 0.6)):
        m.bush(gx, gy, gr, col='leaf')
    m.pop()


# ================================================================== level 2: the building sites
def taper_beam(m, a, b, wa, ha, wb, hb, col, col_top=None):
    """A box beam along x from a to b = (x, y, z of its centre line) whose section changes from wa x ha to wb x hb."""
    (xa, ya, za), (xb, yb, zb) = a, b
    if xa > xb:
        (xa, ya, za, wa, ha), (xb, yb, zb, wb, hb) = (xb, yb, zb, wb, hb), (xa, ya, za, wa, ha)
    ra = [(xa, ya - wa / 2, za - ha / 2), (xa, ya + wa / 2, za - ha / 2), (xa, ya + wa / 2, za + ha / 2), (xa, ya - wa / 2, za + ha / 2)]
    rb = [(xb, yb - wb / 2, zb - hb / 2), (xb, yb + wb / 2, zb - hb / 2), (xb, yb + wb / 2, zb + hb / 2), (xb, yb - wb / 2, zb + hb / 2)]
    ct = col_top if col_top is not None else col
    m.loft([ra, rb], [[shade(col, 0.9), shade(col, 0.9), ct, ct]] * 2)


def rod(m, a, b, r=0.05, col='steel_light'):
    m.tube([a, b], r, 3, col, caps=False)


def arc_wall(m, cx, cy, rx, ry, a0, a1, z0, z1, col, col1=None, mat='city', inner=None, step=math.radians(14)):
    """Part of an oval drum wall between two angles. inner = colour of its inside face (None = none)."""
    n = max(1, round(abs(a1 - a0) / step))
    c1 = col1 if col1 is not None else col
    for i in range(n):
        aa, ab = a0 + (a1 - a0) * i / n, a0 + (a1 - a0) * (i + 1) / n
        pa, pb = (cx + rx * math.cos(aa), cy + ry * math.sin(aa)), (cx + rx * math.cos(ab), cy + ry * math.sin(ab))
        with m.use(mat):
            m.poly([(*pa, z0), (*pb, z0), (*pb, z1), (*pa, z1)], [col, col, c1, c1])
        if inner is not None:
            qa, qb = (cx + (rx - 0.12) * math.cos(aa), cy + (ry - 0.12) * math.sin(aa)), (cx + (rx - 0.12) * math.cos(ab), cy + (ry - 0.12) * math.sin(ab))
            m.poly([(*qb, z0), (*qa, z0), (*qa, z1), (*qb, z1)], inner)


def sleek_crane(m, cx, cy, H, jib, cjib):
    """A slim white tower crane: one smooth mast, a tapering jib with an orange edge, a glass cab.
    Everything above the mast goes to the child node <name>_jib, which turns about the mast."""
    m.lathe(cx, cy, [(2.1, 0), (2.1, 0.45), (1.1, 0.9)], 10, ['pearl_shade', 'pearl_shade', 'pearl'], cap=True)
    m.cyl(cx, cy, 0.9, H, 0.66, 8, 'pearl', r2=0.46, cap=False)
    for t in (0.34, 0.67):
        zz = 0.9 + (H - 0.9) * t
        rr = 0.66 - 0.2 * t + 0.035
        m.cyl(cx, cy, zz, zz + 0.3, rr, 8, 't_orange', cap=False)
    m.cyl(cx, cy, H, H + 0.9, 0.95, 10, 'pearl_shade')
    m.part('jib', pivot=(cx, cy, H + 0.9))
    with m.at(cx, cy, H + 0.9):
        m.rbox(0, 0, 2.6, 2.1, 0, 1.5, 'pearl', r=0.7, seg=2, bev=0.35, bottom=True)
        # the cab: a small glass pod hung beside the turret
        m.rbox(1.7, -1.55, 2.2, 1.5, -0.95, 1.1, 'pearl', r=0.5, seg=2, bev=0.25, bottom=True)
        with m.use('glass'):
            m.poly([(2.82, -2.1, -0.45), (2.82, -1.0, -0.45), (2.82, -1.0, 0.75), (2.82, -2.1, 0.75)], 'glass_b')
            m.poly([(0.95, -2.32, -0.45), (2.45, -2.32, -0.45), (2.45, -2.32, 0.75), (0.95, -2.32, 0.75)], 'glass_b')
        # the jib (towards +x), the short counter-jib with its weight, the king post and two stays
        taper_beam(m, (0.9, 0, 1.75), (jib, 0, 1.95), 0.85, 0.75, 0.34, 0.3, 'pearl', 'pearl_hi')
        for sy in (-1, 1):
            q = [(1.6, sy * 0.44, 1.5), (jib - 0.3, sy * 0.18, 1.9), (jib - 0.3, sy * 0.18, 2.02), (1.6, sy * 0.44, 1.66)]
            m.poly(q if sy < 0 else q[::-1], 't_orange')
        taper_beam(m, (-cjib + 1.5, 0, 1.85), (-0.9, 0, 1.75), 0.6, 0.5, 0.85, 0.75, 'pearl', 'pearl_hi')
        m.rbox(-cjib + 1.6, 0, 3.4, 1.9, 0.7, 2.5, 'pearl_shade', r=0.7, seg=2, bev=0.4, bottom=True)
        m.tube([(0, 0, 1.5), (-0.2, 0, 4.2), (-0.5, 0, 6.6)], [0.32, 0.24, 0.12], 6, 'pearl', caps=False)
        rod(m, (-0.5, 0, 6.5), (jib * 0.62, 0, 2.1), 0.06, 'pale_metal')
        rod(m, (-0.5, 0, 6.5), (-cjib + 1.8, 0, 2.4), 0.06, 'pale_metal')
        with m.use('glow'):
            m.ball(-0.5, 0, 6.85, 0.28, 't_red', n=5, rings=3)
            m.ball(jib - 0.1, 0, 2.3, 0.2, 't_red', n=4, rings=2)
        # the trolley, the line and a shell panel on its way up
        tx, drop = jib * 0.64, H * 0.5
        m.cbox(tx, 0, 1.3, 0.9, 1.2, 1.55, 'pearl_shade', bottom=True)
        rod(m, (tx, 0, 1.2), (tx, 0, 1.2 - drop), 0.04, 'pale_metal')
        with m.use('glow'):
            m.cbox(tx, 0, 0.5, 0.5, 1.2 - drop - 0.5, 1.2 - drop, 't_orange', bottom=True)
        for sx in (-0.6, 0.6):
            rod(m, (tx, 0, 1.2 - drop - 0.5), (tx + sx, 0, 1.2 - drop - 1.68), 0.03, 'pale_metal')
        pz = 1.2 - drop - 1.7
        pan = [(tx - 1.7, 0.0, pz - 0.35), (tx - 0.6, 0.0, pz), (tx + 0.6, 0.0, pz), (tx + 1.7, 0.0, pz - 0.35)]
        for (pa, pb) in zip(pan[:-1], pan[1:]):
            m.sheet([(pa[0], -1.0, pa[2]), (pb[0], -1.0, pb[2]), (pb[0], 1.0, pb[2]), (pa[0], 1.0, pa[2])], 'pearl_hi', 'pearl_shade')
    m.part('')


def build_site(m, W, Dp, fw, fd, floors, crane_h, jib):
    """A clean building site: an oval shell going up floor by floor. The back and one side already have their skin of
    white panels and glass; the front is still open, behind slim scaffolding; the roof is a ring of ribs. A slim white
    crane (child node <name>_jib) stands beside it."""
    ph = m.pad(W, Dp, h=0.3, col='pave', r=2.0, edge='pave_dark')
    m.meta.update(level=2, door=[0, round(Dp / 2, 2)])
    m.push(0, 0, ph)
    hw, hd = W / 2 - 0.9, Dp / 2 - 0.9
    # a low white hoarding, with a gap for the gate between two posts with lights
    pts = [(3.2, -hd), (hw, -hd), (hw, hd), (-hw, hd), (-hw, -hd), (-3.2, -hd)]
    idx = 0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        Ln = math.hypot(b[0] - a[0], b[1] - a[1])
        k = max(1, round(Ln / 6.0))
        for j in range(k):
            p = (a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k)
            q = (a[0] + (b[0] - a[0]) * (j + 1) / k, a[1] + (b[1] - a[1]) * (j + 1) / k)
            c = 'pearl' if idx % 2 == 0 else 'pearl_hi'
            m.sheet([(*p, 0.0), (*q, 0.0), (*q, 1.7), (*p, 1.7)], [shade(c, 0.9), shade(c, 0.9), c, c])
            m.cyl(p[0], p[1], 0, 1.85, 0.07, 5, 'pale_metal', cap=False)          # a post at every panel joint
            m.cyl(p[0], p[1], 0, 0.15, 0.2, 5, 'plinth', cap=False)
            idx += 1
    for sx in (-3.2, 3.2):
        marker(m, sx, -hd, 2.3, 't_orange')
    fcx, fcy, fh = -W * 0.07, 1.8, 3.7
    rx, ry = fw / 2, fd / 2
    n = 20 if fw < 20 else 28
    z0 = 0.35
    zt = z0 + floors * fh
    m.lathe(fcx, fcy, [(rx + 1.0, 0.0), (rx + 1.0, z0)], n, 'pearl_shade', cap=True, sy=(ry + 1.0) / (rx + 1.0))
    # floors
    for f in range(1, floors + 1):
        z = z0 + f * fh
        m.lathe(fcx, fcy, [(rx - 0.25, z - 0.32), (rx + 0.12, z - 0.16), (rx - 0.05, z)], n, ['pearl_shade', 'pearl', 'pearl'], cap=True, bottom=True, sy=ry / rx)
    # slim columns round the edge
    ncol = 8 if fw < 20 else 12
    for k in range(ncol):
        a = 2 * math.pi * (k + 0.5) / ncol
        m.cyl(fcx + (rx - 0.7) * math.cos(a), fcy + (ry - 0.7) * math.sin(a), z0, zt - 0.3, 0.2, 5, 'pearl', cap=False)
    # the skin: white panels with a band of glass, further on at the back and lower down
    a_start = math.radians(55)
    for f in range(floors):
        z = z0 + f * fh
        span = math.radians(245 - (245 - 70) * (f / max(1, floors - 1)) if floors > 1 else 245)
        a0, a1 = a_start, a_start + span
        arc_wall(m, fcx, fcy, rx, ry, a0, a1, z, z + 0.95, 'pearl', inner=None)
        arc_wall(m, fcx, fcy, rx, ry, a0, a1, z + 0.95, z + fh - 0.75, 'glass_b', 'glass_c', mat='glass')
        arc_wall(m, fcx, fcy, rx, ry, a0, a1, z + fh - 0.75, z + fh - 0.3, 'pearl')
        arc_wall(m, fcx, fcy, rx - 0.02, ry - 0.02, a0, a1, z, z + fh - 0.3, 'pearl_shade', inner='pearl_shade', mat='city') if False else None
        for i in range(max(1, round(span / math.radians(14)))):
            aa, ab = a0 + span * i / max(1, round(span / math.radians(14))), a0 + span * (i + 1) / max(1, round(span / math.radians(14)))
            qa = (fcx + (rx - 0.1) * math.cos(aa), fcy + (ry - 0.1) * math.sin(aa))
            qb = (fcx + (rx - 0.1) * math.cos(ab), fcy + (ry - 0.1) * math.sin(ab))
            m.poly([(*qb, z), (*qa, z), (*qa, z + fh - 0.3), (*qb, z + fh - 0.3)], 'pearl_shade')
    # the roof to come: ribs rising to a ring, and the first two panels of the dome
    nr = 8 if fw < 20 else 10
    rise = min(rx, ry) * 0.62
    def rib_pt(a, t):
        k = math.cos(t * math.pi / 2 * 0.86)
        return (fcx + rx * k * math.cos(a), fcy + ry * k * math.sin(a), zt + rise * math.sin(t * math.pi / 2 * 0.86) / math.sin(math.pi / 2 * 0.86))
    for k in range(nr):
        a = 2 * math.pi * k / nr + 0.2
        m.tube([rib_pt(a, t) for t in (0.0, 0.4, 0.75, 1.0)], [0.2, 0.17, 0.14, 0.12], 4, 'pearl', caps=False)
    kt = math.cos(math.pi / 2 * 0.86)
    m.torus(fcx, fcy, zt + rise, rx * kt, 0.16, nr * 2, 4, 'pearl', axis='z') if abs(rx - ry) < 0.1 else \
        m.tube([(fcx + rx * kt * math.cos(2 * math.pi * i / (nr * 2)), fcy + ry * kt * math.sin(2 * math.pi * i / (nr * 2)), zt + rise) for i in range(nr * 2 + 1)], 0.15, 4, 'pearl', caps=False)
    for k in (nr // 2, nr // 2 + 1):
        a, b = 2 * math.pi * k / nr + 0.2, 2 * math.pi * (k + 1) / nr + 0.2
        ts = (0.0, 0.4, 0.75, 1.0)
        for ta, tb in zip(ts[:-1], ts[1:]):
            m.sheet([rib_pt(a, ta), rib_pt(b, ta), rib_pt(b, tb), rib_pt(a, tb)], 'pearl_hi', 'pearl_shade')
    # slim scaffolding round the open front: poles, a rail and a walkway at each floor
    so = 1.25
    s0, s1 = math.radians(-125), math.radians(48)
    nb = 6 if fw < 20 else 9
    poles = []
    for i in range(nb + 1):
        a = s0 + (s1 - s0) * i / nb
        poles.append((fcx + (rx + so) * math.cos(a), fcy + (ry + so) * math.sin(a), a))
        m.cyl(poles[-1][0], poles[-1][1], 0, zt + 1.2, 0.06, 4, 'steel_light', cap=False)
    for f in range(1, floors + 1):
        z = z0 + f * fh - 0.15
        for (xa, ya, aa), (xb, yb, ab) in zip(poles[:-1], poles[1:]):
            rod(m, (xa, ya, z + 1.1), (xb, yb, z + 1.1), 0.045)
            ia = (fcx + (rx + 0.25) * math.cos(aa), fcy + (ry + 0.25) * math.sin(aa))
            ib = (fcx + (rx + 0.25) * math.cos(ab), fcy + (ry + 0.25) * math.sin(ab))
            m.sheet([(*ia, z), (xa, ya, z), (xb, yb, z), (*ib, z)], 'pearl', 'pearl_shade')
    # a veil of pale netting over the top bays
    if floors > 1:
        for (xa, ya, aa), (xb, yb, ab) in list(zip(poles[:-1], poles[1:]))[1:4]:
            with m.use('glass'):
                m.sheet([(xa, ya, zt - fh), (xb, yb, zt - fh), (xb, yb, zt + 1.0), (xa, ya, zt + 1.0)], ['hover_soft', 'hover_soft', 'pearl_hi', 'pearl_hi'])
    # the crane
    x1, y1 = fcx + fw / 2, fcy + fd / 2
    sleek_crane(m, x1 + 1.3 + 3.4, y1 - 1.5, crane_h, jib, jib * 0.4)
    # site life: a pod office, shell panels waiting in a stack, warning lights, two people
    ox, oy = -hw + 4.8, -hd + 3.4
    capsule(m, ox, oy, 1.25, L=6.6, r=1.45, col_a='pearl', col_b='pearl', n=10)
    m.box(ox - 2.0, ox + 2.0, oy - 1.0, oy + 1.0, 0, 0.4, 'pearl_shade', top=False)
    with m.use('glow'):
        m.poly([(x_, oy - 1.47, z_) for x_, z_ in rrect2(ox + 0.6, 1.5, 2.6, 0.9, 0.4, 2)], 'pane')
    m.poly([(x_, oy - 1.47, z_) for x_, z_ in rrect2(ox - 1.7, 1.2, 0.9, 1.9, 0.3, 2)], 't_orange')
    px, py = hw - 4.5, -hd + 5.0
    for k in range(4):
        m.rbox(px + 0.12 * k, py, 3.6, 2.0, 0.15 + k * 0.28, 0.33 + k * 0.28, 'pearl_hi' if k % 2 == 0 else 'pearl', r=0.5, seg=1, bottom=True)
    m.box(px - 1.4, px + 1.4, py - 0.8, py + 0.8, 0, 0.15, 'pearl_shade', top=False)
    for bx, by in ((hw - 3.0, -hd + 9.5), (-hw + 10.5, -hd + 2.4), (4.5, -hd + 2.2)):
        with m.use('glow'):
            m.lathe(bx, by, [(0.32, 0.0), (0.1, 0.9), (0.0, 0.95)], 5, 't_orange', cap=False)
    m.person(-2.0, -hd + 3.5, 0, 't_orange', 1.25, 0.4)
    m.person(5.6, -hd + 5.4, 0, 'pearl_hi', 1.25, -0.8)
    m.pop()


@model('site_small', 'level', seed=11, smooth=62.0)
def site_small(m):
    """Level 2 for the smaller buildings: a two-floor oval shell going up, and a slim crane."""
    build_site(m, 34.0, 26.0, 15.0, 9.5, 2, 24.0, 19.0)


@model('site_large', 'level', seed=12, smooth=62.0)
def site_large(m):
    """Level 2 for the bigger buildings: a four-floor oval shell going up, and a taller crane."""
    build_site(m, 56.0, 42.0, 30.0, 18.0, 4, 41.0, 30.0)


# ================================================================== Kevin's tower
@model('tower', 'tower', ao=14.0, seed=3)
def tower(m):
    """Kevin's tower, 200 m: six slender ivory fins that stand wide on the plaza, join in a ring of pointed
    arches you can walk under, and sweep up and together round a glazed core to a fine needle.
    Warm glass shows between the fins; a small observation pod sits high up. The fins end at different
    heights, like petals. Child node tower_crown = everything above the pod's underside (lit at night)."""
    m.ao_cell = None
    TOP, Z0, ZC, ZS, PR = 200.0, 1.4, 178.0, 145.0, 31.0
    IV, IVS = 'ivory', 'ivory_shade'
    NS = 18

    def rc(z):                              # radius of the glazed core
        t = min(1.0, max(0.0, (z - Z0) / (ZC - Z0)))
        return min(12.5, 1.0 + 17.5 * (1 - t) ** 1.7)

    def ro(z):                              # outer line of the fins
        t = min(1.0, max(0.0, z / ZC))
        return 2.0 + 25.5 * (1 - t) ** 1.75
    ZA, ZM = 24.0, 29.0                     # top of the arches, top of the ring where the fins are joined
    ZL = Z0 + 2 * (ZC - Z0) / round((ZC - Z0) / 4.4)          # top of the double-height lobby (see-through glass)
    FINS = [(-60, 0.93), (0, 0.60), (60, 0.86), (120, 0.52), (180, 0.93), (240, 0.68)]
    ROWS = [0.3, 3, 6, 10, 14, 18, 21, ZA, 26.5, ZM, 32, 36, 41, 47, 54, 62, 71, 81, 92, 104, 116, 128, 138, ZS, 152, 159, 166]

    def fin_ring(deg, tip, z):
        zt = tip * ZC
        if z <= ZA:
            a = 29.96 - 22.0 * (1 - (z / ZA) ** 1.6)
        elif z <= ZM:
            a = 29.96                         # a hair under 30: neighbouring fins meet without sharing a face
        else:
            a = 7.5 + 22.5 * math.exp(-(z - ZM) / 20.0)
        a = max(math.radians(a), 0.5 / ro(z))
        a *= max(0.0, min(1.0, (zt - z) / 24.0)) ** 0.8
        r1 = ro(z) + (1.5 * math.exp(-((zt - z) / 10.0) ** 2) if tip < 0.9 else 0.0)
        leg = r1 - (2.6 if z < ZM else 1.6)
        r0 = leg if z < 34 else min(leg, max(rc(z) - 0.25, r1 - 3.2))
        if zt - z < 0.01:
            r0 = r1 - 0.3
        ph = math.radians(deg)
        P = lambda r, d: (r * math.cos(ph + d), r * math.sin(ph + d), z)
        ridge = 0.25 + 0.5 * min(1.0, a * r1 / 2.0)
        return [P(r1, -a), P(r1 + ridge, 0.0), P(r1, a), P(r0, a), P(r0, -a)]
    FC = [IV, tint(IV, 0.3), IV, IVS, IVS]

    def fins(lo, hi):
        for deg, tip in FINS:
            zt = tip * ZC
            zs = [z for z in ROWS if lo <= z <= hi and z < zt - 1.0]
            if hi >= zt > lo:
                zs.append(zt)
            if len(zs) < 2:
                continue
            m.loft([fin_ring(deg, tip, z) for z in zs], [FC] * len(zs), caps=(lo < 1.0, False))

    def core(lo, hi):
        n = int(round((ZC - Z0) / 4.4))
        zs = [Z0 + (ZC - Z0) * i / n for i in range(n + 1)]
        for i in range(n):
            za, zb = zs[i], zs[i + 1]
            if zb <= lo + 0.01 or za >= hi - 0.01:
                continue
            ta, tb = i / n, (i + 1) / n
            lobby = zb <= ZL + 0.1
            ca = mixc('glass_warm', 'glass_warm_hi', ta ** 0.7)
            cb = mixc('glass_warm', 'glass_warm_hi', tb ** 0.7)
            if lobby:
                with clear(m):
                    m.lathe(0, 0, [(rc(za), za), (rc(zb), zb)], 24, ['glass_c', 'glass_b'], cap=False)
            else:
                with m.use('glass'):
                    m.lathe(0, 0, [(rc(za), za), (rc(zb), zb)], NS, [ca, cb], cap=False)
            if i:                            # the floor line: the edge of each slab, an ivory band every third
                if i % 3 == 0:
                    m.lathe(0, 0, [(rc(za) + 0.14, za - 0.2), (rc(za) + 0.14, za + 0.2)], NS, IV, cap=False)
                else:
                    m.lathe(0, 0, [(rc(za) + 0.05, za - 0.16), (rc(za) + 0.05, za + 0.16)], 24 if lobby else NS, IVS, cap=False)
        if lo < 1.0:                         # mullions: straight in the lobby, following the core's curve above
            for k in range(24):
                a = 2 * math.pi * (k + 0.5) / 24
                m.beam((12.55 * math.cos(a), 12.55 * math.sin(a), Z0), (12.55 * math.cos(a), 12.55 * math.sin(a), ZL), 0.12, 0.16, IV)
        for k in range(0, NS, 2):
            a = 2 * math.pi * k / NS
            zs_ = sorted(set(z for z in [max(lo, ZL), 26, 40, 60, 80, 100, 120, 140, ZS, 160, ZC - 1] if max(lo, ZL) <= z <= min(hi, ZC - 1)))
            if len(zs_) > 1:
                m.tube([((rc(z) + 0.06) * math.cos(a), (rc(z) + 0.06) * math.sin(a), z) for z in zs_], 0.08, 3, IV, caps=False)

    # the plaza: a round terrace on the hill top, paved in rings and spokes
    m.lathe(0, 0, [(PR, -11.0), (PR, 0.3), (PR - 0.5, 0.5)], 32, ['plinth', 'kerb', 'kerb'], cap=False)
    m.cap_ring(ngon(PR - 0.5, 32), ngon(16.0, 32), 0.5, 'pave')
    round_paving(m, 0, 0, PR - 1.2, 0.5, n=32, col='pave_light', band='pave_dark', rings=(0.6, 0.97), spokes=12, r_in=16.0)
    # the podium the lobby stands on: five steps all the way round (0.18 m risers)
    prof, cols = [], []
    for k in range(5):
        r_ = 15.2 - k * 0.32
        prof += [(r_, 0.5 + k * 0.18), (r_, 0.5 + (k + 1) * 0.18)]
        cols += ['kerb', 'pave_light']
    prof.append((12.4, Z0))
    cols.append('pave_light')
    m.lathe(0, 0, prof, 32, cols, cap=False)
    # the footings: each fin lands on a stone plinth
    for deg, tip in FINS:
        ring = fin_ring(deg, tip, 0.3)
        cx_ = sum(p[0] for p in ring) / 5
        cy_ = sum(p[1] for p in ring) / 5
        out = [(cx_ + (p[0] - cx_) * 1.0 + 0.45 * (p[0] - cx_) / max(0.1, math.hypot(p[0] - cx_, p[1] - cy_)),
                cy_ + (p[1] - cy_) * 1.0 + 0.45 * (p[1] - cy_) / max(0.1, math.hypot(p[0] - cx_, p[1] - cy_))) for p in ring]
        m.frustum(out[::-1], out[::-1], 0.4, 1.05, 'plinth', top='kerb')
    fins(0.0, ZS)
    core(Z0, ZS)
    # the lobby inside the glass: stone floor, the lift core with its doors, a gallery, a curved desk
    m.cap(ngon(12.35, 24), Z0 + 0.02, 'pave_light')
    m.cyl(0, 0, Z0, ZL + 0.4, 3.6, 16, IVS, cap=False)
    with m.use('metal'):
        for k in range(4):
            a = math.pi / 4 + k * math.pi / 2
            with m.at(3.62 * math.cos(a), 3.62 * math.sin(a), Z0, a + math.pi / 2):
                m.fq(-0.6, 0.6, 0, 2.3, -0.01, 'brushed')
                m.fq(-0.02, 0.02, 0, 2.3, -0.02, 'seam')
            with m.at(3.62 * math.cos(a), 3.62 * math.sin(a), Z0 + 4.4, a + math.pi / 2):
                m.fq(-0.6, 0.6, 0, 2.3, -0.01, 'brushed')
    m.cap_ring(ngon(12.35, 24), ngon(7.5, 24), Z0 + 4.4, PS)
    m.cap_ring(ngon(7.5, 24), ngon(12.35, 24), Z0 + 4.05, IVS)
    m.lathe(0, 0, [(7.5, Z0 + 4.05), (7.5, Z0 + 4.4)], 24, IV, cap=False)
    rail_ring(m, 0, 0, Z0 + 4.4, 7.65, n=16, a0=math.radians(-60), a1=math.radians(240))
    m.cap(ngon(12.35, 24), ZL, IVS, up=False)
    with m.at(0, -6.2, Z0):
        m.lathe(0, 0, [(3.0, 0), (3.0, 1.05), (2.4, 1.1), (2.4, 0.9)], 12, [IV, IV, IV, IVS], cap=False) if False else None
    desk_o = [(6.7 * math.cos(math.radians(-125 + k * 14)), 6.7 * math.sin(math.radians(-125 + k * 14))) for k in range(6)]
    desk_i = [(6.0 * math.cos(math.radians(-125 + k * 14)), 6.0 * math.sin(math.radians(-125 + k * 14))) for k in range(6)]
    for k in range(5):                       # the reception desk: one curved counter
        m.wall(desk_o[k + 1], desk_o[k], Z0, Z0 + 1.1, IV)
        m.wall(desk_i[k], desk_i[k + 1], Z0, Z0 + 1.1, IVS)
    m.cap_ring(desk_o[::-1], desk_i[::-1], Z0 + 1.1, 'brushed') if False else None
    for k in range(5):
        m.poly([(*desk_i[k], Z0 + 1.1), (*desk_i[k + 1], Z0 + 1.1), (*desk_o[k + 1], Z0 + 1.1), (*desk_o[k], Z0 + 1.1)][::-1], 'brushed')
    for a_, b_ in ((desk_i[0], desk_o[0]), (desk_o[5], desk_i[5])):
        m.wall(a_, b_, Z0, Z0 + 1.1, IV)
    # the entrance: a glass porch in a pearl frame, three pairs of doors, a canopy edged in the red line of light
    r0 = rc(Z0)
    with m.at(0, -r0, Z0):
        m.box(-6.6, 6.6, -2.6, 0.5, 0, 0.25, 'pave_light')                               # the porch floor
        for sx in (-1, 1):
            m.rbox(sx * 6.2, -1.2, 0.8, 2.8, 0, 4.6, IV, r=0.3, seg=2, top=False)      # the frame's two piers, under its head
        m.rbox(0, -1.2, 13.2, 2.8, 4.6, 5.4, IV, r=0.3, seg=2, bottom=True)            # its head
        with clear(m):
            m.fq(-5.8, 5.8, 0.25, 4.6, -2.45, 'glass_c')
        for dx in (-3.6, 0, 3.6):
            m.box(dx - 1.32, dx + 1.32, -2.62, -2.48, 0.25, 2.65, 'brushed')            # door frames
            with clear(m):
                m.fq(dx - 1.2, dx - 0.04, 0.27, 2.55, -2.64, 'glass_c')
                m.fq(dx + 0.04, dx + 1.2, 0.27, 2.55, -2.64, 'glass_c')
            for sx in (-0.25, 0.25):
                m.box(dx + sx - 0.03, dx + sx + 0.03, -2.75, -2.64, 0.9, 1.8, 'brushed')   # pull handles
        for mx in (-5.4, -1.8, 1.8, 5.4):
            m.box(mx - 0.07, mx + 0.07, -2.6, -2.45, 0.25, 4.6, IV)                     # mullions
        m.box(-5.8, 5.8, -2.6, -2.45, 2.65, 2.8, IV)                                    # transom
        m.rbox(0, -4.6, 15.5, 5.2, 4.95, 5.25, IV, r=1.6, seg=4, bottom=True)          # the canopy
        with m.use('glow'):
            m.box(-7.0, 7.0, -7.23, -7.17, 4.98, 5.2, 'line', top=False)
            for dx in (-4.5, 0, 4.5):
                m.cap(ngon(0.35, 8, dx, -4.6), 4.93, 'lamp', up=False)
        for sx in (-1, 1):
            m.cyl(sx * 6.9, -6.4, -Z0 + 0.5, 4.95, 0.13, 8, 'pale_metal', cap=False)
            m.cyl(sx * 6.9, -6.4, -Z0 + 0.5, -Z0 + 0.7, 0.3, 8, 'plinth')
        # steps down to the plaza, with handrails at the sides
        n_ = 5
        for i in range(n_):
            m.box(-6.6, 6.6, -2.6 - (n_ - i) * 0.32, -2.58, -Z0 + 0.5 + i * (Z0 - 0.5) / n_, -Z0 + 0.5 + (i + 1) * (Z0 - 0.5) / n_ - (0.02 if i < n_ - 1 else 0.0), 'pave_light')
        for sx in (-1, 1):
            m.tube([(sx * 6.3, -2.6 - n_ * 0.32 - 0.3, -Z0 + 0.5 + 0.9), (sx * 6.3, -2.6 - n_ * 0.32, -Z0 + 0.5 + 0.9), (sx * 6.3, -2.7, 0.9), (sx * 6.3, -2.0, 0.9)], 0.04, 4, 'pale_metal')
            for yy in (-2.6 - n_ * 0.32, -2.7):
                m.beam((sx * 6.3, yy, -Z0 + 0.5 if yy < -3 else 0.0), (sx * 6.3, yy, 0.9 + (-Z0 + 0.5 if yy < -3 else 0.0)), 0.06, 0.06, 'pale_metal')
    # the front walk: a paved path from the plaza's edge to the steps, between two pools
    paving(m, -4.5, 4.5, -PR + 0.5, -r0 - 4.3, 0.53, col='pave_light', band='kerb', every=2.0, edge=None)
    for sx in (-1, 1):
        fountain_pool(m, sx * 8.2, -21.0, 2.8, 0.53, n=16)
    # plaza life: lamps round the rim, trees in planters and hedges between the legs, benches facing out
    for k in range(12):
        a = math.pi / 12 + k * math.pi / 6
        lamp_post(m, (PR - 1.6) * math.cos(a), (PR - 1.6) * math.sin(a), 4.2, z=0.5)
    for k in range(6):
        a = math.radians(-90 + k * 60)
        if k == 0:
            continue
        for s_ in (-1, 1):
            planter_tree(m, 21.0 * math.cos(a + s_ * 0.22), 21.0 * math.sin(a + s_ * 0.22), 0.8, 1.3, z=0.53, kind='tall')
        seat(m, 21.5 * math.cos(a), 21.5 * math.sin(a), a - math.pi / 2, 2.6, z=0.53)
        with m.at(18.2 * math.cos(a), 18.2 * math.sin(a), 0, a + math.pi / 2):
            hedge(m, -3.2, 3.2, 0, z=0.53, h=0.6, d=1.0)
    for sx in (-1, 1):
        planter_tree(m, sx * 12.5, -27.2, 0.7, 1.3, z=0.53)
    # the crown: the top of the core and the tallest fins, the observation pod, the needle
    m.part('crown', pivot=(0, 0, ZS))
    fins(ZS, TOP)
    core(ZS, ZC)
    pz = 151.0
    RP = 5.6                                 # the pod: a glass room round the lift core, a railed open deck above
    zb, zf, zd, zu = pz - 2.2, pz - 1.6, pz + 2.0, pz + 5.2
    m.lathe(0, 0, [(rc(pz - 7.5) + 0.05, pz - 7.5), (3.3, pz - 4.6), (RP - 0.2, zb), (RP + 0.15, zf)], NS, [IVS, IVS, IV, IV], cap=False)
    with clear(m):
        m.lathe(0, 0, [(RP, zf), (RP, zd - 0.05)], NS, ['glass_c', 'glass_b'], cap=False)
    for k in range(NS):
        a = 2 * math.pi * k / NS
        m.beam((RP * math.cos(a), RP * math.sin(a), zf), (RP * math.cos(a), RP * math.sin(a), zd), 0.12, 0.14, IV)
    m.cap(ngon(RP, NS), zf + 0.02, 'pave_light')
    m.cyl(0, 0, zf, zu + 0.6, 1.55, 10, IVS, cap=False)                               # the lift core
    with m.use('metal'):
        for k in range(2):
            a = math.pi / 2 + k * math.pi
            with m.at(1.56 * math.cos(a), 1.56 * math.sin(a), zf, a + math.pi / 2):
                m.fq(-0.55, 0.55, 0, 2.3, -0.01, 'brushed')
    m.lathe(0, 0, [(RP - 0.2, zd), (RP + 1.05, zd + 0.05), (RP + 1.15, zd + 0.3), (RP - 0.2, zd + 0.32)], NS, [IVS, IV, IV, 'pave_light'], cap=False)
    m.cap(ngon(RP + 0.95, NS), zd + 0.32, 'pave_light')
    with m.use('glow'):
        m.lathe(0, 0, [(RP + 1.16, zd + 0.08), (RP + 1.16, zd + 0.22)], NS, 'line', cap=False)
    rail_ring(m, 0, 0, zd + 0.32, RP + 0.9, n=NS, post=2.0)
    with clear(m):
        m.lathe(0, 0, [(3.6, zd + 0.32), (3.6, zu - 0.1)], NS, ['glass_c', 'glass_b'], cap=False)
    for k in range(0, NS, 2):
        a = 2 * math.pi * k / NS
        m.beam((3.6 * math.cos(a), 3.6 * math.sin(a), zd + 0.32), (3.6 * math.cos(a), 3.6 * math.sin(a), zu), 0.1, 0.12, IV)
    m.lathe(0, 0, [(3.4, zu - 0.1), (3.95, zu), (3.85, zu + 0.35), (rc(pz + 10.0) + 0.1, pz + 10.0)], NS, [IVS, IV, IV, IVS], cap=False)
    m.lathe(0, 0, [(rc(ZC) + 0.25, ZC - 0.4), (rc(ZC) + 0.25, ZC + 0.3), (0.55, ZC + 2.2), (0.3, ZC + 9.0), (0.14, TOP - 6.0), (0.05, TOP)], 8,
            [IV, IV, 'pale_metal', 'pale_metal', 'pale_metal', 'pale_metal'], cap=False)
    with m.use('glow'):
        m.ball(0, 0, TOP - 6.0, 0.4, 't_red', n=6, rings=3)
        m.ball(0, 0, TOP + 0.15, 0.22, 't_red', n=5, rings=3)
        m.lathe(0, 0, [(0.62, ZC + 0.6), (0.4, ZC + 1.9)], 8, 'lamp', cap=False)
    m.part('')
    m.meta.update(height=TOP, crownBase=ZS, plazaRadius=PR, door=[0, round(PR, 1)])


# ================================================================== stations
def platform(m, x0, x1, sy, outer, lip=True, z_lo=9.2):
    """One side platform. sy = +1 (back) or -1 (front); it runs from EDGE out to `outer` from the track centre."""
    a, b = (EDGE, 3.6) if sy > 0 else (-3.6, -EDGE)
    m.box(x0, x1, a, b, DECK + 0.35, PLAT, 'pave_light', top='pave_light', bottom=True)
    a2, b2 = (3.6, outer) if sy > 0 else (-outer, -3.6)
    m.box(x0, x1, a2, b2, z_lo, PLAT, 'w_stone', top='pave_light', bottom=True)
    ya, yb = (EDGE + 0.05, EDGE + 0.5) if sy > 0 else (-EDGE - 0.5, -EDGE - 0.05)
    m.poly([(x0, ya, PLAT + 0.02), (x1, ya, PLAT + 0.02), (x1, yb, PLAT + 0.02), (x0, yb, PLAT + 0.02)], 'hazard')


def roundel(m, x, y, z, rz=0.0, r=0.8):
    """The island metro's mark: an open pearl ring, like the loop line itself, with a line of light in the line
    colour round its face and a small gap at the top right (the same family as the ring gates the trains fly through)."""
    with m.at(x, y, z, rz):
        a0, a1 = math.radians(70), math.radians(70 + 320)
        pts = [(r * math.cos(a0 + (a1 - a0) * i / 24), 0.0, r * math.sin(a0 + (a1 - a0) * i / 24)) for i in range(25)]
        m.tube(pts, 0.15, 8, 'pearl', caps=True)
        with m.use('glow'):
            m.tube([(px * 1.0, -0.13, pz * 1.0) for px, _, pz in pts], 0.055, 5, 'line', caps=True)
            m.tube([(px * 1.0, 0.13, pz * 1.0) for px, _, pz in pts], 0.055, 5, 'line', caps=True)


def escalator(m, xa, xb, y, za, zb, w=2.6):
    """A sloping escalator bank from (xa, za) at the top down to (xb, zb), along x at depth y."""
    m.beam((xa, y, za - 0.3), (xb, y, zb - 0.3), w, 0.6, 'steel_light')
    m.beam((xa, y, za + 0.03), (xb, y, zb + 0.03), w - 0.7, 0.06, 'iron')
    for sy in (-1, 1):
        yy = y + sy * (w / 2 - 0.12)
        with m.use('glass'):
            m.sheet([(xa, yy, za), (xb, yy, zb), (xb, yy, zb + 1.0), (xa, yy, za + 1.0)], 'glass_c')
        m.beam((xa, yy, za + 1.0), (xb, yy, zb + 1.0), 0.14, 0.1, 'line')
    m.beam((xa, y, za + 0.5), (xb, y, zb + 0.5), 0.12, 0.9, 'steel_light')
    mid_support(m, xa, xb, y, za, zb, w)


def stair(m, xa, xb, y, za, zb, w=2.4, n=14):
    """A straight flight of chunky steps with solid sides."""
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        x0, x1 = xa + (xb - xa) * t0, xa + (xb - xa) * t1
        zt = za + (zb - za) * t0
        m.box(min(x0, x1), max(x0, x1), y - w / 2, y + w / 2, zt - (za - zb) / n - 0.5, zt, 'pave_light', bottom=True)
    for sy in (-1, 1):
        yy = y + sy * w / 2
        m.beam((xa, yy, za + 0.45), (xb, yy, zb + 0.45), 0.16, 1.5, 'w_stone')
        m.beam((xa, yy, za + 1.25), (xb, yy, zb + 1.25), 0.14, 0.1, 'line')
    mid_support(m, xa, xb, y, za, zb, w)


def mid_support(m, xa, xb, y, za, zb, w):
    """A long flight does not span on its own: a steel portal (two posts and a cross beam on footings) holds it
    up at each third, down to the ground."""
    if abs(za - zb) < 3.5:
        return
    for t in ((0.5,) if abs(za - zb) < 7 else (0.35, 0.68)):
        x = xa + (xb - xa) * t
        z = za + (zb - za) * t - 0.7
        if z < 1.0:
            continue
        for sy in (-1, 1):
            yy = y + sy * (w / 2 - 0.2)
            m.cyl(x, yy, 0, 0.3, 0.35, 6, 'plinth')
            m.cyl(x, yy, 0.3, z, 0.14, 6, 'steel_light', cap=False)
        m.beam((x, y - w / 2, z), (x, y + w / 2, z), 0.3, 0.3, 'steel_light')


def footing(m, x, y, r=1.0, z=0.0, col='pave_dark'):
    m.cyl(x, y, z - 0.6, z + 0.25, r, 8, col)


def grail(m, pts, z, h=1.1, posts=True):
    """A glass railing with a metal top rail along a ground line [(x, y), ...]."""
    for (xa, ya), (xb, yb) in zip(pts[:-1], pts[1:]):
        with m.use('glass'):
            m.sheet([(xa, ya, z + 0.08), (xb, yb, z + 0.08), (xb, yb, z + h - 0.06), (xa, ya, z + h - 0.06)], 'glass_c')
        rod(m, (xa, ya, z + h), (xb, yb, z + h), 0.05, 'pale_metal')
    if posts:
        for x, y in pts:
            m.cyl(x, y, z, z + h, 0.05, 4, 'pale_metal', cap=False)


def lift_tower(m, cx, cy, top, base=0.0, stops=(), door=(0, -1), w=2.6):
    """A glass lift shaft with a metal frame, standing on `base`. stops = floor heights where it has a door
    (a lit frame on the side `door` = (dx, dy)); the car waits at the first one. w = shaft width."""
    h_ = w / 2
    m.cbox(cx, cy, w + 0.4, w + 0.4, base, base + 0.3, 'pave_dark')
    with m.use('glass'):
        m.cbox(cx, cy, w, w, base + 0.3, top, 'glass_b', top=False)
    for dx in (-h_, h_):
        for dy in (-h_, h_):
            m.cbox(cx + dx, cy + dy, 0.2, 0.2, base + 0.3, top, 'pale_metal', top=False)
    m.rbox(cx, cy, w + 0.6, w + 0.6, top, top + 0.5, 'pearl', r=0.4, seg=1, bev=0.15, bottom=True)
    with m.use('glow'):
        m.box(cx - h_ - 0.32, cx + h_ + 0.32, cy - h_ - 0.32, cy + h_ + 0.32, top + 0.08, top + 0.2, 'line', top=False)
    for i, zz in enumerate(stops):
        with m.at(cx + door[0] * (h_ + 0.02), cy + door[1] * (h_ + 0.02), zz, math.atan2(door[0], -door[1])):
            m.box(-0.75, 0.75, -0.06, 0.02, 0.0, 2.35, 'pearl', bottom=False)
            m.fq(-0.6, 0.6, 0.0, 2.2, -0.08, 'pale_metal')
            m.fq(-0.02, 0.02, 0.0, 2.2, -0.09, 'rubber')
            with m.use('glow'):
                m.fq(-0.3, 0.3, 2.24, 2.32, -0.08, 'lamp')
        if i == 0:
            m.cbox(cx, cy, w - 0.5, w - 0.5, zz + 0.05, zz + 2.4, 'pearl_shade')


# ---- the stations: floating-train docks for two lanes. Lane centres are 2.1 m either side of the centreline;
# trains keep right. The manifest still calls the lane's datum "rail level" (10 m): the cars' floors are 1.1 m above it.
TRK, PEDGE, POUT, PHALF = 2.1, 3.65, 9.4, 24.0          # POUT was 8.2: the platforms are 1.2 m wider, outward
PITCH, DOORW, GATEW = 14.6, 1.5, 1.9
DOORX = [-18.1, -11.1, -3.5, 3.5, 11.1, 18.1]          # door centres of a 3-car train stopped with its middle at x = 0
ZS = 9.2                                                # underside of the platform decks
WELL = (0.4, 7.4, 6.7, 8.9)
SIGN_Y = 8.26                                           # the platform name boards (unchanged)
LIFT_Y, LIFT_W = 7.9, 2.2                               # the platform lifts: a slimmer shaft, further out                             # the opening in each platform where the escalators come up (x0, x1, y0, y1 on the back side)
CONC = 5.4                                              # floor of the concourse under the lanes
from props import sign_quad


def deck_side(m, well_floor):
    """One platform deck (the one on +y; the other is this turned half a turn): a shallow hull-shaped box girder
    with a line of light along its edge and an opening where the escalators arrive."""
    w0, w1, y0, y1 = WELL
    A, B, Cc, D, E, F = (PEDGE, PLAT), (POUT, PLAT), (POUT, 10.25), (POUT - 0.4, ZS), (PEDGE + 0.9, ZS), (PEDGE, 10.25)

    def strip(xa, xb, p, q, col, mat='city'):
        with m.use(mat):
            m.poly([(xa, p[0], p[1]), (xb, p[0], p[1]), (xb, q[0], q[1]), (xa, q[0], q[1])], col)
    for p, q, col in ((B, Cc, 'pearl'), (Cc, D, 'pearl_shade'), (E, F, 'pearl_shade'), (F, A, 'pearl')):
        strip(-PHALF, PHALF, p, q, col)
    for (p, q, col) in ((A, B, 'pave_light'), (D, E, 'pearl_shade')):
        lo, hi = sorted((p[0], q[0]))
        zz = p[1]
        up = p is A
        for xa, xb, ya, yb in ((-PHALF, w0, lo, hi), (w1, PHALF, lo, hi), (w0, w1, lo, y0), (w0, w1, y1, hi)):
            quad = [(xa, ya, zz), (xb, ya, zz), (xb, yb, zz), (xa, yb, zz)]
            m.poly(quad if up else quad[::-1], col)
    for xe, d in ((-PHALF, -1), (PHALF, 1)):
        ring = [(xe, y_, z_) for y_, z_ in (A, B, Cc, D, E, F)]
        m.poly(ring[::-1] if d > 0 else ring, 'pearl')
    zb = well_floor                                      # the walls of the opening
    m.poly([(w0, y0, zb), (w1, y0, zb), (w1, y0, PLAT), (w0, y0, PLAT)][::-1], 'pearl_shade')
    m.poly([(w0, y1, zb), (w1, y1, zb), (w1, y1, PLAT), (w0, y1, PLAT)], 'pearl_shade')
    m.poly([(w0, y0, zb), (w0, y1, zb), (w0, y1, PLAT), (w0, y0, PLAT)][::-1], 'pearl_shade')
    m.poly([(w1, y0, zb), (w1, y1, zb), (w1, y1, PLAT), (w1, y0, PLAT)], 'pearl_shade')
    grail(m, [(w0, y0), (w1, y0), (w1, y1), (w0, y1)], PLAT)
    # the edge: a line of light on top and down the face, with a pale safety band behind it
    with m.use('glow'):
        strip(-PHALF, PHALF, (PEDGE + 0.02, PLAT + 0.02), (PEDGE + 0.2, PLAT + 0.02), 'hover')
        strip(-PHALF, PHALF, (PEDGE - 0.02, PLAT - 0.3), (PEDGE - 0.02, PLAT - 0.06), 'hover')
    strip(-PHALF, PHALF, (PEDGE + 0.2, PLAT + 0.02), (PEDGE + 0.55, PLAT + 0.02), 'pearl_hi')
    # rails across both ends of the platform
    for xe in (-PHALF + 0.06, PHALF - 0.06):
        grail(m, [(xe, PEDGE + 0.3), (xe, POUT - 0.12)], PLAT, 1.3)


def metro_platforms(m, piers=True, cz=PLAT + 4.4, ch=3.0, well_floor=ZS):
    """Two 48 m side platforms with half-height gates that line up with the train doors, screens, signs and a vault
    on columns and ribs. The trains float in between them. piers=True stands the decks on four portal frames
    (two columns on footings and a curved cross beam each) with a slim docking line of light along the middle."""
    gates, signs, boards = [], [], []
    m.glass_mat = 'glass'
    m.ao = 4.5                               # short-range baked shade, so the underside of the roof does not go black
    for rz in (0.0, math.pi):
        with m.at(0, 0, 0, rz):
            deck_side(m, well_floor)
    if piers:
        for px in (-18.0, -6.0, 6.0, 18.0):
            for sy in (-1, 1):
                footing(m, px, sy * 4.9, 1.1)
                m.lathe(px, sy * 4.9, [(0.62, 0.25), (0.46, 0.9), (0.46, ZS - 0.5), (0.6, ZS)], 10, 'pearl', cap=False)
            for sy in (-1, 1):               # a haunched bracket carries the deck out past the column to its outer edge
                with m.at(px, 0, 0, math.pi / 2 if sy > 0 else -math.pi / 2):
                    m.plate([(4.4, ZS - 1.4), (POUT - 0.5, ZS - 0.05), (POUT - 0.5, ZS), (4.4, ZS)][::-1] if False else [(4.4, ZS), (POUT - 0.5, ZS), (POUT - 0.5, ZS - 0.35), (4.4, ZS - 1.5)], 0.25, 0.5, 'pearl', edge='pearl_shade', back=True)
            pts = [(px, y_, ZS - 0.1 - 0.9 * (1 - (y_ / 4.9) ** 2)) for y_ in (-4.9, -3.7, -2.3, 0.0, 2.3, 3.7, 4.9)]
            m.tube(pts, [0.36, 0.3, 0.26, 0.24, 0.26, 0.3, 0.36], 6, 'pearl', caps=False)
        zl = ZS - 1.0 + 0.2
        m.box(-18.2, 18.2, -0.2, 0.2, zl - 0.22, zl + 0.1, 'pearl', top='pearl', bottom=True)
        with m.use('glow'):
            m.box(-18.0, 18.0, -0.09, 0.09, zl + 0.1, zl + 0.15, 'hover')
            m.poly([(-18.0, -0.09, zl - 0.225), (-18.0, 0.09, zl - 0.225), (18.0, 0.09, zl - 0.225), (18.0, -0.09, zl - 0.225)], 'hover')
    for sy in (-1, 1):
        # the gate line: fixed glass between the doorways, a sliding panel (child node) at each doorway
        yg = sy * (PEDGE + 0.3)
        edges = [-PHALF] + [v for dx in DOORX for v in (dx - GATEW / 2, dx + GATEW / 2)] + [PHALF]
        for k in range(0, len(edges), 2):
            xa, xb = edges[k], edges[k + 1]
            with m.use('glass'):
                m.sheet([(xa, yg, PLAT + 0.15), (xb, yg, PLAT + 0.15), (xb, yg, PLAT + 1.3), (xa, yg, PLAT + 1.3)], 'glass_c')
            m.beam((xa, yg, PLAT + 1.34), (xb, yg, PLAT + 1.34), 0.12, 0.08, 'pale_metal')
            m.beam((xa, yg, PLAT + 0.1), (xb, yg, PLAT + 0.1), 0.12, 0.2, 'pearl')
        for dx in DOORX:
            for ex in (dx - GATEW / 2, dx + GATEW / 2):
                m.cbox(ex, yg, 0.22, 0.26, PLAT, PLAT + 1.5, 'pearl')
                with m.use('glow'):
                    m.cbox(ex, yg, 0.24, 0.28, PLAT + 1.5, PLAT + 1.58, 'line')
        for i, dx in enumerate(DOORX):
            nm = f'gate_{len(gates) + 1}'
            yq = sy * (PEDGE + 0.2)
            m.part(nm, pivot=(dx, yq, PLAT))
            with m.use('glass'):
                m.sheet([(dx - GATEW / 2 + 0.12, yq, PLAT + 0.15), (dx + GATEW / 2 - 0.12, yq, PLAT + 0.15), (dx + GATEW / 2 - 0.12, yq, PLAT + 1.25), (dx - GATEW / 2 + 0.12, yq, PLAT + 1.25)], 'glass_a')
            m.beam((dx - GATEW / 2 + 0.12, yq, PLAT + 1.28), (dx + GATEW / 2 - 0.12, yq, PLAT + 1.28), 0.08, 0.06, 'pale_metal')
            m.beam((dx - GATEW / 2 + 0.12, yq, PLAT + 0.1), (dx + GATEW / 2 - 0.12, yq, PLAT + 0.1), 0.08, 0.1, 'pale_metal')
            m.part('')
            gates.append({'name': f'{m.name}_{nm}', 'x': dx, 'side': '+z' if sy < 0 else '-z', 'open': [GATEW - 0.2, 0, 0]})
        # outer screen wall, benches, name boards (facing out) and the next-train board (hung from the roof, facing the lanes)
        yo = sy * (POUT - 0.12)
        m.box(-PHALF, PHALF, min(yo, sy * POUT), max(yo, sy * POUT), PLAT, PLAT + 0.9, 'pearl')
        with m.use('glass'):
            m.sheet([(-PHALF, yo, PLAT + 0.9), (PHALF, yo, PLAT + 0.9), (PHALF, yo, PLAT + 2.5), (-PHALF, yo, PLAT + 2.5)], 'glass_c')
        m.beam((-PHALF, yo, PLAT + 2.54), (PHALF, yo, PLAT + 2.54), 0.14, 0.1, 'pale_metal')
        for bx in (-19.0, -12.0, 12.0, 19.0):
            m.bench(bx, sy * (POUT - 0.8), 0.0 if sy > 0 else math.pi, 2.2, z=PLAT, col='pearl_shade')
        for sx in (-1, 1):                   # the name boards stay where they were, now on two posts each on the wider platform
            for ex in (-3.65, 3.65):
                m.cyl(sx * 12.0 + ex, sy * (SIGN_Y + 0.12), PLAT, PLAT + 2.5, 0.07, 6, 'pale_metal', cap=False)
            signs.append(sign_quad(m, f'sign_{len(signs) + 1}', sx * 12.0, sy * SIGN_Y, PLAT + 1.75, 7.0, 1.3, 0.0 if sy < 0 else math.pi))
        boards.append(sign_quad(m, f'board_{len(boards) + 1}', 0.0, sy * 5.6, PLAT + 3.3, 3.6, 0.9, math.pi if sy < 0 else 0.0))
        for bx in (-1.4, 1.4):
            m.cbox(bx, sy * 5.72, 0.07, 0.07, PLAT + 3.8, cz + 2.0, 'pale_metal', top=False)
        # the roof's columns stand on the platform by the outer screen
        for px in (-20.0, -10.0, 0.0, 10.0, 20.0):
            m.cyl(px, sy * (POUT - 0.5), PLAT, PLAT + 0.2, 0.34, 8, 'pale_metal')
            m.cyl(px, sy * (POUT - 0.5), PLAT + 0.2, cz + 0.3, 0.2, 8, 'pearl', cap=False)
        with m.use('glow'):
            m.box(-PHALF, PHALF, sy * (POUT + 0.85) - 0.1, sy * (POUT + 0.85) + 0.1, cz - 0.12, cz + 0.08, 'line', bottom=True)
    m.vault_soffit = 'pearl_hi'
    Pv = m.vault(-PHALF - 0.5, PHALF + 0.5, -POUT - 0.9, POUT + 0.9, cz, ch, 'pearl', axis='x', n=14, over=0.0, end=None, th=0.3, ribs=0, arc=2.0)
    m.vault_soffit = None
    with m.use('glass_dark'):
        for k in (6, 7):
            (ya, za), (yb, zb) = Pv[k], Pv[k + 1]
            m.poly([(-PHALF + 2, ya, za + 0.08), (PHALF - 2, ya, za + 0.08), (PHALF - 2, yb, zb + 0.08), (-PHALF + 2, yb, zb + 0.08)], 'glass_a')
    for px in (-20.0, -10.0, 0.0, 10.0, 20.0):                 # an arched rib over each pair of columns carries the vault
        m.tube([(px, y_, z_ - 0.42) for y_, z_ in Pv[::2]], 0.17, 4, 'pearl', caps=False)
        for k in range(14):
            (ya, za), (yb, zb) = Pv[k], Pv[k + 1]
            m.poly([(px - 0.05, ya, za + 0.04), (px + 0.05, ya, za + 0.04), (px + 0.05, yb, zb + 0.04), (px - 0.05, yb, zb + 0.04)], 'seam')
    with m.use('glow'):                                        # a line of light under the ridge
        m.box(-PHALF + 3, PHALF - 3, -0.15, 0.15, cz + ch - 0.42, cz + ch - 0.34, 'lamp', bottom=True)
    for sy in (-1, 1):                                         # two long light bars over each platform, hung on rods
        yy = sy * 5.3
        m.box(-PHALF + 2, PHALF - 2, yy - 0.22, yy + 0.22, cz + 0.15, cz + 0.3, 'pearl_hi', bottom=False)
        with m.use('glow'):
            m.box(-PHALF + 2.1, PHALF - 2.1, yy - 0.17, yy + 0.17, cz + 0.12, cz + 0.15, 'lamp', bottom=True, top=False)
        for px in (-18.0, -6.0, 6.0, 18.0):
            m.cyl(px, yy, cz + 0.3, cz + 0.9, 0.025, 4, 'pale_metal', cap=False)
    return gates, signs, boards, cz


def metro_meta(m, gates, signs, boards, cz, clear=8.6, **extra):
    # clear = the height above which nothing stands between the platforms (the trains' bellies are at railTop + 0.34)
    m.meta.update(length=2 * PHALF, gates=gates, signs=signs, boards=boards,
                  track={'axis': 'x', 'centre': [0, 0], 'centres': [TRK, -TRK], 'offset': TRK, 'railTop': DECK, 'deckTop': DECK, 'deckWidthMin': 2 * PEDGE,
                         'floating': True, 'clearAbove': clear,
                         'keepRight': 'a train running towards +x uses the track at z = +2.1 and the platform on +z'},
                  platform={'top': PLAT, 'length': 2 * PHALF, 'edge': PEDGE, 'outer': POUT, 'sides': ['+z', '-z']},
                  stop={'trainCentre': [0, 0], 'cars': 3, 'carPitch': PITCH, 'carCentres': [-PITCH, 0, PITCH], 'doorCentres': DOORX, 'doorWidth': DOORW, 'gateWidth': GATEW},
                  canopy={'underside': round(cz, 2)}, **extra)


def platform_access(m, bottom, lift_base, down_to=None):
    """What brings people up through each platform's opening: a pair of escalators and a glass lift.
    down_to = a lower floor the escalators continue to (the main station's hall floor)."""
    w0, w1, y0, y1 = WELL
    for rz in (0.0, math.pi):
        with m.at(0, 0, 0, rz):
            xb = w0 + (PLAT - bottom) / 5.7 * 9.6
            escalator(m, w0, xb, (y0 + y1) / 2, PLAT, bottom, y1 - y0 - 0.1)
            if down_to is not None:
                xc = xb + 1.2 + (bottom - down_to) / 5.7 * 9.6
                m.box(xb - 0.2, xb + 1.4, y0 + 0.05, y1 - 0.05, bottom - 0.35, bottom, 'pearl_shade')      # the landing
                escalator(m, xb + 1.2, xc, (y0 + y1) / 2, bottom, down_to, y1 - y0 - 0.1)
            lift_tower(m, -3.2, LIFT_Y, PLAT + 2.9, base=lift_base, stops=(lift_base + 0.3, PLAT) if lift_base < PLAT - 1 else (PLAT,), door=(1, 0), w=LIFT_W)
            # under the low end of each escalator a solid skirt closes the space nobody can stand in
            zt_ = bottom + 2.3
            xs_ = w0 + (PLAT - zt_ - 0.6) / (PLAT - bottom) * (xb - w0)
            for yy in (y0 + 0.02, y1 - 0.02):
                m.sheet([(xs_, yy, bottom), (xb, yy, bottom), (xb, yy, bottom + 0.4), (xs_, yy, zt_)], 'pearl_shade')


@model('station', 'station', seed=21, smooth=62.0)
def station(m):
    """A station on the loop, built as a real elevated station. Street: a glass entrance pavilion on a paved forecourt,
    with fare gates inside. From there escalators and stairs rise to a concourse slung under the lanes, which joins
    both sides; from the concourse a pair of escalators and a lift come up through each platform. A lift also runs
    from the street to the concourse, and a second stair goes down at the back. The platforms stand on four portal
    frames with footings; the vault stands on columns and ribs."""
    gates, signs, boards, cz = metro_platforms(m)
    platform_access(m, CONC, CONC - 0.3)
    # ---- the concourse: a slab under the lanes on beams, railed all round
    cw, cd = 12.0, 8.0
    m.rbox(0, 0, 2 * cw, 2 * cd, CONC - 0.4, CONC, 'pearl_shade', r=0.4, seg=2, top='pave_light', bottom=True)
    for sg in (1, -1):                       # a bay where each pair of platform escalators lands (the wells moved out)
        m.box(min(sg * 7.2, sg * cw), max(sg * 7.2, sg * cw), min(sg * cd, sg * 9.1), max(sg * cd, sg * 9.1), CONC - 0.4, CONC, 'pearl_shade', top='pave_light', bottom=True)
    for bx in (-6.0, 6.0, -11.0, 11.0):
        m.box(bx - 0.3, bx + 0.3, -cd + 0.6, cd - 0.6, CONC - 1.0, CONC - 0.4, 'pearl', top=False, bottom=True)
    for bx in (-11.0, 11.0):
        for sy in (-1, 1):
            footing(m, bx, sy * 4.9, 0.8)
            m.cyl(bx, sy * 4.9, 0.25, CONC - 1.0, 0.3, 8, 'pearl', cap=False)
    fl, bl = (-2.6, 2.85, -11.3), (-2.85, 2.6, 11.3)            # the front and back landings (x0, x1, outer y)
    m.box(fl[0], fl[1], fl[2], -cd + 0.2, CONC - 0.4, CONC, 'pearl_shade', top='pave_light', bottom=True)
    m.box(bl[0], bl[1], cd - 0.2, bl[2], CONC - 0.4, CONC, 'pearl_shade', top='pave_light', bottom=True)
    for sx in (-1, 1):
        for yy in (fl[2] + 0.3, bl[2] - 0.3):
            footing(m, sx * 2.3, yy, 0.6)
            m.cyl(sx * 2.3, yy, 0.25, CONC - 0.4, 0.2, 6, 'pearl', cap=False)
    for edge in ([(2.6, -cd), (cw, -cd), (cw, 9.1), (10.2, 9.1)], [(7.2, cd), (2.6, cd)]):
        grail(m, edge, CONC)
        grail(m, [(-x_, -y_) for x_, y_ in edge], CONC)
    # front landing: open on its left, where the escalators and stair arrive, and at the lift door on its right
    grail(m, [(2.85, -cd), (2.85, -8.9)], CONC)
    grail(m, [(2.85, -10.6), (2.85, fl[2]), (-2.6, fl[2])], CONC)
    grail(m, [(-2.85, cd), (-2.85, bl[2]), (2.6, bl[2])], CONC)        # back landing: open on its right, where the stair leaves
    # fare gates across the back landing (the front ones are down in the entrance pavilion)
    for yy in (cd - 0.9,):
        for gx in (-1.8, -0.6, 0.6, 1.8):
            m.rbox(gx, yy, 0.3, 1.3, CONC, CONC + 1.0, 'pearl', r=0.12, seg=1, bev=0.08)
            with m.use('glow'):
                m.cbox(gx, yy, 0.2, 0.5, CONC + 1.0, CONC + 1.04, 'hover')
    # ---- the street: the entrance pavilion with its forecourt, the way up, the lift
    ey = (fl[2] - cd) / 2 - 0.1                                # centre line of the way up, beside the front landing
    px0, px1, py0, py1 = -23.0, -11.6, -13.9, -7.4
    pcx, pcy = (px0 + px1) / 2, (py0 + py1) / 2
    m.rbox(pcx, pcy - 1.6, px1 - px0 + 3.0, py1 - py0 + 5.2, -0.6, 0.12, 'pave_dark', r=2.0, seg=2, top='pave')          # the forecourt
    m.rbox(pcx, pcy, px1 - px0, py1 - py0, 0.0, 0.3, 'pave_light', r=1.4, seg=3)
    m.rbox(pcx, pcy, px1 - px0 + 1.4, py1 - py0 + 1.4, 3.9, 4.3, 'pearl', r=1.9, seg=3, bev=0.2, bottom=True)            # the roof
    posts = [(px0 + 0.7, py0 + 0.7), (pcx, py0 + 0.5), (px1 - 0.7, py0 + 0.7), (px1 - 0.7, py1 - 0.7), (pcx, py1 - 0.5), (px0 + 0.7, py1 - 0.7)]
    for x_, y_ in posts:
        m.cyl(x_, y_, 0.3, 3.9, 0.14, 6, 'pale_metal', cap=False)
    dx_ = -19.2                                               # the door, on the front
    with m.use('glass'):
        for (xa, ya), (xb, yb) in (((px0 + 0.7, py0 + 0.5), (dx_ - 1.25, py0 + 0.5)), ((dx_ + 1.25, py0 + 0.5), (px1 - 0.7, py0 + 0.5)), ((px0 + 0.5, py0 + 0.7), (px0 + 0.5, py1 - 0.7)), ((px0 + 0.7, py1 - 0.5), (px1 - 0.7, py1 - 0.5))):
            m.sheet([(xa, ya, 0.3), (xb, yb, 0.3), (xb, yb, 3.9), (xa, ya, 3.9)], ['glass_b', 'glass_b', 'glass_c', 'glass_c'])
    with m.at(dx_, py0 + 0.5, 0.3):
        m.box(-1.25, 1.25, -0.1, 0.1, 2.3, 3.6, 'pearl', bottom=True)           # the wall over the door
        for sx in (-1.25, 1.15):
            m.box(sx, sx + 0.1, -0.1, 0.1, 0, 2.3, 'pearl', top=False)
        with m.use('glass'):
            for sx in (-1, 1):
                m.sheet([(min(0, sx * 1.12), -0.02, 0.05), (max(0, sx * 1.12), -0.02, 0.05), (max(0, sx * 1.12), -0.02, 2.25), (min(0, sx * 1.12), -0.02, 2.25)], 'glass_a')
        m.fq(-0.03, 0.03, 0, 2.3, -0.06, 'pale_metal')
        m.box(-1.5, 1.5, -1.3, -0.1, -0.3, 0.0, 'pave_light')                    # the threshold step
    with m.use('glow'):
        m.box(px0 + 1.2, px1 - 1.2, py0 - 0.72, py0 - 0.66, 4.0, 4.2, 'line', top=False)
    signs.append(sign_quad(m, f'sign_{len(signs) + 1}', dx_ + 2.0, py0 - 0.4, 5.25, 6.0, 1.2, 0.0))
    for sx in (-2.4, 2.4):
        m.cbox(dx_ + 2.0 + sx, py0 - 0.3, 0.12, 0.12, 4.3, 5.0, 'pale_metal', top=False)
    for gx_ in (-1.9, -0.7, 0.5, 1.7):                        # fare gates inside, between the door and the way up
        m.rbox(-15.6, pcy + gx_ * 1.15, 1.3, 0.3, 0.3, 1.3, 'pearl', r=0.12, seg=1, bev=0.08)
        with m.use('glow'):
            m.cbox(-15.6, pcy + gx_ * 1.15, 0.5, 0.2, 1.3, 1.34, 'hover')
    xt = fl[0]                                                # the way up: escalators and a stair, side by side, from inside the pavilion
    escalator(m, xt, -12.6, ey + 0.75, CONC, 0.3, 1.5)
    stair(m, xt, -12.6, ey - 0.85, CONC, 0.3, 1.5, 30)
    lx, ly = fl[1] + 1.3, ey
    lift_tower(m, lx, ly, CONC + 3.0, base=0.0, stops=(0.3, CONC), door=(-1, 0))
    m.box(lx - 2.6, lx - 1.3, ly - 1.0, ly + 1.0, 0.0, 0.3, 'pave_light')
    roundel(m, px0 - 0.4, py0 - 2.6, 5.3, 0.0, 0.9)
    footing(m, px0 - 0.4, py0 - 2.6, 0.4)
    m.cyl(px0 - 0.4, py0 - 2.6, 0.2, 4.4, 0.1, 6, 'pale_metal', cap=False)
    # ---- the back: a stair from the back landing down to the street
    stair(m, bl[1], 12.6, (bl[2] + cd) / 2, CONC, 0.0, 2.6, 30)
    m.rbox(14.4, (bl[2] + cd) / 2, 4.4, 4.6, -0.6, 0.12, 'pave_dark', r=1.0, seg=2, top='pave')
    metro_meta(m, gates, signs, boards, cz, door=[dx_, round(-(py0 - 3.6), 2)], backDoor=[14.5, round(-(bl[2] + cd) / 2, 2)],
               concourse={'floor': CONC, 'halfLength': cw, 'halfWidth': cd, 'headroomBelow': CONC - 1.0},
               entrance={'door': [dx_, round(-(py0 + 0.5), 2)], 'doorHeight': 2.3, 'floor': 0.3})


@model('station_main', 'station', seed=22, smooth=62.0)
def station_main(m):
    """The Harbour station, the main one: the same platforms and gates over a large rounded hall, with a forecourt,
    a street-level terminus platform for the hill tram behind it, and a covered walk towards the ferry pier."""
    m.pad(66.0, 58.0, h=0.3, col='pave_light', r=8.0, cy=-7.0, seg=5)
    HW, HD, HH = 27.0, 13.5, 8.6
    gates, signs, boards, cz = metro_platforms(m, piers=False, cz=PLAT + 5.0, ch=4.6, well_floor=HH)
    platform_access(m, HH, 0.3, down_to=0.3)
    for rz in (0.0, math.pi):                # where the escalators go down into the hall
        with m.at(0, 0, 0, rz):
            m.poly([(4.6, WELL[2], HH + 0.03), (WELL[1], WELL[2], HH + 0.03), (WELL[1], WELL[3], HH + 0.03), (4.6, WELL[3], HH + 0.03)], 'rubber')
    # the hall: a pearl base and a deep pearl fascia with clear glass between, so the route from the doors to the
    # escalators shows from outside; a stone floor, a lit ceiling
    hall = rrect(2 * HW, 2 * HD, 5.0, 5)
    m.frustum(hall, hall, 0.3, 1.1, 'pearl', top=False)
    with clear(m):
        m.frustum(hall, hall, 1.1, 6.9, 'glass_c', top=False)
    m.frustum(hall, hall, 6.9, HH, 'pearl', top='pearl_shade')
    m.cap(rrect(2 * HW - 0.4, 2 * HD - 0.4, 4.8, 5), 0.32, 'pave_light')
    m.cap(rrect(2 * HW - 0.4, 2 * HD - 0.4, 4.8, 5), 6.88, 'pearl_hi', up=False)
    with m.use('glow'):
        for yy in (-6.0, 0.0, 6.0):
            m.box(-HW + 6, HW - 6, yy - 0.2, yy + 0.2, 6.8, 6.86, 'lamp', bottom=True, top=False)
    for i in range(len(hall)):                 # mullions round the glass
        if i % 2 == 0:
            x_, y_ = hall[i]
            m.cyl(x_, y_, 1.1, 6.9, 0.09, 5, 'pearl', cap=False)
    for gx in (-13.0, 13.0):                   # fare gates across the hall, between the doors and the escalators
        for k in range(5):
            m.rbox(gx + (k - 2) * 1.1, -3.0, 0.22, 1.4, 0.3, 1.3, 'pearl', r=0.08, seg=1)
    for sy in (-1, 1):
        a, b = (PEDGE + 0.4, POUT) if sy > 0 else (-POUT, -PEDGE - 0.4)
        m.box(-PHALF, PHALF, a, b, HH, 9.2, 'pearl_shade', top=False)
        with m.side('front' if sy < 0 else 'back', -HW, HW, -HD, HD) as Lw:
            with m.use('glow'):
                m.box(-Lw / 2 + 5.5, Lw / 2 - 5.5, -0.07, 0, 0.8, 1.05, 'line', top=False)
            m.rbox(0, 0.4, 9.5, 2.4, 0.3, 7.2, 'pearl', r=0.8, seg=3, bev=0.4)
            for dx in (-2.7, 0, 2.7):            # three pairs of doors, 2.3 m high, under a band of glass
                m.door(dx, 2.2, 2.3, col='pearl_hi', glass=0.9, double=True, y=-0.8, z=0.3, fw=0.1, dep=0.05, pane='glass_b', knob=None)
            with m.use('glass_dark'):
                m.fq(-3.9, 3.9, 2.95, 4.5, -0.82, ['glass_b', 'glass_b', 'glass_c', 'glass_c'])
            m.box(-4.4, 4.4, -2.2, -0.8, 0.0, 0.3, 'pave_light')
            m.rbox(0, -2.6, 13.0, 4.6, 5.0, 5.3, 'pearl', r=2.0, seg=4, bottom=True)
            for px_ in (-5.6, 5.6):              # the canopy stands on two posts
                m.cyl(px_, -4.3, 0.3, 0.5, 0.3, 8, 'pale_metal')
                m.cyl(px_, -4.3, 0.5, 5.0, 0.16, 8, 'pearl', cap=False)
            with m.use('glow'):
                m.box(-5.5, 5.5, -4.93, -4.86, 5.03, 5.27, 'line', top=False)
    # the docking line: a slim strip of light along the hall roof, midway between the two lanes
    m.box(-PHALF + 1.0, PHALF - 1.0, -0.22, 0.22, HH, HH + 0.14, 'pearl', bottom=False)
    with m.use('glow'):
        m.box(-PHALF + 1.2, PHALF - 1.2, -0.09, 0.09, HH + 0.14, HH + 0.19, 'hover')
    signs.append(sign_quad(m, f'sign_{len(signs) + 1}', 0, -HD - 0.86, 6.3, 7.6, 1.3, 0.0))
    roundel(m, -9.0, -HD - 7.5, 6.2, 0.0, 1.1)
    m.cyl(-9.0, -HD - 7.5, 0.3, 5.1, 0.14, 5, 'pearl', cap=False)
    # forecourt
    for lx in (-24.0, -12.0, 12.0, 24.0):
        m.globe_lamp(lx, -HD - 12.0, 5.5, z=0.3, col='pearl_shade')
    for lx in (-17.0, 17.0):
        m.lathe(lx, -HD - 5.0, [(1.4, 0.3), (2.2, 1.0), (2.0, 1.0)], 14, ['pearl_shade', 'pearl', 'soil'], cap=True)
        m.blob(lx, -HD - 5.0, 1.4, 1.7, 'leaf', n=8, rings=4, sz=0.7)
    # the covered walk towards the ferry pier
    wx = 25.0
    m.box(wx - 1.7, wx + 1.7, -HD - 34.0, -HD - 1.0, 3.6, 3.85, 'pearl', bottom=True)
    with m.use('glow'):
        for sx in (-1, 1):
            m.box(wx + sx * 1.72 - 0.04, wx + sx * 1.72 + 0.04, -HD - 34.0, -HD - 1.0, 3.62, 3.82, 'line', top=False)
    for k in range(5):
        m.cyl(wx, -HD - 3.0 - k * 7.5, 0.3, 0.5, 0.3, 8, 'pale_metal')
        m.cyl(wx, -HD - 3.0 - k * 7.5, 0.5, 3.6, 0.15, 6, 'pearl', cap=False)
        m.box(wx - 1.5, wx + 1.5, -HD - 3.0 - k * 7.5 - 0.1, -HD - 3.0 - k * 7.5 + 0.1, 3.4, 3.6, 'pearl', top=False, bottom=True)
    # the hill pod's dock behind the hall: a low platform at street level; the pod floats in beside it
    ty = HD + 3.2
    m.rbox(0, HD + 0.9, 15.0, 1.8, 0.3, 0.9, 'pearl_shade', r=0.5, seg=2, top='pave_light')
    with m.use('glow'):
        m.poly([(-7.0, ty - 1.58, 0.92), (7.0, ty - 1.58, 0.92), (7.0, ty - 1.42, 0.92), (-7.0, ty - 1.42, 0.92)], 'hover')
        m.poly([(7.0, ty - 1.385, 0.62), (-7.0, ty - 1.385, 0.62), (-7.0, ty - 1.385, 0.8), (7.0, ty - 1.385, 0.8)], 'hover')
    m.rbox(0, HD + 2.6, 17.0, 6.4, 4.6, 4.9, 'pearl', r=2.4, seg=4, bottom=True)
    for px in (-7.0, 0.0, 7.0):
        m.cyl(px, HD + 0.9, 0.9, 1.05, 0.26, 8, 'pale_metal')
        m.cyl(px, HD + 0.9, 1.05, 4.6, 0.14, 6, 'pearl', cap=False)
    signs.append(sign_quad(m, f'sign_{len(signs) + 1}', 0, HD + 0.08, 3.4, 4.6, 0.9, math.pi))
    metro_meta(m, gates, signs, boards, cz, clear=round(HH + 0.19, 2), door=[0, round(HD + 12.0, 2)], hall={'height': HH},
               tram={'axis': 'x', 'trackCentre': [0, round(-ty, 2)], 'railTop': 0.0, 'platformTop': 0.9, 'platformEdge': 1.4, 'platformLength': 15.0},
               ferryWalkEnd=[wx, round(HD + 34.0, 2)])
