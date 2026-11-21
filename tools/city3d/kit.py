"""Generic city kit: towers, mid-rise, low-rise, industrial and props.

Each function builds one model around the origin (front = -Y in Blender = +Z in glTF).
"""
import math
from lib import Model, rect, chamfer, ngon, xform, grad, shade, mixc, C

KIT = []


def kit(cls, **kw):
    def deco(fn):
        def make():
            m = Model(fn.__name__, cls, **kw)
            fn(m)
            return m
        KIT.append(make)
        return fn
    return deco


# =============================================================== towers
@kit('tower', ao=16, seed=11)
def tower_deco_a(m):
    """New York setback tower in limestone with a copper crown."""
    col = grad('limestone', 'stone_light')
    z = m.facade(rect(46, 46), 0, 1, 6.5, 'shop', 'limestone')
    prev = None
    for w, f in ((46, 15), (38, 13), (30, 12), (22, 10), (14, 6)):
        pts = rect(w, w)
        if prev:
            m.cap_ring(prev, pts, z, 'roof_light')
            for sx in (-1, 1):
                for sy in (-1, 1):
                    m.cbox(sx * (w / 2 + 2), sy * (w / 2 + 2), 2.4, 2.4, z, z + 5, 'stone_light')
        z = m.facade(pts, z, f, 3.9, 'deco', col(min(1, z / 230)))
        prev = pts
    m.cap_ring(prev, rect(10, 10), z, 'roof_light')
    m.frustum(rect(10, 10), rect(7, 7), z, z + 8, 'copper', top=False)
    m.frustum(rect(7, 7), rect(1.2, 1.2), z + 8, z + 24, 'copper', col1=shade('copper', 1.2))
    m.cyl(0, 0, z + 23, z + 46, 0.5, 5, 'metal_light', r2=0.08)


@kit('tower', ao=14, seed=12)
def tower_deco_b(m):
    """Brick deco tower with wings and a gold lantern."""
    z = m.facade(rect(44, 32), 0, 8, 3.8, 'punch', 'brick_tan', ground='shop', gh=6)
    m.cap_ring(rect(44, 32), rect(28, 24), z, 'roof')
    m.roof_kit(-21, -15, -14, 14, z, n=1)
    z = m.facade(rect(28, 24), z, 22, 3.8, 'deco', grad('brick_tan', 'sand'))
    m.cap_ring(rect(28, 24), rect(18, 16), z, 'roof')
    z = m.facade(rect(18, 16), z, 7, 3.8, 'deco', 'sand')
    m.cap_ring(rect(18, 16), rect(12, 11), z, 'stone_light')
    m.hip(-6, 6, -5.5, 5.5, z, 11, 'gold', ridge=0.15)
    m.cyl(0, 0, z + 10, z + 22, 0.4, 5, 'metal_light', r2=0.08)


@kit('tower', ao=14, seed=13)
def tower_glass_a(m):
    """Curtain-wall slab with a stone core fin."""
    band = {24: 'louver', 49: 'louver'}
    z = m.facade(rect(48, 28), 0, 50, 4.0, 'curtain', grad('glass_deep', 'glass_sky'), ground='shop', gh=7, band=band)
    m.parapet(rect(48, 28), z, 3.0, 'metal')
    m.roof_kit(-22, 18, -12, 12, z, n=4)
    m.box(24, 31, -11, 11, 0, z + 9, 'stone_light', 'roof_light')
    m.cbox(27.5, 0, 3.2, 3.2, z + 9, z + 12, 'metal')


@kit('tower', ao=14, seed=14)
def tower_glass_b(m):
    """Two interlocking glass volumes with sloped tops."""
    za = m.facade(rect(30, 30, -7, -5), 0, 44, 3.9, 'sleek', grad('glass_teal', 'glass_sky'), ground='shop', gh=6)
    m.wedge(-22, 8, -20, 10, za, 1.0, 12.0, 'glass_sky', 'metal_light')
    zb = m.facade(rect(28, 28, 9, 8), 0, 33, 3.9, 'curtain', grad('glass_deep', 'glass_blue'), ground='shop', gh=6)
    m.wedge(-5, 23, -6, 22, zb, 8.0, 1.0, 'glass_blue', 'metal_light')


@kit('tower', ao=14, seed=15)
def tower_twist(m):
    """Twisting, tapering glass tower (Shanghai cue)."""
    base = chamfer(42, 42, 9)
    z0 = 9.0
    m.prism(ngon(27, 12), 0, z0, 'glass_dark', 'paving')
    shape = lambda t: xform(base, 1.0 - 0.24 * t ** 1.4, math.radians(105) * t)
    z, top = m.stack(shape, z0, 66, 4.0, 'sleek', grad('glass_deep', 'glass_sky'), bay=4.2)
    m.cap(top, z, 'metal_light')
    inner = xform(top, 0.72)
    m.frustum(inner, xform(top, 0.5, math.radians(12)), z, z + 14, 'glass_sky', 'metal_light')
    m.cyl(0, 0, z + 14, z + 34, 0.6, 5, 'metal_light', r2=0.08)


@kit('tower', ao=14, seed=16)
def tower_taper(m):
    """Tapered supertall with a chisel top."""
    base = chamfer(46, 46, 5)
    shape = lambda t: xform(base, 1.0 - 0.42 * t ** 1.7)
    z, top = m.stack(shape, 0, 62, 4.1, 'curtain', grad('glass_dark', 'glass_blue'), bay=4.0, band={0: 'shop', 1: 'shop', 30: 'louver', 61: 'louver'})
    m.cap(top, z, 'metal')
    w = (top[1][0] - top[0][0]) / 2 + 3.2
    m.wedge(-w, w, -w, w, z, 2.0, 22.0, 'glass_blue', 'metal_light', axis='y')
    m.cyl(0, w - 1.5, z + 20, z + 44, 0.5, 5, 'metal_light', r2=0.08)


@kit('tower', ao=14, seed=17)
def tower_crown(m):
    """Tiered pagoda-like tower with a metal crown (Jin Mao cue)."""
    z = m.facade(rect(48, 48), 0, 2, 5.5, 'shop', 'stone')
    w, prev = 44.0, rect(48, 48)
    for f in (12, 11, 9, 8, 6, 5, 4, 3, 2):
        pts = chamfer(w, w, w * 0.12)
        m.cap(prev, z, 'metal_light')
        z = m.facade(pts, z, f, 3.9, 'deco', grad('metal', 'metal_light')(min(1, z / 270)), bay=3.4)
        prev = xform(pts, 1.05)
        m.frustum(pts, prev, z - 0.01, z + 1.2, 'metal_light', top=False)
        z += 1.2
        w -= 2.6
    m.cap(prev, z, 'metal_light')
    for k in range(4):
        s = (w + 2 - k * 4.2) / 2
        m.frustum(rect(2 * s, 2 * s), rect(2 * s - 3.4, 2 * s - 3.4), z, z + 5.5, 'metal_light', col1='metal')
        z += 5.5
    m.cyl(0, 0, z, z + 34, 0.9, 6, 'metal_light', r2=0.08)


@kit('tower', ao=14, seed=18)
def tower_twin(m):
    """Twin office towers on a shared podium with a skybridge."""
    z0 = m.facade(rect(78, 40), 0, 5, 4.4, 'curtain', 'glass_blue', ground='shop', gh=6)
    m.parapet(rect(78, 40), z0, 1.2, 'stone_light', roof='paving')
    for sx, fl in ((-1, 40), (1, 36)):
        cx = sx * 23
        z = m.facade(chamfer(26, 26, 3, cx, 0), z0, fl, 3.9, 'sleek', grad('glass_teal', 'glass_sky'))
        m.cap(chamfer(26, 26, 3, cx, 0), z, 'metal')
        m.frustum(chamfer(20, 20, 3, cx, 0), chamfer(14, 14, 2, cx, 0), z, z + 7, 'metal_light')
        m.cyl(cx, 0, z + 7, z + 22, 0.4, 5, 'metal_light', r2=0.08)
    m.box(-10, 10, -4, 4, z0 + 96, z0 + 104, 'glass_deep', 'metal_light', bottom=True)


@kit('tower', ao=14, seed=19)
def tower_round(m):
    """Cylindrical glass tower on a ring podium."""
    m.prism(ngon(25, 12), 0, 9, 'stone_light', 'paving')
    z, top = m.stack(lambda t: ngon(18, 12), 9, 42, 3.9, 'curtain', grad('glass_green', 'glass_sky'), bay=4.6)
    m.cap(top, z, 'metal')
    m.frustum(ngon(15, 12), ngon(10, 12), z, z + 6, 'metal_light')
    m.dome(0, 0, z + 6, 10, 12, 3, 'glass_sky', sz=0.55)
    m.cyl(0, 0, z + 10, z + 26, 0.4, 5, 'metal_light', r2=0.08)


@kit('tower', ao=12, seed=20)
def tower_res_a(m):
    """Residential slab with balconies and stair cores."""
    z = m.facade(rect(42, 18), 0, 36, 3.1, 'balcony', 'stone_light', ground='shop', gh=5)
    m.parapet(rect(42, 18), z, 1.1, 'stone_light')
    m.roof_kit(-19, 19, -7, 7, z, n=2, tank=True)
    for cx in (-12, 12):
        m.box(cx - 3, cx + 3, 9, 12, 0, z + 4, 'brick', 'roof')
    m.box(-21.4, -20.6, -9.4, 9.4, 5, z, 'brick', bottom=True)
    m.box(20.6, 21.4, -9.4, 9.4, 5, z, 'brick', bottom=True)


@kit('tower', ao=12, seed=21)
def tower_res_b(m):
    """Cross-plan point tower (Shanghai / Hong Kong housing)."""
    a, b = 6.5, 16.0
    cross = [(-a, -b), (a, -b), (a, -a), (b, -a), (b, a), (a, a), (a, b), (-a, b), (-a, a), (-b, a), (-b, -a), (-a, -a)]
    m.prism(rect(38, 38), 0, 5.5, 'stone', 'paving')
    z = m.facade(cross, 5.5, 39, 3.1, 'balcony', grad('cream', 'white'), bay=3.25)
    m.cap(cross, z, 'roof')
    m.cbox(0, 0, 11, 11, z, z + 5, 'cream', 'roof_tile')
    m.hip(-5.5, 5.5, -5.5, 5.5, z + 5, 4, 'roof_tile', over=0.8)


# =============================================================== mid-rise
@kit('midrise', ao=6, seed=31)
def mid_brownstone(m):
    """Row of four New York walk-ups with stoops and cornices."""
    tints = ['brick_brown', 'brick', 'brick_dark', 'brick_tan']
    for i, t in enumerate(tints):
        cx = -10.5 + 7 * i
        fl = 5 if i != 2 else 4
        z = m.facade(rect(7, 14, cx, 0), 1.2, fl, 3.5, 'brick', t, bay=3.5)
        m.box(cx - 3.5, cx + 3.5, -7, 7, 0, 1.2, 'stone', top=False)
        m.box(cx - 3.7, cx + 3.7, -7.5, -6.9, z - 0.2, z + 0.7, 'stone_light', bottom=True)
        m.cap(rect(7, 14, cx, 0), z, 'roof')
        m.box(cx - 3.0, cx - 0.6, -9.6, -7, 0, 1.2, 'stone', 'stone_light')
        m.box(cx - 3.0, cx - 0.6, -10.6, -9.6, 0, 0.6, 'stone', 'stone_light')
        m.box(cx - 2.6, cx - 1.0, -7.12, -7, 1.2, 3.9, 'wood_dark', bottom=True)
        if i % 2 == 0:
            m.cbox(cx + 1, 3, 1.4, 1.4, z, z + 2.4, 'brick_dark')
    m.roof_kit(-3.5, 3.5, -6, 6, 1.2 + 5 * 3.5, n=0, tank=True)


@kit('lowrise', ao=5, seed=32)
def mid_shikumen(m):
    """Shanghai lane-house row: grey brick, red bands, stone gate, tiled gables."""
    z = m.facade(rect(32, 10), 0, 3, 3.3, 'shikumen', 'brick_grey', bay=4.0)
    m.gable(-16, 16, -5, 5, z, 3.6, 'roof_grey', axis='x', over=0.5, end='brick_grey')
    for x in (-16.3, -5.3, 5.3, 16.3):
        m.box(x - 0.35, x + 0.35, -5.4, 5.4, 0, z + 2.0, 'brick_grey', bottom=False)
        m.cbox(x, 0, 0.7, 4.0, z + 2.0, z + 4.2, 'brick_grey')
    for cx in (-10.8, 0, 10.8):
        m.box(cx - 2.4, cx + 2.4, -5.5, -5.0, 0, 4.6, 'stone', bottom=True)
        m.box(cx - 1.5, cx + 1.5, -5.6, -5.5, 0, 3.4, 'black', bottom=True)
        m.poly([(cx - 2.6, -5.55, 4.6), (cx + 2.6, -5.55, 4.6), (cx, -5.55, 6.3)], 'stone')
        m.box(cx - 1.3, cx + 1.3, -3.2, -1.2, z + 1.1, z + 2.6, 'brick_grey', False)
        m.gable(cx - 1.3, cx + 1.3, -3.2, -1.2, z + 2.6, 1.0, 'roof_grey', axis='y', over=0.3)


@kit('midrise', ao=9, seed=33)
def mid_apartment_a(m):
    z = m.facade(rect(48, 16), 0, 12, 3.1, 'balcony', 'stone_light', ground='shop', gh=5)
    m.parapet(rect(48, 16), z, 1.0, 'stone_light')
    m.roof_kit(-22, 22, -6, 6, z, n=3)
    for cx in (-16, 0, 16):
        m.box(cx - 2.5, cx + 2.5, 8, 10.5, 0, z + 3.5, 'concrete', 'roof')
    m.awning(-10, 10, -8, 5.0, 2.2, 'teal')


@kit('midrise', ao=9, seed=34)
def mid_apartment_b(m):
    z = m.facade(rect(30, 20), 0, 18, 3.1, 'balcony', 'cream', ground='shop', gh=5)
    m.parapet(rect(30, 20), z, 1.0, 'cream')
    m.roof_kit(-13, 13, -8, 8, z, n=2, tank=True)
    m.box(-15.5, -14.9, -4, 4, 5, z + 2, 'red', bottom=True)
    m.box(14.9, 15.5, -4, 4, 5, z + 2, 'red', bottom=True)


@kit('midrise', ao=8, seed=35)
def mid_corner_retail(m):
    """Corner block with a chamfered, turreted corner."""
    c = 7
    pts = [(-15, -15), (15 - c, -15), (15, -15 + c), (15, 15), (-15, 15)]
    z = m.facade(pts, 0, 6, 3.8, 'punch', 'brick_tan', ground='shop', gh=5.2)
    cor = [(x * 1.02, y * 1.02) for x, y in pts]
    m.frustum(pts, cor, z, z + 1.0, 'stone_light', top=False)
    m.cap(cor, z + 1.0, 'roof')
    m.cyl(15 - c / 2, -15 + c / 2, z + 1.0, z + 5.0, 3.6, 8, 'stone_light')
    m.cyl(15 - c / 2, -15 + c / 2, z + 5.0, z + 10.5, 4.0, 8, 'roof_green', r2=0)
    m.awning(-13, 5, -15, 4.8, 2.0, 'red')
    m.roof_kit(-13, 6, -6, 13, z + 1.0, n=3, tank=True)


@kit('midrise', ao=9, seed=36)
def mid_hotel(m):
    z = m.facade(rect(38, 20), 0, 14, 3.4, 'hotel', 'sand', ground='shop', gh=6.5)
    m.parapet(rect(38, 20), z, 1.2, 'sand')
    m.roof_kit(-17, 17, -8, 8, z, n=3)
    m.box(-8, 8, -17, -10, 5.2, 5.9, 'stone_light', bottom=True)
    for x in (-7, 7):
        m.cyl(x, -16, 0, 5.2, 0.45, 6, 'stone_light', cap=False)
    m.text('HOTEL', 5.0, 0, -9.0, z + 2.2, 'red', depth=0.5)
    m.beam((-10, -9, z + 1.6), (10, -9, z + 1.6), 0.4, 0.5, 'steel')


@kit('midrise', ao=9, seed=37)
def mid_office_glass(m):
    z = m.facade(rect(34, 30), 0, 10, 4.0, 'curtain', grad('glass_blue', 'glass_sky'), ground='shop', gh=6, band={9: 'louver'})
    m.parapet(rect(34, 30), z, 1.4, 'metal')
    m.roof_kit(-15, 15, -13, 13, z, n=4)
    m.box(-18, -17, -15.4, 15.4, 0, z + 3, 'stone_light', bottom=False)


@kit('midrise', ao=9, seed=38)
def mid_office_stone(m):
    z = m.facade(rect(40, 24), 0, 8, 3.9, 'ribbon', 'concrete', ground='shop', gh=5.5)
    m.parapet(rect(40, 24), z, 1.2, 'concrete')
    m.roof_kit(-18, 18, -10, 10, z, n=4)
    m.box(-4, 4, -13.5, -12, 0, z + 4, 'stone_light', 'roof_light')


@kit('midrise', ao=8, seed=39)
def mid_loft(m):
    """Brick warehouse loft with a fire escape and a water tank."""
    z = m.facade(rect(30, 22), 0, 7, 4.0, 'brick', 'brick', ground='shop', gh=5, bay=3.3)
    m.parapet(rect(30, 22), z, 1.3, 'brick')
    m.roof_kit(-13, 13, -9, 9, z, n=2, tank=True)
    for f in range(1, 7):
        zf = 5 + (f - 1) * 4.0 + 4.0
        m.box(4, 11, -12.4, -11, zf, zf + 0.15, 'steel', bottom=True)
        m.beam((4, -12.4, zf + 1.0), (11, -12.4, zf + 1.0), 0.08, 0.08, 'steel')
        if f < 6:
            a, b = (5 if f % 2 else 10), (10 if f % 2 else 5)
            m.beam((a, -11.9, zf), (b, -11.9, zf + 4.0), 0.7, 0.12, 'steel')


@kit('midrise', ao=10, seed=40)
def mid_mixed(m):
    """Retail podium with a small glass tower."""
    z0 = m.facade(rect(44, 34), 0, 4, 4.2, 'curtain', 'glass_blue', ground='shop', gh=6)
    m.parapet(rect(44, 34), z0, 1.2, 'stone_light', roof='paving')
    for x, y in ((-14, -8), (-16, 6), (-8, 10)):
        m.tree(x, y, 0.8, z=z0)
    z = m.facade(rect(22, 22, 8, 2), z0, 13, 3.8, 'sleek', grad('glass_green', 'glass_sky'))
    m.parapet(rect(22, 22, 8, 2), z, 1.6, 'metal')
    m.roof_kit(-1, 17, -7, 11, z, n=2)


# =============================================================== low-rise
@kit('shop', ao=4, seed=51)
def low_shops(m):
    """Row of four shops with awnings and false fronts."""
    tints = ['cream', 'brick', 'stone_light', 'brick_tan']
    aw = ['red', 'teal', 'yellow', 'cobalt']
    for i in range(4):
        cx = -13.5 + 9 * i
        h = (0.6, 1.8, 0.9, 1.4)[i]
        z = m.facade(rect(9, 12, cx, 0), 0, 2, 3.6, 'punch', tints[i], ground='shop', gh=4.6, bay=3.0)
        m.box(cx - 4.5, cx + 4.5, -6, -5.5, z, z + h, tints[i], bottom=False)
        m.cap(rect(9, 12, cx, 0), z, 'roof')
        m.awning(cx - 3.9, cx + 3.9, -6, 4.3, 1.8, aw[i], drop=0.7)
        m.cbox(cx + 1.5, 2, 2.0, 1.8, z, z + 1.3, 'metal', 'metal_light')


@kit('house', ao=4, seed=52)
def low_townhouses(m):
    """Five gabled townhouses in soft colours."""
    tints = ['cream', 'brick_tan', 'stone_light', 'brick', 'sand']
    for i in range(5):
        cx = -14 + 7 * i
        z = m.facade(rect(7, 10, cx, 0), 0.6, 3, 3.2, 'brick', tints[i], bay=3.5)
        m.box(cx - 3.5, cx + 3.5, -5, 5, 0, 0.6, 'stone', top=False)
        m.gable(cx - 3.5, cx + 3.5, -5, 5, z, 3.2, 'roof_grey' if i % 2 else 'roof_tile', axis='y', over=0.35, end=tints[i])
        m.box(cx - 2.6, cx - 1.2, -5.1, -5.0, 0.6, 3.0, 'wood_dark', bottom=True)
        m.box(cx - 2.9, cx - 0.9, -6.2, -5, 0, 0.6, 'stone_light')
        m.cbox(cx + 2.2, 2.5, 0.9, 0.9, z + 0.5, z + 4.0, 'brick_dark')


@kit('civic', ao=5, seed=53)
def low_school(m):
    """Brick school: main block, two wings, clock gable, yard and flag."""
    z = m.facade(rect(52, 14, 0, 6), 0, 3, 3.9, 'ribbon', 'brick_tan', bay=4.0)
    m.parapet(rect(52, 14, 0, 6), z, 0.8, 'brick_tan')
    for sx in (-1, 1):
        zz = m.facade(rect(14, 20, sx * 19, -11), 0, 2, 3.9, 'ribbon', 'brick_tan', bay=4.0)
        m.hip(sx * 19 - 7, sx * 19 + 7, -21, -1, zz, 3.4, 'roof_tile', ridge=0.4, over=0.6)
    m.box(-5, 5, -2.2, -1, 0, z + 5, 'stone_light', False)
    m.gable(-5, 5, -2.2, 0.5, z + 5, 3.2, 'roof_tile', axis='y', over=0.4, end='stone_light')
    m.hcyl((0, -2.2, z + 2.4), (0, -2.45, z + 2.4), 1.7, 10, 'white')
    m.box(-2, 2, -2.4, -2.2, 0, 3.4, 'wood_dark', bottom=True)
    m.poly([(-11, -20, 0.05), (11, -20, 0.05), (11, -4, 0.05), (-11, -4, 0.05)], 'roof_green')
    m.cyl(-9, -22, 0, 11, 0.12, 4, 'metal_light')
    m.poly([(-9, -22, 10.8), (-9, -22, 8.8), (-6, -22, 9.8)], 'red')
    m.poly([(-9, -22, 10.8), (-6, -22, 9.8), (-9, -22, 8.8)], 'red')


@kit('civic', ao=5, seed=54)
def low_temple(m):
    """Chinese temple hall: stone platform, red columns, double-eave tiled roof."""
    m.box(-16, 16, -11, 11, 0, 1.6, 'stone', 'paving')
    m.box(-5, 5, -14, -11, 0, 0.8, 'stone', 'paving')
    m.box(-5, 5, -12.5, -11, 0.8, 1.6, 'stone', 'paving')
    m.box(-11, 11, -6, 7, 1.6, 6.6, 'red')
    m.box(-2, 2, -6.15, -6, 1.6, 5.2, 'wood_dark', bottom=True)
    for x in (-12.5, -7.5, -2.5, 2.5, 7.5, 12.5):
        m.cyl(x, -8.3, 1.6, 6.6, 0.42, 6, 'red', cap=False)
    m.box(-13.2, 13.2, -9, 9, 6.6, 7.3, 'cobalt', bottom=True)
    m.hip(-13.2, 13.2, -9, 9, 7.3, 3.0, 'gold', ridge=0.55, over=2.6)
    m.box(-8.5, 8.5, -5, 5, 9.4, 11.6, 'red')
    m.hip(-8.5, 8.5, -5, 5, 11.6, 4.2, 'gold', ridge=0.6, over=2.4)
    m.beam((-6.2, 0, 15.9), (6.2, 0, 15.9), 0.6, 0.7, 'roof_green')
    for x, y in ((-13, -9), (13, -9)):
        m.cyl(x, y - 3, 0, 2.2, 0.9, 6, 'stone_light', r2=0.6)
        m.cyl(x, y - 3, 2.2, 3.0, 1.1, 6, 'gold', r2=0)


@kit('shop', ao=6, seed=55)
def low_market(m):
    """Market hall: brick base, big green metal roof with a clerestory lantern."""
    z = m.facade(rect(52, 24), 0, 1, 6.5, 'shop', 'brick', bay=4.3)
    m.gable(-26, 26, -12, 12, z, 7.0, 'roof_green', axis='x', over=1.2, end='brick', style='corrugated')
    m.box(-20, 20, -3, 3, z + 4.6, z + 7.6, 'glass_sky', False)
    m.gable(-20, 20, -3, 3, z + 7.6, 1.8, 'roof_green', axis='x', over=0.6, end='glass_sky', style='corrugated')
    for sx in (-1, 1):
        m.hcyl((sx * 26.02, 0, z + 2.6), (sx * 26.25, 0, z + 2.6), 2.2, 10, 'glass_sky') if sx > 0 else m.hcyl((sx * 26.25, 0, z + 2.6), (sx * 26.02, 0, z + 2.6), 2.2, 10, 'glass_sky')
    m.awning(-22, 22, -12, 5.2, 2.6, 'cream', drop=0.8)
    m.text('MARKET', 2.6, 0, -13.3, 6.9, 'cream', depth=0.3)


@kit('house', ao=3.5, seed=56)
def low_house_a(m):
    """Detached two-storey house with a porch and garage."""
    z = m.facade(rect(10, 8), 0, 2, 3.0, 'brick', 'cream', bay=3.3)
    m.gable(-5, 5, -4, 4, z, 3.0, 'roof_tile', axis='x', over=0.5, end='cream')
    m.box(5, 9.5, -3, 3.5, 0, 2.9, 'cream', False)
    m.wedge(5, 9.5, -3.3, 3.8, 2.9, 1.4, 0.2, 'roof_tile')
    m.box(5.6, 8.9, -3.06, -3, 0, 2.3, 'metal_light', bottom=True)
    m.box(-4.5, 0, -5.8, -4, 0, 0.4, 'stone', 'paving')
    m.box(-4.7, 0.2, -6, -4, 2.8, 3.0, 'white', bottom=True)
    for x in (-4.4, -0.1):
        m.cbox(x, -5.8, 0.2, 0.2, 0.4, 2.8, 'white', top=False)
    m.cbox(3, 1.5, 0.9, 0.9, z + 0.6, z + 4.2, 'brick')


@kit('house', ao=3.5, seed=57)
def low_house_b(m):
    """L-shaped house with hip roofs."""
    z = m.facade(rect(12, 7, 0, 2), 0, 2, 3.0, 'brick', 'stone_light', bay=3.0)
    m.hip(-6, 6, -1.5, 5.5, z, 2.8, 'roof_grey', ridge=0.5, over=0.5)
    z2 = m.facade(rect(6, 6, -3, -4.5), 0, 1, 3.2, 'brick', 'stone_light', bay=3.0)
    m.hip(-6, 0, -7.5, -1.5, z2, 2.4, 'roof_grey', ridge=0.0, over=0.5)
    m.box(1.2, 2.6, -1.56, -1.5, 0, 2.3, 'wood_dark', bottom=True)
    m.cbox(4.2, 3.2, 0.9, 0.9, z + 0.4, z + 3.8, 'brick_brown')
    m.tree(4.5, -5.5, 0.7)


@kit('shop', ao=3.5, seed=58)
def low_cafe(m):
    """Corner cafe with awnings and a terrace."""
    z = m.facade(rect(14, 11, 0, 1.5), 0, 2, 3.6, 'punch', 'navy', ground='shop', gh=4.4, bay=3.5)
    m.parapet(rect(14, 11, 0, 1.5), z, 0.8, 'navy')
    m.awning(-6.5, 6.5, -4, 4.2, 2.2, 'orange', drop=0.7)
    m.box(-7, 7, -10.5, -4.2, 0, 0.25, 'wood', 'wood')
    for x in (-4.5, 0, 4.5):
        m.cyl(x, -8, 0.25, 2.5, 0.07, 4, 'steel', cap=False)
        m.cyl(x, -8, 2.3, 3.1, 1.7, 6, 'cream', r2=0)
        m.cyl(x, -8, 0.25, 1.0, 0.6, 6, 'wood_dark')
    m.text('CAFE', 1.6, 0, -4.15, z - 0.2, 'cream', depth=0.2)


# =============================================================== industrial
@kit('industrial', ao=6, seed=61)
def ind_warehouse_a(m):
    """Distribution warehouse with loading docks and an office annex."""
    z = m.facade(rect(60, 30), 0, 1, 9.5, 'corrugated', 'metal_light', bay=5)
    m.gable(-30, 30, -15, 15, z, 3.4, 'roof_grey', axis='x', over=0.5, end='metal_light', style='corrugated')
    for i in range(5):
        x = -22 + i * 9
        m.box(x - 2, x + 2, -15.15, -15, 1.2, 5.4, 'steel', bottom=True)
        m.box(x - 2.4, x + 2.4, -16.4, -15, 0, 1.2, 'concrete', 'paving')
    m.box(-25, 16, -17.5, -15, 5.9, 6.2, 'red', bottom=True)
    zz = m.facade(rect(14, 10, 23, -20), 0, 2, 3.6, 'ribbon', 'white', bay=3.5)
    m.parapet(rect(14, 10, 23, -20), zz, 0.6, 'white')


@kit('industrial', ao=6, seed=62)
def ind_warehouse_b(m):
    """Brick factory with a sawtooth roof and a chimney."""
    z = m.facade(rect(48, 34), 0, 2, 4.4, 'brick', 'brick_brown', ground='shop', bay=4.0)
    for i in range(4):
        x0 = -24 + i * 12
        m.wedge(x0, x0 + 12, -17, 17, z, 5.0, 0.2, 'roof_grey', 'roof_grey')
        m.box(x0, x0 + 0.12, -16.2, 16.2, z + 0.6, z + 4.6, 'glass_sky', bottom=True)
    m.cyl(28, 12, 0, 6, 2.6, 8, 'brick_dark', r2=2.2, cap=False)
    m.cyl(28, 12, 6, 34, 2.2, 8, 'brick', r2=1.5, col1='brick_brown')
    m.cyl(28, 12, 34, 35, 1.8, 8, 'brick_dark')


@kit('industrial', ao=4, seed=63)
def ind_containers(m):
    """Container stack: 3 rows, up to 4 high."""
    cols = ['red', 'cobalt', 'orange', 'teal', 'yellow', 'green', 'metal_light', 'brick_brown']
    L, W, H = 12.2, 2.44, 2.6
    for r in range(3):
        for c in range(4):
            n = m.rng.choice((2, 3, 3, 4, 4, 1))
            for k in range(n):
                col = m.rng.choice(cols)
                cx, cy = (c - 1.5) * (L + 0.5), (r - 1) * (W + 1.4)
                m.facade(rect(L, W, cx, cy), k * H, 1, H, 'container', col, bay=3.05)
                m.cap(rect(L, W, cx, cy), (k + 1) * H, shade(col, 0.85))
    m.poly([(-27, -6.5, 0.03), (27, -6.5, 0.03), (27, 6.5, 0.03), (-27, 6.5, 0.03)], 'asphalt')


@kit('industrial', ao=7, seed=64)
def ind_gantry(m):
    """Ship-to-shore gantry crane. The boom reaches out over the water (-Y)."""
    col, dk = 'orange', 'steel'
    for sx in (-1, 1):
        x = sx * 13
        for y in (-9, 9):
            m.cbox(x, y, 1.6, 1.6, 1.6, 42, col, top=False)
            m.cbox(x, y, 3.6, 2.2, 0, 1.6, dk)
        m.beam((x, -9, 14), (x, 9, 14), 1.2, 1.4, col)
        m.beam((x, -9, 41.3), (x, 9, 41.3), 1.4, 1.8, col)
        m.beam((x, -9, 14), (x, 9, 41), 0.8, 0.8, col)
    for y in (-9, 9):
        m.beam((-13, y, 41.3), (13, y, 41.3), 1.4, 1.8, col)
    m.beam((-13, 9, 20), (13, 9, 20), 1.0, 1.0, col)
    for x in (-5, 5):
        m.beam((x, -62, 43.4), (x, 28, 43.4), 1.2, 2.0, col)
        m.beam((x, -9, 43), (0, -9, 66), 0.9, 0.9, col)
        m.beam((x, 9, 43), (0, -9, 66), 0.9, 0.9, col)
    m.beam((0, -9, 66), (0, -58, 44.6), 0.5, 0.5, dk)
    m.beam((0, -9, 66), (0, 26, 44.6), 0.5, 0.5, dk)
    m.box(-6, 6, 12, 26, 44.4, 50, 'white', 'roof_light', bottom=True)
    m.box(-3, 3, -34, -29, 39.6, 42.4, 'white', 'roof_light', bottom=True)
    m.cyl(0, -31.5, 22, 39.6, 0.12, 4, dk, cap=False)
    m.box(-6.1, 6.1, -32.7, -30.3, 21.2, 22, 'yellow', bottom=True)


@kit('industrial', ao=7, seed=65)
def ind_silos(m):
    """Four silos with a conveyor gallery and a stair tower."""
    m.box(-15, 15, -8, 8, 0, 0.5, 'concrete', 'paving')
    for i in range(4):
        cx = -11.4 + i * 7.6
        m.cyl(cx, 0, 0.5, 24, 3.6, 10, 'metal_light', cap=False, col1='white')
        m.cyl(cx, 0, 24, 26.4, 3.6, 10, 'metal', r2=0.8)
    m.beam((-13, 0, 27.6), (13, 0, 27.6), 2.4, 2.2, 'metal')
    m.box(13, 17, -2, 2, 0, 30, 'concrete', 'roof')
    m.beam((17, 0, 28), (30, 0, 3), 1.8, 1.8, 'metal')
    m.box(28, 34, -3, 3, 0, 4, 'concrete', 'roof')


# =============================================================== props
@kit('prop', ao=3, seed=71)
def tree_round(m):
    m.tree(0, 0, 1.0, 'round')


@kit('prop', ao=3, seed=72)
def tree_tall(m):
    m.tree(0, 0, 1.0, 'tall')


@kit('prop', ao=2, seed=73)
def street_lamp(m):
    m.cyl(0, 0, 0, 0.9, 0.16, 5, 'steel', cap=False)
    m.cyl(0, 0, 0.9, 8.0, 0.09, 5, 'steel', cap=False)
    m.beam((0, 0, 7.9), (0, -1.8, 8.2), 0.1, 0.1, 'steel')
    m.box(-0.22, 0.22, -2.3, -1.5, 8.05, 8.25, 'lit', 'steel', bottom=True)


def _vehicle(m, L, W, H, body, roof=None, cab=None, glass='glass_dark', nose=0.0):
    hw = W / 2
    wr = 0.36
    m.box(-hw, hw, -L / 2, L / 2, wr * 0.9, wr * 0.9 + H * 0.42, body, bottom=True)
    c0, c1 = cab if cab else (-L * 0.2, L * 0.3)
    zb = wr * 0.9 + H * 0.42
    m.frustum([(-hw, c0), (hw, c0), (hw, c1), (-hw, c1)],
              [(-hw + 0.15, c0 + 0.5 + nose), (hw - 0.15, c0 + 0.5 + nose), (hw - 0.15, c1 - 0.35), (-hw + 0.15, c1 - 0.35)],
              zb, zb + H * 0.5, glass, top=roof or body)
    for sx in (-1, 1):
        for y in (-L / 2 + L * 0.2, L / 2 - L * 0.2):
            m.box(sx * hw - 0.12, sx * hw + 0.12, y - wr, y + wr, 0, 2 * wr, 'rubber')
    m.box(-hw + 0.1, hw - 0.1, -L / 2 - 0.03, -L / 2, 0.55, 0.75, 'lit', bottom=True)
    m.box(-hw + 0.1, hw - 0.1, L / 2, L / 2 + 0.03, 0.55, 0.75, 'red', bottom=True)


@kit('prop', ao=1.5, seed=74)
def car(m):
    _vehicle(m, 4.5, 1.8, 1.45, 'white')


@kit('prop', ao=1.5, seed=75)
def taxi(m):
    _vehicle(m, 4.6, 1.8, 1.5, 'taxi')
    m.box(-0.3, 0.3, 0.1, 0.4, 1.63, 1.83, 'lit', bottom=True)


@kit('prop', ao=2, seed=76)
def bus(m):
    L, W = 12.0, 2.55
    hw = W / 2
    m.box(-hw, hw, -L / 2, L / 2, 0.4, 1.35, 'cobalt', bottom=True)
    m.facade([(-hw, -L / 2), (hw, -L / 2), (hw, L / 2), (-hw, L / 2)], 1.35, 1, 1.35, 'ribbon', 'white', bay=1.5)
    m.box(-hw, hw, -L / 2, L / 2, 2.7, 3.05, 'white', 'white', bottom=False)
    m.box(-0.9, 0.9, -1.5, 1.5, 3.05, 3.3, 'metal_light')
    for sx in (-1, 1):
        for y in (-L / 2 + 2.4, L / 2 - 2.8):
            m.box(sx * hw - 0.14, sx * hw + 0.14, y - 0.5, y + 0.5, 0, 1.0, 'rubber')
    m.box(-hw + 0.15, hw - 0.15, -L / 2 - 0.03, -L / 2, 2.72, 3.0, 'lit', bottom=True)


@kit('prop', ao=3, ground=False, seed=77)
def pier_segment(m):
    """Timber pier, 10 m wide and 20 m long (along Y); deck at 1.6 m, piles go below the water."""
    from atlas import STYLE, ROWS, BAYS
    r = STYLE['planks']
    vb, vt = 1 - (r + 1) / ROWS + 0.001, 1 - r / ROWS - 0.001
    m.poly([(-5, -10, 1.6), (5, -10, 1.6), (5, 10, 1.6), (-5, 10, 1.6)], 'wood', [(0, vb), (0, vt), (5 / BAYS, vt), (5 / BAYS, vb)])
    m.box(-5, 5, -10, 10, 1.25, 1.6, 'wood_dark', top=False, bottom=True)
    for y in (-8, 0, 8):
        for x in (-4.3, 4.3):
            m.cyl(x, y, -5, 2.0, 0.28, 5, 'wood_dark')
    for sx in (-1, 1):
        m.beam((sx * 4.8, -10, 2.6), (sx * 4.8, 10, 2.6), 0.12, 0.12, 'white')
        for y in (-10, -5, 0, 5, 10):
            m.cbox(sx * 4.8, y * 0.99, 0.14, 0.14, 1.6, 2.6, 'white', top=False)


@kit('prop', ao=5, ground=False, seed=78)
def bridge_segment(m):
    """Road bridge span, 30 m long (along X) and 16 m wide, deck at 8 m, one pier going below the water."""
    m.box(-15, 15, -8, 8, 6.8, 8.0, 'concrete', 'asphalt', bottom=True)
    for sy in (-1, 1):
        m.box(-15, 15, sy * 8 - 0.25, sy * 8 + 0.25, 8.0, 9.1, 'stone_light', bottom=False)
        m.box(-15, 15, sy * 5.2 - 0.7, sy * 5.2 + 0.7, 5.4, 6.8, 'concrete_dark', top=False, bottom=True)
    m.box(-1.6, 1.6, -7, 7, 4.2, 5.4, 'concrete', bottom=True)
    for y in (-4.5, 4.5):
        m.cyl(0, y, -8, 4.2, 1.3, 8, 'concrete', cap=False)
    m.poly([(-15, -0.1, 8.02), (15, -0.1, 8.02), (15, 0.1, 8.02), (-15, 0.1, 8.02)], 'yellow')


def _hull(m, L, W, H, col, deck='wood'):
    hw = W / 2
    lo = [(-hw * 0.6, -L / 2 + L * 0.12), (0, -L / 2 + L * 0.05), (hw * 0.6, -L / 2 + L * 0.12), (hw * 0.7, L / 2 - 0.3), (-hw * 0.7, L / 2 - 0.3)]
    hi = [(-hw, -L / 2 + L * 0.18), (0, -L / 2), (hw, -L / 2 + L * 0.18), (hw, L / 2), (-hw, L / 2)]
    m.frustum(lo, hi, -0.5, H, col, top=deck)


@kit('prop', ao=2, ground=False, seed=79)
def boat_small(m):
    _hull(m, 8, 2.8, 0.9, 'white')
    m.frustum(rect(2.0, 2.6, 0, 0.8), rect(1.7, 2.0, 0, 1.0), 0.9, 2.3, 'glass_dark', top='white')
    m.box(-1.0, 1.0, 2.6, 3.6, 0.9, 1.5, 'cobalt', 'steel')


@kit('prop', ao=4, ground=False, seed=80)
def ferry(m):
    """Double-deck harbour ferry, 42 m long."""
    _hull(m, 42, 10, 2.6, 'navy', deck='wood')
    m.box(-5.1, 5.1, -14, 21, 2.2, 2.7, 'white', top=False)
    z = m.facade(chamfer(9, 30, 1.5, 0, 3), 2.6, 2, 2.9, 'ribbon', 'white', bay=2.6)
    m.cap(chamfer(9, 30, 1.5, 0, 3), z, 'roof_light')
    m.frustum(rect(6.5, 6, 0, -8), rect(5.5, 4.6, 0, -7.8), z, z + 2.6, 'glass_dark', top='white')
    m.cyl(0, 6, z, z + 4.6, 1.4, 8, 'red', r2=1.2, col1='red')
    m.cyl(0, 6, z + 4.6, z + 5.3, 1.25, 8, 'black')
    for sx in (-1, 1):
        for y in (0, 10):
            m.box(sx * 3.2 - 0.9, sx * 3.2 + 0.9, y, y + 4, z, z + 1.1, 'orange')


@kit('prop', ao=3, seed=81)
def park_fountain(m):
    m.cyl(0, 0, 0, 0.9, 7.0, 12, 'stone_light', cap=False)
    m.cyl(0, 0, 0.9, 0.9, 7.0, 12, 'stone_light', r2=6.3, cap=False)
    m.cyl(0, 0, 0.9, 0.55, 6.3, 12, 'stone', r2=6.3, cap=False)
    m.cap(ngon(6.3, 12), 0.55, 'water')
    m.cyl(0, 0, 0.55, 2.4, 0.7, 8, 'stone_light', cap=False)
    m.cyl(0, 0, 2.4, 2.8, 0.7, 8, 'stone_light', r2=2.4)
    m.cap(ngon(2.1, 8), 2.82, 'water')
    m.cyl(0, 0, 2.8, 4.4, 0.35, 6, 'stone_light')
    m.cyl(0, 0, 4.4, 5.6, 0.5, 6, 'sky', r2=0.05)


@kit('prop', ao=3, seed=82)
def park_pavilion(m):
    m.prism(ngon(5.6, 8, rot=math.pi / 8), 0, 0.6, 'stone', 'paving')
    for x, y in ngon(4.6, 8, rot=math.pi / 8):
        m.cyl(x, y, 0.6, 4.4, 0.22, 5, 'red', cap=False)
    m.prism(ngon(5.2, 8, rot=math.pi / 8), 4.4, 4.9, 'wood_dark', bottom=True)
    m.cyl(0, 0, 4.9, 7.6, 6.4, 8, 'roof_tile', r2=1.0, bottom=True)
    m.cyl(0, 0, 7.6, 8.8, 0.7, 6, 'gold', r2=0)
