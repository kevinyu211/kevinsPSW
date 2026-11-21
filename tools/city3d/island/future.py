"""The fifteen project buildings in the "city of tomorrow" style: a clean, optimistic future city on an island.

Each building is one or two bold, simple shapes (domes, drums, spheres, capsules, rings, discs, soft boxes),
with smooth pearl-white shells, big curved glass, thin seams and planted terraces. The district colour is an
accent: a ring, a canopy edge, a band of light, a sign. Each shape still says what the work is.
Called three times per project: L3 small, L4 full, L5 full plus extras. Front = -Y in Blender (+Z in glTF).
This file replaces the first, more traditional set in buildings.py (kept for its shared pieces).
"""
import math
from ilib import IModel, rrect, rect, ngon, shade, tint, mixc, C, disc2, star2, rrect2, cross2, capsule2, heart2, grow2, PAL, srgb
from parts2 import *
import buildings as old
from detail import *
from detail import P as _P
from buildings import set_door, row, hash_id, half_court, floodlight, globe, st_sunflower, st_duck, st_dog, st_boat, toy_duck, toy_block, tablet_easel, crescent, scooter, BEAD_COLS, TOY

PAL.update({k: srgb(v) for k, v in {'lit_pane': '#e6ae5c', 'pearl': '#f4f1e8', 'pearl_hi': '#fbf9f3', 'pearl_shade': '#dfdacd', 'seam': '#bdb8aa', 'brushed': '#b4bcc0'}.items()})
MODELS = []
P, PS = 'pearl', 'pearl_shade'


FIRST = {}          # pid -> the level-3 function: each project's modest first building


def building(pid, district, site='site_small'):
    def deco(fn):
        for L in (3, 4, 5):
            def make(L=L):
                m = IModel(f'b_{pid}_L{L}', 'building', seed=hash_id(pid) + L, smooth=62.0)
                m.meta = {'project': pid, 'district': district, 'level': L, 'site': site}
                (FIRST[pid] if L == 3 and pid in FIRST else fn)(m, L)
                assert 'door' in m.meta, pid
                return m
            MODELS.append((f'b_{pid}_L{L}', make))
        return fn
    return deco


# ------------------------------------------------------------------ shapes
def fpad(m, W, Dp, r=9.0):
    return m.pad(W, Dp, col='pave_light', r=min(r, W / 2 - 1, Dp / 2 - 1), seg=5)


def dome(m, cx, cy, z, r, h, col=P, n=28, k=7, mat='city', sy=1.0, a1=math.pi / 2, col1=None):
    """A smooth dome (half an ellipsoid r wide, h high). a1 < pi/2 stops short of the top (for an oculus)."""
    prof, cols = [], []
    for i in range(k + 1):
        a = a1 * i / k
        prof.append((r * math.cos(a) if a < math.pi / 2 - 1e-6 else 0.0, z + h * math.sin(a)))
        cols.append(mixc(shade(col, 0.9), col1 if col1 is not None else tint(col, 0.25), i / k))
    with m.use(mat):
        m.lathe(cx, cy, prof, n, cols, cap=False, sy=sy)
    return prof[-1]


def drum(m, cx, cy, z0, z1, r, col=P, n=36, mat='city', sy=1.0, r1=None, cap=None, col1=None):
    with m.use(mat):
        m.lathe(cx, cy, [(r, z0), (r if r1 is None else r1, z1)], n, [shade(col, 0.92), col1 if col1 is not None else col], cap=False, sy=sy)
    if cap is not None:
        m.cap(ngon(r if r1 is None else r1, n, cx, cy, sy=sy), z1, cap)


def gband(m, cx, cy, z0, z1, r, n=28, sy=1.0, lit=0.22, mull=2, frame=True):
    """A band of curved glass with slim mullions, a sill and a head, and a few warm lit panes."""
    with m.use('glass'):
        m.lathe(cx, cy, [(r, z0), (r, z1)], n, ['glass_b', 'glass_c'], cap=False, sy=sy)
    pts = ngon(r + 0.05, n, cx, cy, sy=sy)
    litc = C('lit_pane')
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        if m.rng.random() < lit:
            with m.use('glow'):
                m.poly([(*a, z0 + 0.25), (*b, z0 + 0.25), (*b, z1 - 0.25), (*a, z1 - 0.25)], litc)
        if mull and i % mull == 0:                   # a mullion: a slim pearl strip standing proud of the glass
            dx, dy = (b[0] - a[0]), (b[1] - a[1])
            ln = math.hypot(dx, dy) or 1.0
            ux, uy = dx / ln * 0.08, dy / ln * 0.08
            nx, ny = uy * 1.2, -ux * 1.2
            m.poly([(a[0] - ux + nx, a[1] - uy + ny, z0), (a[0] + ux + nx, a[1] + uy + ny, z0), (a[0] + ux + nx, a[1] + uy + ny, z1), (a[0] - ux + nx, a[1] - uy + ny, z1)], P)
    if frame:                                    # a sill and a head: the glass is set into the wall
        m.lathe(cx, cy, [(r + 0.18, z0 - 0.14), (r + 0.18, z0 + 0.02), (r, z0 + 0.04)], n, [shade(P, 0.85), P, P], cap=False, sy=sy)
        m.lathe(cx, cy, [(r + 0.12, z1 - 0.02), (r + 0.12, z1 + 0.14)], n, P, cap=False, sy=sy)


def halo(m, cx, cy, z, R, col, r=0.4, n=24, axis='z', spokes=4):
    """A ring of light. A level ring is carried on slim spokes from a hub at its centre (which stands on whatever
    mast or roof is below it), so it does not hang in the air."""
    with m.use('glow'):
        m.torus(cx, cy, z, R, r, n, 4, col, axis=axis)
    if axis == 'z' and spokes:
        m.cyl(cx, cy, z - 0.25, z + 0.25, max(0.18, R * 0.05), 8, 'pearl')
        for k in range(spokes):
            a = 2 * math.pi * (k + 0.5) / spokes
            m.tube([(cx, cy, z), (cx + (R - r * 0.5) * math.cos(a), cy + (R - r * 0.5) * math.sin(a), z)], max(0.07, r * 0.3), 4, 'pearl', caps=False)


def strip(m, cx, cy, z, r, col, h=0.32, n=28, sy=1.0):
    """A band of light in the district colour."""
    with m.use('glow'):
        m.lathe(cx, cy, [(r + 0.07, z), (r + 0.07, z + h)], n, col, cap=False, sy=sy)


def seam(m, cx, cy, z, r, n=28, sy=1.0, col='seam'):
    m.lathe(cx, cy, [(r + 0.035, z - 0.05), (r + 0.035, z + 0.05)], n, col, cap=False, sy=sy)


def disc(m, cx, cy, z, r, th=0.7, col=P, n=28, sy=1.0, top=None):
    """A thin round slab with a soft edge (roofs, canopies, terraces)."""
    m.lathe(cx, cy, [(r - th * 0.7, z), (r, z + th * 0.45), (r - th * 0.5, z + th)], n, [shade(col, 0.82), col, tint(col, 0.2)], cap=False, sy=sy)
    m.cap(ngon(r - th * 0.5, n, cx, cy, sy=sy), z + th, top if top is not None else tint(col, 0.2))
    m.cap(ngon(r - th * 0.7, n, cx, cy, sy=sy), z, shade(col, 0.75), up=False)


def soft(m, cx, cy, w, d, z0, z1, col=P, r=2.0, top=None, seg=4):
    """A soft-cornered box."""
    m.rbox(cx, cy, w, d, z0, z1, col, r=r, seg=seg, bev=min(0.9, r * 0.45), top=top if top is not None else tint(col, 0.2), bottom=z0 > 0.2)


def portal(m, x, y, D, rz=0.0, w=3.0, h=3.3, name=None, size=0.85):
    """A glass entrance in a soft frame, with a slim canopy and a line of light in the district colour."""
    with m.at(x, y, 0, rz):
        m.rbox(0, 0.5, w + 1.5, 2.2, 0, h + 0.8, P, r=0.6, seg=2, bev=0.3)
        hd = min(h, 2.3)                         # the doors themselves are door-sized; above them is a fixed light of glass
        m.door(0, min(w, 2.4), hd, col='pearl_hi', glass=0.92, double=True, y=-0.6, fw=0.1, dep=0.05, pane='glass_b', knob=None)
        with m.use('glass'):
            if h - hd > 0.4:
                m.fq(-min(w, 2.4) / 2, min(w, 2.4) / 2, hd + 0.2, h, -0.63, 'glass_c')
            for sx in (-1, 1):
                if w > 2.8:
                    m.fq(min(sx * 1.3, sx * w / 2), max(sx * 1.3, sx * w / 2), 0.15, h, -0.63, 'glass_b')
        m.box(-w / 2 - 0.4, w / 2 + 0.4, -1.7, -0.6, 0.0, 0.07, 'pave_light')          # the threshold
        m.rbox(0, -1.7, w + 2.6, 2.8, h + 0.8, h + 1.05, P, r=1.3, seg=3, bottom=True)
        for sx in (-1, 1):                       # the canopy's two posts
            m.cyl(sx * (w / 2 + 0.85), -2.75, 0, 0.12, 0.2, 5, 'plinth', cap=False)
            m.cyl(sx * (w / 2 + 0.85), -2.75, 0.12, h + 0.8, 0.08, 5, 'pale_metal', cap=False)
        with m.use('glow'):
            m.box(-w / 2 - 0.9, w / 2 + 0.9, -3.12, -3.05, h + 0.82, h + 1.03, D, top=False)
        if name:
            bw, bh = m.sign(name, 0, h + 1.35, size, col='trim', board=D, y=-0.5, t=0.25, r=0.4)
            for sx in (-1, 1):                   # the name board stands on the canopy
                m.box(sx * bw * 0.3 - 0.06, sx * bw * 0.3 + 0.06, -0.7, -0.5, h + 1.05, h + 1.6, 'pale_metal', top=False)


def totem(m, x, y, text, D, rz=0.0, size=0.9, h=1.6):
    """A free-standing name sign: a slim rounded plate with lit letters."""
    with m.at(x, y, 0, rz):
        m.cyl(0, 0.15, 0, h, 0.12, 6, PS, cap=False)
        m.sign(text, 0, h, size, col='trim', board=D, y=0.0, t=0.3, r=0.45)


def lamp(m, x, y, h=5.0, z=0.0):
    lamp_post(m, x, y, min(h, 6.0), z)


def bowl(m, x, y, r=1.5, z=0.0, plant='leaf', flowers=None):
    m.lathe(x, y, [(r * 0.6, z), (r, z + 0.7), (r * 0.9, z + 0.7)], 12, [PS, P, 'soil'], cap=True)
    m.blob(x, y, z + 0.95, r * 0.8, plant, n=8, rings=4, sz=0.7)
    if flowers:
        m.ball(x + r * 0.3, y - r * 0.2, z + 1.35, r * 0.28, flowers, n=6, rings=3)


def garden(m, cx, cy, z, r, n=4, sy=1.0, trees=True):
    """A planted roof."""
    m.cap(ngon(r, 24, cx, cy, sy=sy), z + 0.04, 'grass_g')
    for i in range(n):
        a = 2 * math.pi * i / n + 0.6
        bx, by = cx + r * 0.6 * math.cos(a), cy + r * 0.6 * sy * math.sin(a)
        if trees and i % 2 == 0:
            m.tree(bx, by, 0.5, 'round', z=z)
        else:
            m.bush(bx, by, 1.0 + 0.2 * (i % 2), z=z)


def street(m, W, Dp, L, trees=True, bikes=None):
    """Street furniture along the plot's front edge: lamps, a tree or two in the back corners, a bench, bike hoops."""
    for sx in ((-1, 1) if L > 3 else (1,)):
        lamp(m, sx * (W / 2 - 3), -Dp / 2 + 3)
    if trees:
        m.tree(W / 2 - 4.5, Dp / 2 - 4.5, 0.9 if L > 3 else 0.7)
        if L > 3:
            m.tree(-W / 2 + 4.5, Dp / 2 - 4.5, 1.0, 'tall')
    if L > 3:
        seat(m, -W / 2 + 7, -Dp / 2 + 3.2, 0.0, 2.4)
    if bikes is not None:
        bike_hoops(m, bikes[0], bikes[1], 4 if L > 3 else 3)


def round_win(m, x, z, r, y=0.0, col=None):
    """A porthole window: a pearl frame round a glass disc with a slim cross bar."""
    m.plate(disc2(x, z, r + 0.22, 14), y, 0.16, P)
    with m.use('glass'):
        m.poly([(px, y - 0.2, pz) for px, pz in disc2(x, z, r, 14)], 'glass_b')
    m.fq(x - r, x + r, z - 0.05, z + 0.05, y - 0.23, P)
    m.fq(x - 0.05, x + 0.05, z - r, z + r, y - 0.23, P)


# ================================================================== SOFTWARE (red)
def glass_tower(m, cx, cy, R, z0, floors, fh, D, n=24, lit=0.12, fins=6, bulge=0.04):
    """A round glass office tower: a floor line at every slab, pearl fins, a few lit panes. Returns the roof level."""
    H = z0 + floors * fh
    prof = lambda z: R * (1 + bulge * math.sin(math.pi * (z - z0) / max(1.0, H - z0)))
    zs = [z0 + (H - z0) * t / max(2, floors // 3) for t in range(max(2, floors // 3) + 1)]
    with m.use('glass'):
        m.lathe(cx, cy, [(prof(z), z) for z in zs], n, [mixc('glass_b', 'glass_c', (z - z0) / (H - z0)) for z in zs], cap=False)
    for f in range(floors + 1):
        za = z0 + f * fh
        m.lathe(cx, cy, [(prof(za) + 0.08, za - 0.18), (prof(za) + 0.08, za + 0.22)], n, P, cap=False)        # the slab edge
        if f == floors:
            break
        zb = za + fh
        for i in range(n):
            if m.rng.random() < lit:
                a0, a1 = 2 * math.pi * (i + 0.12) / n, 2 * math.pi * (i + 0.88) / n
                r_ = prof(za + fh / 2) + 0.04
                with m.use('glow'):
                    m.poly([(cx + r_ * math.cos(a0), cy + r_ * math.sin(a0), za + 0.5), (cx + r_ * math.cos(a1), cy + r_ * math.sin(a1), za + 0.5),
                            (cx + r_ * math.cos(a1), cy + r_ * math.sin(a1), zb - 0.45), (cx + r_ * math.cos(a0), cy + r_ * math.sin(a0), zb - 0.45)], 'lit_pane')
    for k in range(fins):
        a = math.pi / fins + k * 2 * math.pi / fins
        zf = [z0 + (H - z0) * t for t in (0.0, 0.33, 0.67, 1.0)]
        m.tube([(cx + (prof(z) + 0.12) * math.cos(a), cy + (prof(z) + 0.12) * math.sin(a), z) for z in zf], 0.22, 4, P, caps=False)
    return H


@building('hirvo', 'software', site='site_large')
def b_hirvo(m, L):
    """Careers office: a slim round glass tower crowned by a sky lounge and a halo ring, on a round glass podium with a
    roof garden. Job search for international students: a globe and flags of many colours at L5."""
    D = 'd_software'
    W, Dp = {3: (36, 30), 4: (62, 50), 5: (72, 56)}[L]
    ph = fpad(m, W, Dp)
    m.push(0, 0, ph)
    R, floors = (6.5, 3) if L == 3 else (10.5, 13 if L == 4 else 16)
    cx, cy = (0, 2) if L == 3 else (-9, 4)
    fh = 3.8
    LOB = 5.2                                    # the double-height lobby
    avoid = [(cx, cy, R + 0.6)]
    if L > 3:
        px, py, PRd = 8.5, 3.0, 18.5
        plinth_ring(m, px, py, PRd, 40)
        gband(m, px, py, 0.9, 5.0, PRd + 0.02, n=40, lit=0.25)
        m.lathe(px, py, [(PRd, 5.0), (PRd, 6.6)], 40, P, cap=False)
        strip(m, px, py, 5.55, PRd, D, 0.3, n=40)
        disc(m, px, py, 6.6, PRd + 1.4, 0.9, n=40)
        zr = 7.5
        # the roof garden: lawn, planted beds, trees, benches, a railing round the edge, a skylight over the hall
        m.cap(ngon(PRd - 1.2, 40, px, py), zr + 0.03, 'pave_light')
        garden(m, px + 6, py + 1, zr, 7.5 if L == 5 else 6.0, 5 if L == 5 else 3)
        rail_ring_clear(m, px, py, zr, PRd + 0.7, 40, avoid=avoid)
        with clear(m):
            m.lathe(px - 4, py - 9.5, [(3.2, zr), (2.2, zr + 1.0), (0.0, zr + 1.4)], 12, ['glass_c', 'glass_b', 'glass_c'], cap=False)
        m.lathe(px - 4, py - 9.5, [(3.35, zr - 0.05), (3.35, zr + 0.2), (3.2, zr + 0.2)], 12, P, cap=False)
        for k in range(3):
            seat(m, px + 1 + k * 4.5, py - 12.5 + k * 1.2, -0.25 + k * 0.25, 2.2, z=zr)
        if L == 4:
            roof_kit(m, px + 12, py + 9, zr, 0.9, rz=0.7)
        # a second way in on the podium's front, under the overhang
        portal(m, px + 8, py - PRd * 0.92, D, w=2.6)
    # the tower: a stone plinth, a glazed double-height lobby, floors of glass with slab edges and pearl fins
    plinth_ring(m, cx, cy, R, 28)
    gband(m, cx, cy, 0.45, LOB - 0.6, R, n=28, lit=0.3, mull=1)
    m.lathe(cx, cy, [(R, LOB - 0.6), (R, LOB)], 28, P, cap=False)
    H = glass_tower(m, cx, cy, R, LOB, floors, fh, D, lit=0.1 if L > 3 else 0.15)
    # the sky lounge: a terrace with a railing round a smaller glass room, its roof carrying the halo
    disc(m, cx, cy, H, R + 1.2, 0.7)
    zt = H + 0.7
    rl = R * 0.62
    rail_ring(m, cx, cy, zt, R + 0.8, n=28)
    gband(m, cx, cy, zt, zt + 3.4, rl, n=20, lit=0.35, mull=1)
    disc(m, cx, cy, zt + 3.4, rl + 1.0, 0.6, n=20)
    zr2 = zt + 4.0
    roof_kit(m, cx + rl * 0.25, cy + rl * 0.3, zr2, 0.7 if L > 3 else 0.55, rz=0.4, vents=1)
    hz = zr2 + (4.2 if L > 3 else 3.0)
    m.cyl(cx, cy, zr2, hz + 0.3, 0.35 if L > 3 else 0.25, 8, P, cap=True)                    # the mast
    halo(m, cx, cy, hz, R + (2.2 if L > 3 else 1.2), D, r=0.45 if L > 3 else 0.3)
    for k in range(4):                                                                         # stays from the roof to the ring
        a = math.pi / 4 + k * math.pi / 2
        m.tube([(cx + rl * 0.8 * math.cos(a), cy + rl * 0.8 * math.sin(a), zr2), (cx + (R + 2.0) * 0.98 * math.cos(a), cy + (R + 2.0) * 0.98 * math.sin(a), hz)], 0.07, 4, 'pale_metal', caps=False) if L > 3 else None
    m.cyl(cx, cy, hz + 0.3, hz + 5.0, 0.08, 5, 'pale_metal', cap=False)
    with m.use('glow'):
        m.ball(cx, cy, hz + 5.1, 0.18, 't_red', n=5, rings=3)
    if L == 5:                                                                                 # a second, smaller ring
        halo(m, cx, cy, hz + 2.4, R * 0.7, 'lamp', r=0.25, n=16, spokes=4)
    # the way in: the entrance, a paved walk from the street, a sign, bike hoops
    portal(m, cx, cy - R - 0.2, D, name='Hirvo', size=1.0 if L > 3 else 0.8)
    set_door(m, cx, -Dp / 2)
    paving(m, cx - 2.6, cx + 2.6, -Dp / 2 + 0.3, cy - R - 3.6, 0.0, col='pave', band='pave_dark', every=2.2)
    page_icon(m, cx + R * 0.55 + 3.2, 3.1, cy - R - 4.2, 2.0, 2.6)
    for sx in (-0.6, 0.6):
        m.cyl(cx + R * 0.55 + 3.2 + sx, cy - R - 4.1, 0, 3.1, 0.06, 5, 'pale_metal', cap=False)
    bike_hoops(m, cx - 5.5, cy - R - 5.0, 4 if L > 3 else 3)
    if L > 3:
        planter_tree(m, cx - R - 3.0, cy - R + 0.5, 0.75, 1.3)
        bowl(m, cx + R + 2.0, cy - R + 3.0, 1.4, flowers='flower_red')
        round_paving(m, px + 8, py - PRd - 4.0, 4.0, 0.0, n=20, rings=(0.5,), spokes=6)
    if L == 5:
        # the welcome dome: a glass dome on a ring beam and plinth, for new arrivals; a plaza with a fountain;
        # flags of many colours; the globe
        gx, gy, gr = -W / 2 + 10, Dp / 2 - 12, 6.5
        plinth_ring(m, gx, gy, gr, 24, h=0.5)
        gband(m, gx, gy, 0.5, 3.0, gr, n=24, lit=0.3, mull=1)
        ring_beam(m, gx, gy, 3.5, gr, 24, h=0.5)
        dome(m, gx, gy, 3.5, gr, 4.6, mat='glass', col='glass_b', col1='glass_c', n=24, k=6)
        for k in range(6):
            a = k * math.pi / 3
            pts = [(gx + (gr + 0.05) * math.cos(b) * math.cos(a), gy + (gr + 0.05) * math.cos(b) * math.sin(a), 3.5 + (4.6 + 0.05) * math.sin(b)) for b in [math.pi / 2 * i / 4 for i in range(5)]]
            m.tube(pts, 0.1, 3, P, caps=False)
        strip(m, gx, gy, 3.05, gr + 0.2, D, 0.3, n=24)
        portal(m, gx, gy - gr - 0.2, D, w=2.4)
        globe(m, W / 2 - 9, -Dp / 2 + 9, 0, 2.2)
        round_paving(m, -W / 2 + 12, -Dp / 2 + 10, 6.0, 0.0, n=24, rings=(0.6,), spokes=8)
        fountain_pool(m, -W / 2 + 12, -Dp / 2 + 10, 3.2, 0.0)
        flag_row(m, W / 2 - 19, -Dp / 2 + 3.5, (D, 't_blue', 't_yel', 't_green', 't_purple'), 9.0, 2.6)
        for k in range(4):
            lamp(m, px - 6 + k * 7, py - PRd - 2.5)
    street(m, W, Dp, L)
    m.pop()


def pod_box(m, cx, cy, z, col, L=6.0, w=2.5, h=2.6, rz=0.0, band=None):
    """A cargo pod: a container with soft corners and a coloured band."""
    with m.at(cx, cy, z, rz):
        m.rbox(0, 0, L, w, 0.05, h, col, r=0.5, seg=2, bev=0.25)
        if band:
            m.rbox(0, 0, L * 0.3, w + 0.06, 0.3, h - 0.3, band, r=0.5, seg=2, top=False)


@building('trade', 'software', site='site_large')
def b_trade(m, L):
    """Harbour hall on the coast: a long smooth vault, sleek quay cranes, cargo pods, piers. Export risk checks.
    The sea is behind the building (+y in Blender, -z in glTF). No client name anywhere."""
    D = 'd_software'
    m.ground_z = None
    m.ao_cell = 6.5
    W = {3: 44, 4: 74, 5: 76}[L]
    front, quay = ({3: -17, 4: -24, 5: -26}[L], {3: 22, 4: 34, 5: 36}[L])
    ph = m.pad(W, quay - front, cy=(front + quay) / 2, skirt=9.0, col='pave_light', r=6, seg=4)
    set_door(m, 0, front)
    m.meta['quayEdge'] = round(-quay, 1)
    m.push(0, 0, ph)
    sw, sd, rh = (30, 16, 10.0) if L == 3 else (58, 26, 15.0)
    x0, x1, y0, y1 = -sw / 2, sw / 2, -sd / 2, sd / 2
    # one smooth shell from the ground up, glazed ends, a red line of light along the foot
    Pv = m.vault(x0, x1, y0, y1, 0.0, rh, P, axis='x', n=16, over=1.2, end=None, th=0.5, ribs=0)
    for sx in (-1, 1):
        xx = sx * (sw / 2 - 0.4)
        pts = [(xx, y * 0.96, z * 0.96) for y, z in Pv]
        with m.use('glass'):
            m.poly(pts if sx < 0 else pts[::-1], 'glass_b')
        for k in (4, 8, 12):
            m.beam((xx + sx * 0.1, Pv[k][0] * 0.96, 0), (xx + sx * 0.1, Pv[k][0] * 0.96, Pv[k][1] * 0.96), 0.2, 0.2, P)
    for k in range(1, 6 if L > 3 else 3):
        rx = x0 + sw * k / (6 if L > 3 else 3)
        for i in range(16):
            (ya, za), (yb, zb) = Pv[i], Pv[i + 1]
            m.poly([(rx - 0.06, ya * 1.004, za * 1.004 + 0.03), (rx + 0.06, ya * 1.004, za * 1.004 + 0.03), (rx + 0.06, yb * 1.004, zb * 1.004 + 0.03), (rx - 0.06, yb * 1.004, zb * 1.004 + 0.03)], 'seam')
    with m.use('glow'):
        m.box(x0 + 1, x1 - 1, y0 - 0.25, y0 - 0.1, 0.5, 0.9, D, top=False)
    # the shell's feet: a stone plinth with a drainage channel along each long side
    for yy, sg in ((Pv[0][0], -1), (Pv[-1][0], 1)):
        m.box(x0 - 0.3, x1 + 0.3, min(yy, yy + sg * 0.9), max(yy, yy + sg * 0.9), 0, 0.4, 'plinth', top='kerb')
        m.box(x0 - 0.3, x1 + 0.3, min(yy + sg * 0.9, yy + sg * 1.4), max(yy + sg * 0.9, yy + sg * 1.4), 0, 0.03, 'iron')
    # a glazed strip along the crown of the roof, with vent cowls
    kk = len(Pv) // 2
    with m.use('glass'):
        for i in range(kk - 2, kk + 2):
            (ya, za), (yb, zb) = Pv[i], Pv[i + 1]
            m.poly([(x0 + 3, ya * 1.01, za + 0.08), (x1 - 3, ya * 1.01, za + 0.08), (x1 - 3, yb * 1.01, zb + 0.08), (x0 + 3, yb * 1.01, zb + 0.08)][::-1], 'glass_c')
    for i in range(kk - 2, kk + 3):
        ya, za = Pv[i]
        m.beam((x0 + 3, ya * 1.01, za + 0.1), (x1 - 3, ya * 1.01, za + 0.1), 0.12, 0.12, P)
    for vx in row(3 if L > 3 else 2, sw - 16):
        vy, vz = Pv[kk - 3]
        m.cyl(vx, vy, vz - 0.3, vz + 1.0, 0.45, 8, 'brushed', cap=False)
        m.cyl(vx, vy, vz + 1.0, vz + 1.4, 0.75, 8, 'brushed', r2=0.2)
    nd = 2 if L == 3 else 4
    for dx in row(nd, sw - 8):
        with m.at(dx, y0 + 0.35, 0):
            m.rbox(0, 0.6, 7.0, 2.4, 0, 6.4, P, r=0.8, seg=3, bev=0.4)
            m.fq(-2.8, 2.8, 0, 5.2, -0.62, 'brushed')
            for k in range(4):
                m.fq(-2.8, 2.8, 1.0 + k * 1.1, 1.06 + k * 1.1, -0.64, 'seam')
    portal(m, 0, y0 - 0.3, D, w=2.4, name='HARBOUR', size=0.8)
    paving(m, -2.6, 2.6, front + 0.3, y0 - 3.4, 0.0, every=2.2)
    bike_hoops(m, 5.0, y0 - 5.0, 3)
    check_shield(m, sw / 2 - 5.0 if L > 3 else 9.0, 8.2 if L > 3 else 6.5, y0 + 2.2, 2.6, D)
    m.box(-W / 2 + 3, W / 2 - 3, quay - 1.0, quay - 0.5, 0, 0.06, 'hazard')
    for bx in row(6 if L > 3 else 4, W - 10):
        bollard(m, bx, quay - 1.8, col='brushed')
    cc = [D, 'pearl_shade', 'steel_light', 't_orange', 'pearl_shade']
    rng = m.rng

    def stack(cx, cy, nx, nz):
        for i in range(nx):
            for k in range(nz - (1 if i == nx - 1 and nz > 1 else 0)):
                pod_box(m, cx, cy + (i - (nx - 1) / 2) * 2.8, k * 2.62, P, 6.2, rz=0.0, band=rng.choice(cc))
    if L == 3:
        stack(-13, sd / 2 + 6, 2, 2)
        quay_crane(m, 6, quay - 7.5, 0, s=0.62, col=P, boom=20)
        piers = [(-13, 34)]
    else:
        stack(-W / 2 + 8, sd / 2 + 9, 3, 3)
        stack(-W / 2 + 15, sd / 2 + 9, 3, 2)
        stack(W / 2 - 8, sd / 2 + 9, 3, 3)
        if L == 5:
            stack(W / 2 - 15, sd / 2 + 9, 2, 2)
        quay_crane(m, -11, quay - 7.0, 0, s=0.92, col=P, boom=25)
        quay_crane(m, 11, quay - 7.0, 0, s=0.92, col=P, boom=25)
        for ry in (quay - 7.0 - 4.14, quay - 7.0 + 4.14):          # the cranes run on rails set into the quay
            m.box(-W / 2 + 6, W / 2 - 6, ry - 0.15, ry + 0.15, 0, 0.05, 'iron')
        piers = [(-30, 46), (30, 46)] if L == 4 else [(-31, 56), (31, 46)]
    for px, pl in piers:
        pw = 8.0
        m.box(px - pw / 2, px + pw / 2, quay - 0.5, quay + pl, -0.75, 0.05, P, bottom=True)
        for k in range(int(pl // 9) + 1):
            for sx in (-1, 1):
                m.cyl(px + sx * (pw / 2 - 0.7), min(quay + 3 + k * 9, quay + pl - 1), -9.5, -0.75, 0.5, 6, PS, cap=False)
        with m.use('glow'):
            m.box(px - pw / 2 + 0.2, px - pw / 2 + 0.4, quay, quay + pl - 0.5, 0.05, 0.12, D)
            m.box(px + pw / 2 - 0.4, px + pw / 2 - 0.2, quay, quay + pl - 0.5, 0.05, 0.12, D)
        lamp(m, px, quay + pl - 1.2, 4.5, z=0.05)
        for k in range(1, int(pl // 8) + 1):                     # bollards along both edges for mooring lines
            for sx in (-1, 1):
                bollard(m, px + sx * (pw / 2 - 0.5), quay + k * 8 - 2, 0.05, 0.7, col='brushed')
        m.box(px - pw / 2, px + pw / 2, quay + pl - 0.25, quay + pl, 0.05, 0.25, 'rubber')
    if L == 5:
        ox, oy = W / 2 - 9, y0 - 3
        drum(m, ox, oy, 0, 5.0, 5.0, n=20)
        gband(m, ox, oy, 1.0, 4.2, 5.03, n=20)
        m.cyl(ox, oy, 5.0, 11.0, 1.1, 10, P, cap=False)
        drum(m, ox, oy, 11.0, 13.4, 3.4, n=20, mat='glass', col='glass_b', col1='glass_c')
        disc(m, ox, oy, 13.4, 4.2, 0.7, n=20)
        disc(m, ox, oy, 10.4, 4.0, 0.6, n=20)
        rail_ring(m, ox, oy, 11.0, 3.75, n=16)
        strip(m, ox, oy, 13.5, 4.0, D, 0.25, n=20)
        plinth_ring(m, ox, oy, 5.0, 20)
        portal(m, ox, oy - 5.1, D, w=2.2)
        m.cyl(ox, oy, 14.1, 17.5, 0.08, 4, P, cap=False)
        with m.use('glow'):
            m.ball(ox, oy, 17.6, 0.2, 't_red', n=5, rings=3)
        flag_row(m, -W / 2 + 6, front + 3.0, (D, 't_blue', 't_yel', 't_teal'), 9.0, 2.6)
    truck(m, -10 if L > 3 else 8, front + 5, 0, 0.0, col=P, load='box')
    for lx in ((-W / 2 + 4, W / 2 - 4) if L > 3 else (W / 2 - 4,)):
        lamp(m, lx, front + 3.5, 7)
    m.pop()


@building('court', 'software', site='site_large')
def b_court(m, L):
    """Sports arena: a smooth shell dome, with glowing outdoor half-courts marked A, B, C. A court-booking mini program."""
    D = 'd_software'
    W, Dp = {3: (38, 46), 4: (62, 58), 5: (74, 58)}[L]
    ph = fpad(m, W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    R, hh = (10.0, 7.5) if L == 3 else (15.5, 11.0)
    cx = 0 if L < 5 else -6
    cy = Dp / 2 - R - 3.5
    drum(m, cx, cy, 0, 1.0, R + 0.5, n=32)
    gband(m, cx, cy, 1.0, 4.0, R, n=32, lit=0.3)
    plinth_ring(m, cx, cy, R + 0.5, 32, h=0.35)
    ring_beam(m, cx, cy, 4.3, R + 0.4, 32, h=0.35, out=0.3)
    strip(m, cx, cy, 3.95, R + 0.7, D, 0.25, n=32)
    dome(m, cx, cy, 4.3, R + 0.5, hh - 4.3, n=32, k=7, a1=math.pi / 2 * 0.86)
    zt = 4.3 + (hh - 4.3) * math.sin(math.pi / 2 * 0.86)
    rt = (R + 0.5) * math.cos(math.pi / 2 * 0.86)
    lip(m, cx, cy, zt + 0.1, rt, 32, out=0.25, h=0.3)                       # the curb round the roof light
    dome(m, cx, cy, zt + 0.2, rt, rt * 0.3, mat='glass', col='glass_b', col1='glass_c', n=32, k=3)
    roof_kit(m, cx + R * 0.55, cy + R * 0.45, 4.3 + (hh - 4.3) * 0.62, 0.8, rz=-0.8, hatch=False, vents=1) if False else None
    for k in range(8):
        a = k * math.pi / 4 + 0.2
        seam_pts = [((R + 0.55) * math.cos(b) * math.cos(a), (R + 0.55) * math.cos(b) * math.sin(a), 4.3 + (hh - 4.3) * math.sin(b)) for b in [math.pi / 2 * 0.86 * i / 6 for i in range(7)]]
        for i in range(6):
            m.beam((cx + seam_pts[i][0], cy + seam_pts[i][1], seam_pts[i][2]), (cx + seam_pts[i + 1][0], cy + seam_pts[i + 1][1], seam_pts[i + 1][2]), 0.12, 0.06, 'seam')
    cw, cd = 14.0, 13.0
    ccy = cy - R - cd / 2 - 4.6
    letters = ['A'] if L == 3 else ['A', 'B', 'C']
    gap = 3.4
    tot = len(letters) * cw + (len(letters) - 1) * gap
    cxs = [(-tot / 2 + cw / 2 + i * (cw + gap)) for i in range(len(letters))]
    if L == 3:
        cxs = [-W / 2 + cw / 2 + 3.5]
    # the way in runs between courts A and B (or beside A) to a door on the dome's side, facing it
    wx = 0.0 if L == 3 else -(cw + gap) / 2
    ang = math.atan2(-math.sqrt(max(1.0, (R + 0.3) ** 2 - (wx - cx) ** 2)), wx - cx)
    portal(m, cx + (R + 0.3) * math.cos(ang), cy + (R + 0.3) * math.sin(ang), D, rz=ang + math.pi / 2, name='COURTS', w=3.4)
    fy0_ = ccy - cd / 2 - 2.0
    paving(m, -2.2, 2.2, -Dp / 2 + 0.3, fy0_ - 0.6, 0.0, every=2.2)
    paving(m, min(wx, 0) - 2.2, max(wx, 0) + 2.2, fy0_ - 2.8, fy0_ - 0.6, 0.0, every=2.4, along='x', edge=None)
    paving(m, wx - 1.5, wx + 1.5, fy0_ - 0.6, cy + (R + 0.3) * math.sin(ang) - 3.0, 0.0, every=2.2)
    for cxx, let, cc in zip(cxs, letters, ['court_red', 'court_blue', 'court_red']):
        half_court(m, cxx, ccy, cw, cd, cc, let)
        # a ball-stop fence: tall clear panels on posts, open at the front corner as a gate
        fx_, fy_ = cw / 2 + 0.7, cd / 2 + 0.7
        pts = [(cxx - fx_ + 2.0, ccy - fy_), (cxx - fx_, ccy - fy_), (cxx - fx_, ccy + fy_), (cxx + fx_, ccy + fy_), (cxx + fx_, ccy - fy_), (cxx + fx_ - 2.0, ccy - fy_)]
        rail_line(m, pts, 0.0, 3.0, post=99)
        for p_ in pts:
            m.cyl(p_[0], p_[1], 0, 3.0, 0.07, 5, 'pale_metal', cap=False)
        seat(m, cxx, ccy + fy_ + 1.0, math.pi, 3.0, back=False) if L > 3 else None
        with m.use('glow'):
            m.box(cxx - cw / 2 - 0.9, cxx + cw / 2 + 0.9, ccy - cd / 2 - 1.1, ccy - cd / 2 - 0.9, 0.14, 0.22, D)
    fx0, fx1 = cxs[0] - cw / 2 - 2.0, cxs[-1] + cw / 2 + 2.0
    fy0 = ccy - cd / 2 - 2.0
    floodlight(m, fx0 + 0.3, fy0 + 0.3, 11, math.pi * 0.75 + math.pi)
    floodlight(m, fx1 - 0.3, fy0 + 0.3, 11, -math.pi * 0.75 + math.pi)
    bxp, byp = (cx + R + 3.5, cy - R * 0.6)
    m.cyl(bxp, byp, 0, 0.5, 1.5, 10, PS)
    m.ball(bxp, byp, 2.3, 1.9, shade('t_orange', 0.85), n=12, rings=7, col1='t_orange')
    m.torus(bxp, byp, 2.3, 1.93, 0.06, 14, 3, 'iron', axis='z')
    m.torus(bxp, byp, 2.3, 1.93, 0.06, 14, 3, 'iron', axis='x')
    if L == 5:
        ax, ay = W / 2 - 11, cy + 2
        drum(m, ax, ay, 0, 5.0, 8.0, n=24)
        gband(m, ax, ay, 1.0, 4.2, 8.03, n=24)
        disc(m, ax, ay, 5.0, 9.2, 0.8, n=24)
        garden(m, ax, ay, 5.8, 6.5, 4)
        rail_ring(m, ax, ay, 5.8, 8.7, n=24)
        plinth_ring(m, ax, ay, 8.0, 24, h=0.35)
        strip(m, ax, ay, 4.5, 8.05, D, n=24)
        portal(m, ax, ay - 8.0, D, w=2.4)
        umbrella_table(m, ax - 4, ay - 12, 0, col=D)
        for i, fc in enumerate((D, 't_blue', 't_yel')):
            m.flag(-W / 2 + 4 + i * 3, -Dp / 2 + 3.5, 10, fc)
        for k in range(4):                       # a little stand: four tiers of seats, a railing along the back
            m.box(fx1 + 1.0 + k * 1.0, fx1 + 2.05 + k * 1.0, fy0 + 3, ccy + cd / 2, 0, 0.45 + k * 0.45, P, top=PS)
        rail_line(m, [(fx1 + 4.95, fy0 + 3), (fx1 + 4.95, ccy + cd / 2)], 1.8)
    street(m, W, Dp, L)
    m.pop()


@building('uhome', 'software', site='site_large')
def b_uhome(m, L):
    """Apartment show home: stacked rounded apartment pods with planted balconies and a glass show-home entrance."""
    D = 'd_software'
    W, Dp = {3: (36, 30), 4: (56, 42), 5: (66, 48)}[L]
    ph = fpad(m, W, Dp)
    m.push(0, 0, ph)
    stacks = {3: [2, 3], 4: [4, 6, 8], 5: [4, 6, 8, 9]}[L]
    pw, pd, phh = 10.5, 12.0, 3.7
    tot = pw * len(stacks) + 1.2 * (len(stacks) - 1)
    bx0 = -tot / 2 + (0 if L < 5 else 2)
    cy = 4.0
    for i, n in enumerate(stacks):
        cx = bx0 + pw / 2 + i * (pw + 1.2)
        m.cbox(cx, cy + 2.5, 4.0, 5.0, 0, n * phh + 0.2, PS, top=False)                        # the core the pods plug into
        for f in range(n):
            z = 0.3 + f * phh
            off = -1.2 if f % 2 == 0 else 0.0
            soft(m, cx, cy + off, pw, pd, z, z + phh - 0.45, P, r=2.2, seg=2)
            if f:                                                                                # the slab between two pods, set back
                m.rbox(cx, cy - 0.6, pw - 1.6, pd - 2.0, z - 0.47, z, 'seam', r=1.4, seg=1, top=False)
            with m.side('front', cx - pw / 2, cx + pw / 2, cy + off - pd / 2, cy + off + pd / 2, z) as Lw:
                lit = m.rng.random() < 0.25
                with m.use('glow' if lit else 'glass'):
                    m.plate(rrect2(0, (phh - 0.45) / 2, Lw - 3.2, phh - 1.5, 0.7, 2), 0.0, 0.12, 'lit_pane' if lit else 'glass_b', edge=P)
                m.fq(-0.05, 0.05, 0.75, phh - 1.2, -0.14, P)
            if f % 2 == 0 and f < n - 1:
                # the pod below sticks out 1.2 m: a balcony for the flat above, with a railing and a planter
                zb_ = z + phh - 0.45
                yb_ = cy + off - pd / 2 + 0.25
                rail_line(m, [(cx - pw / 2 + 1.6, yb_ + 1.1), (cx - pw / 2 + 0.9, yb_), (cx + pw / 2 - 0.9, yb_), (cx + pw / 2 - 1.6, yb_ + 1.1)], zb_)
                m.rbox(cx - 2.8, yb_ + 0.6, 1.8, 0.6, zb_, zb_ + 0.45, PS, r=0.2, seg=1, top='soil')
                m.bush(cx - 2.8, yb_ + 0.6, 0.55, z=zb_ + 0.4)
            with m.side('back', cx - pw / 2, cx + pw / 2, cy + off - pd / 2, cy + off + pd / 2, z) as Lw:
                with m.use('glow'):
                    m.poly([(x_, -0.03, z_) for x_, z_ in rrect2(0, (phh - 0.45) / 2, Lw - 5.5, phh - 2.0, 0.5, 1)], 'pane')
        zt = 0.3 + n * phh - 0.45
        if i == len(stacks) - 1:
            disc(m, cx, cy, zt + 1.6, 7.5, 0.7, n=24)
            columns(m, cx, cy, zt, zt + 1.6, 3.2, 4, rr=0.16, a0=math.pi / 4)
            m.cyl(cx, cy, zt, zt + 1.6, 1.2, 8, PS, cap=False)
            strip(m, cx, cy, zt + 1.75, 7.45, D, 0.3, n=24)
        else:
            garden(m, cx, cy - 0.6, zt, 3.6, 3, trees=(i % 2 == 0))
        hw_, hd_ = pw / 2 - 0.5, pd / 2 - 0.5
        oy_ = cy + (-1.2 if (n - 1) % 2 == 0 else 0.0)
        rail_line(m, [(cx - hw_, oy_ - hd_), (cx + hw_, oy_ - hd_), (cx + hw_, oy_ + hd_), (cx - hw_, oy_ + hd_)], zt, closed=True)
        roof_kit(m, cx + 2.0, oy_ + hd_ - 1.6, zt, 0.6, hatch=True, vents=1) if (i != len(stacks) - 1 and L < 5) else None
        if i == 0:                                                                                # the residents' door, at the back
            with m.side('back', cx - pw / 2, cx + pw / 2, cy - 1.2 - pd / 2, cy - 1.2 + pd / 2, 0.3) as Lw:
                m.door(2.6, 1.8, 2.25, col='pearl_hi', glass=0.8, y=-0.02, fw=0.12, dep=0.06, pane='glass_b', knob=None, double=True)
    ex = bx0 + pw * (0.5 if L == 3 else 1.0) + 0.6
    ey = cy - pd / 2 - 1.2 - 4.5
    plinth_ring(m, ex, ey, 5.5 if L > 3 else 4.0, 24, h=0.4)
    dome(m, ex, ey, 0.4, 5.5 if L > 3 else 4.0, 4.4 if L > 3 else 3.2, mat='glass', col='glass_b', col1='glass_c', n=24)
    for k in range(6):
        a = k * math.pi / 3 + 0.3
        rr_, hh_ = (5.55, 4.45) if L > 3 else (4.05, 3.25)
        m.tube([(ex + rr_ * math.cos(b) * math.cos(a), ey + rr_ * math.cos(b) * math.sin(a), 0.4 + hh_ * math.sin(b)) for b in [math.pi / 2 * t / 4 for t in range(5)]], 0.09, 3, P, caps=False)
    strip(m, ex, ey, 0.45, (5.5 if L > 3 else 4.0) + 0.05, D, 0.25, n=24)
    paving(m, ex - 2.2, ex + 2.2, -Dp / 2 + 0.3, ey - (5.3 if L > 3 else 3.8) - 3.2, 0.0, every=2.2)
    portal(m, ex, ey - (5.3 if L > 3 else 3.8), D, w=2.6, name='UHOME')
    set_door(m, ex, -Dp / 2)
    bowl(m, ex - 9, ey - 1, 1.5, flowers='flower_red')
    if L > 3:
        bowl(m, ex + 9, ey - 1, 1.5, flowers='flower_yel')
    if L == 5:
        px, py = -W / 2 + 10, -Dp / 2 + 10
        m.lathe(px, py, [(6.0, 0), (6.0, 0.35), (5.3, 0.35)], 24, [PS, P, P], cap=False)
        with m.use('glass'):
            m.cap(ngon(5.3, 24, px, py), 0.3, 'water_g')
        umbrella_table(m, px + 8, py + 1, 0, col=D)
        for k in range(3):
            with m.at(px - 2.5 + k * 2.5, py + 7.6, 0, math.pi / 2):
                m.rbox(0, 0, 1.9, 0.7, 0.3, 0.45, P, r=0.2, seg=1, bottom=True)
                m.cbox(0, 0, 1.4, 0.4, 0, 0.3, 'plinth')
        flag_row(m, W / 2 - 12, -Dp / 2 + 4, (D, 't_blue', 't_yel'), 10, 3.0)
    street(m, W, Dp, L)
    m.pop()


@building('pindou', 'software')
def b_pindou(m, L):
    """Craft shop: a small cluster of spheres, like beads on a string."""
    D = 'd_software'
    W, Dp = {3: (24, 20), 4: (36, 28), 5: (46, 34)}[L]
    ph = fpad(m, W, Dp, 7)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    beads = {3: [(0, 2, 4.6, P), (5.5, 3, 3.0, D)],
             4: [(0, 2.5, 6.0, P), (7.6, 3.5, 4.2, D), (-7.2, 4, 3.8, P), (2, 9, 3.4, 't_yel')],
             5: [(0, 2.5, 6.4, P), (8.2, 3.5, 4.6, D), (-7.8, 4, 4.2, P), (2, 9.6, 3.8, 't_yel'), (-13.5, 1, 3.0, 't_teal'), (14, 0.5, 2.8, 't_pink')]}[L]
    bx0_, by0_ = beads[0][0], beads[0][1]
    for bx, by, r, c in beads[1:]:
        # the string: a short glazed link from the big bead to each smaller one, on a stone sill
        d_ = math.hypot(bx - bx0_, by - by0_)
        ux, uy = (bx - bx0_) / d_, (by - by0_) / d_
        a_ = (bx0_ + ux * beads[0][2] * 0.7, by0_ + uy * beads[0][2] * 0.7)
        b_ = (bx - ux * r * 0.7, by - uy * r * 0.7)
        with m.use('glass'):
            m.hcyl((*a_, 1.7), (*b_, 1.7), 1.45, 10, 'glass_b', cap=False)
        for t in (0.25, 0.5, 0.75):
            q = (a_[0] + (b_[0] - a_[0]) * t, a_[1] + (b_[1] - a_[1]) * t)
            m.hcyl((q[0] - ux * 0.12, q[1] - uy * 0.12, 1.7), (q[0] + ux * 0.12, q[1] + uy * 0.12, 1.7), 1.55, 10, P, cap=False)
        m.beam((*a_, 0.12), (*b_, 0.12), 2.4, 0.24, 'plinth')
    for bx, by, r, c in beads:
        plinth_ring(m, bx, by, r * 0.66, 20, h=0.5, out=0.3)
        m.cyl(bx, by, 0, 0.5, r * 0.66, 20, PS, cap=False)
        m.ball(bx, by, r * 0.88, r, shade(c, 0.86), n=28, rings=14, col1=tint(c, 0.25))
        lip(m, bx, by, r * 0.88 + r * 0.98, r * 0.24, 12, out=0.12, h=0.18)
        with clear(m):
            m.cap(ngon(r * 0.24, 12, bx, by), r * 1.86, 'glass_c')                  # the bead's hole is a roof light
        with m.at(bx, by - r * 0.93, 0):
            if c == P:
                round_win(m, r * 0.48, r * 1.0, r * 0.2, y=-0.0, col=mixc('pane', 'lamp_warm', 0.3))
    r0 = beads[0][2]
    portal(m, 0, beads[0][1] - r0 * 0.9, D, w=2.4, name='BEADS' if L > 3 else None, size=0.7)
    paving(m, -2.2, 2.2, -Dp / 2 + 0.3, beads[0][1] - r0 * 0.9 - 3.2, 0.0, every=2.0)
    bike_hoops(m, 4.5, -Dp / 2 + 4.0, 3)
    # a string of small beads on a rod
    rx, ry = -W / 2 + 4.5, -Dp / 2 + 5
    nb = 3 if L == 3 else 5
    m.cyl(rx, ry, 0, 0.9 + nb * 1.05, 0.1, 5, 'brushed')
    for i in range(nb):
        giant_bead(m, rx, ry, 1.0 + i * 1.05, BEAD_COLS[(i * 2) % 8], R=0.9 - 0.04 * i, n=12)
    bowl(m, W / 2 - 5, -Dp / 2 + 5, 1.3, flowers='flower_pink')
    if L == 5:
        halo(m, 0, 2.5, 13.8, 3.0, D, r=0.3, n=24)
        m.cyl(0, 2.5, 12.2, 13.8, 0.08, 4, P, cap=False)
        umbrella_table(m, -W / 2 + 9, -Dp / 2 + 9, 0, col=D)
        m.flag(W / 2 - 4, Dp / 2 - 4, 9, D)
    street(m, W, Dp, L, trees=L > 3)
    m.pop()


# ================================================================== BOOKS & APPS (yellow)
def ramp(m, cx, cy, r0, z0, z1, turns, w=2.4, n=40, col=P, rail=None, a0=-math.pi / 2):
    """A spiral ramp round a drum."""
    for i in range(n):
        ta, tb = i / n, (i + 1) / n
        aa, ab = a0 + turns * 2 * math.pi * ta, a0 + turns * 2 * math.pi * tb
        za, zb = z0 + (z1 - z0) * ta, z0 + (z1 - z0) * tb
        A0, A1 = (cx + r0 * math.cos(aa), cy + r0 * math.sin(aa)), (cx + (r0 + w) * math.cos(aa), cy + (r0 + w) * math.sin(aa))
        B0, B1 = (cx + r0 * math.cos(ab), cy + r0 * math.sin(ab)), (cx + (r0 + w) * math.cos(ab), cy + (r0 + w) * math.sin(ab))
        m.poly([(*A0, za), (*A1, za), (*B1, zb), (*B0, zb)], tint(col, 0.2))
        m.poly([(*B0, zb - 0.4), (*B1, zb - 0.4), (*A1, za - 0.4), (*A0, za - 0.4)], shade(col, 0.75))
        m.poly([(*A1, za - 0.4), (*B1, zb - 0.4), (*B1, zb + 1.1), (*A1, za + 1.1)], col)
        m.poly([(*B1, zb + 1.0), (*B1, zb - 0.4), (*A1, za - 0.4), (*A1, za + 1.0)][::-1], shade(col, 0.8)) if False else None
        m.poly([(*A1, za + 1.1), (*B1, zb + 1.1), (*B1, zb), (*A1, za)], shade(col, 0.85))
        m.poly([(*A1, za + 1.1), (A1[0] + 0.2 * math.cos(aa), A1[1] + 0.2 * math.sin(aa), za + 1.1), (B1[0] + 0.2 * math.cos(ab), B1[1] + 0.2 * math.sin(ab), zb + 1.1), (*B1, zb + 1.1)][::-1], tint(col, 0.2))
        if rail:
            with m.use('glow'):
                m.poly([(A1[0] * 1.0 + 0.05 * math.cos(aa), A1[1] + 0.05 * math.sin(aa), za + 0.72), (B1[0] + 0.05 * math.cos(ab), B1[1] + 0.05 * math.sin(ab), zb + 0.72),
                        (B1[0] + 0.05 * math.cos(ab), B1[1] + 0.05 * math.sin(ab), zb + 0.95), (A1[0] + 0.05 * math.cos(aa), A1[1] + 0.05 * math.sin(aa), za + 0.95)], rail)


@building('books', 'books')
def b_books(m, L):
    """Bookshop: a round reading pavilion, a drum with a spiral ramp, under a roof like an open book."""
    D = 'd_books'
    W, Dp = {3: (30, 24), 4: (44, 34), 5: (56, 42)}[L]
    ph = fpad(m, W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    R, H = (6.0, 7.0) if L == 3 else (9.0, 12.5)
    cx, cy = (0, 2) if L < 5 else (-5, 3)
    plinth_ring(m, cx, cy, R, 32)
    drum(m, cx, cy, 0, H, R, n=32)
    # under the book roof: a reading terrace on top of the drum, reached by the ramp, behind a railing
    m.cap(ngon(R - 0.05, 32, cx, cy), H + 0.02, 'deck_wood')
    a_end = -math.pi / 2 + 0.5 + (1.0 if L == 3 else 1.5) * 2 * math.pi
    rail_ring_clear(m, cx, cy, H, R - 0.3, 32, gaps=[(a_end % (2 * math.pi), 0.35)])
    for k in range(4):                           # struts carry the book's pages from the drum's rim
        a = math.pi / 4 + k * math.pi / 2
        sx_ = 1 if math.cos(a) > 0 else -1
        m.tube([(cx + (R - 0.4) * math.cos(a), cy + (R - 0.4) * math.sin(a), H + 1.1), (cx + sx_ * (R * 0.95), cy + (R - 0.4) * math.sin(a), H + 0.6 + 2.0 * (R * 0.95) / (R + 2.2) - 0.55)], 0.12, 4, 'pale_metal', caps=False)
    fl = 2 if L == 3 else 3
    for f in range(fl):
        z = 1.1 + f * (H - 1.0) / fl
        gband(m, cx, cy, z, z + (H - 1.0) / fl - 1.6, R + 0.03, n=32, lit=0.3)
    ramp(m, cx, cy, R + 0.1, 0.2, H - 0.6, 1.0 if L == 3 else 1.5, w=2.2, n=30 if L == 3 else 46, rail=D, a0=-math.pi / 2 + 0.5)
    # the roof: an open book, pages rising from the spine
    with m.at(cx, cy, H):
        for sx in (-1, 1):
            q = [(0, -R - 1.5, 0.6), (sx * (R + 2.2), -R - 1.5, 2.6), (sx * (R + 2.2), R + 1.5, 2.6), (0, R + 1.5, 0.6)]
            if sx < 0:
                q = q[::-1]
            m.poly(q, 'paper')
            m.poly([(p[0], p[1], p[2] - 0.5) for p in q][::-1], D)
            e = [(0, -R - 1.5, 0.1), (sx * (R + 2.2), -R - 1.5, 2.1), (sx * (R + 2.2), -R - 1.5, 2.6), (0, -R - 1.5, 0.6)]
            m.poly(e if sx > 0 else e[::-1], 'paper')
            b = [(p[0], R + 1.5, p[2]) for p in e]
            m.poly(b[::-1] if sx > 0 else b, 'paper')
            s_ = [(sx * (R + 2.2), -R - 1.5, 2.1), (sx * (R + 2.2), R + 1.5, 2.1), (sx * (R + 2.2), R + 1.5, 2.6), (sx * (R + 2.2), -R - 1.5, 2.6)]
            m.poly(s_ if sx > 0 else s_[::-1], D)
            for k in range(3):
                v = -R * 0.6 + k * R * 0.5
                ln = [(sx * R * 0.3, v, 0.6 + 2.0 * (R * 0.3) / (R + 2.2) + 0.04), (sx * R * 1.05, v, 0.6 + 2.0 * (R * 1.05) / (R + 2.2) + 0.04),
                      (sx * R * 1.05, v + 0.5, 0.6 + 2.0 * (R * 1.05) / (R + 2.2) + 0.04), (sx * R * 0.3, v + 0.5, 0.6 + 2.0 * (R * 1.05 * 0 + R * 0.3) / (R + 2.2) + 0.04)]
                m.poly(ln if sx > 0 else ln[::-1], 'seam')
        m.cyl(0, 0, 0, 0.8, R * 0.6, 16, PS)
    portal(m, cx, cy - R - 2.2, D, name='Snuggle Crew' if L > 3 else 'BOOKS', size=0.8, w=2.6)
    paving(m, cx - 2.2, cx + 2.2, -Dp / 2 + 0.3, cy - R - 5.4, 0.0, every=2.0)
    bike_hoops(m, cx - 5.0, cy - R - 5.5, 3)
    giant_book(m, cx + R + 4.5, cy - R - 1, 0, 4.4, 3.2, 0.9, 't_red', 0.3)
    if L > 3:
        giant_book(m, cx + R + 4.7, cy - R - 0.9, 0.9, 4.0, 2.9, 0.8, 't_blue', -0.2)
        bowl(m, cx - R - 4, cy - R, 1.4, flowers='flower_yel')
    if L == 5:
        ax, ay = W / 2 - 10, 5
        drum(m, ax, ay, 0, 5.2, 6.0, n=24)
        gband(m, ax, ay, 1.0, 4.4, 6.03, n=24, lit=0.35)
        disc(m, ax, ay, 5.2, 7.0, 0.8, n=24)
        garden(m, ax, ay, 6.0, 5.0, 4)
        rail_ring(m, ax, ay, 6.0, 6.6, n=24)
        plinth_ring(m, ax, ay, 6.0, 24, h=0.35)
        strip(m, ax, ay, 4.7, 6.05, D, n=24)
        portal(m, ax, ay - 6.1, D, w=2.2)
        for px_, py_ in ((-W / 2 + 3, -Dp / 2 + 3), (cx - 5.5, -Dp / 2 + 3)):
            m.cyl(px_, py_, 0, 5.8, 0.08, 5, 'pale_metal', cap=False)
        m.bunting((-W / 2 + 3, -Dp / 2 + 3, 5.6), (cx - 5.5, -Dp / 2 + 3, 5.6), TOY, sag=0.8, n=8)
        round_paving(m, -W / 2 + 9, -Dp / 2 + 9, 4.5, 0.0, n=20, rings=(0.55,), spokes=6)
        fountain_pool(m, -W / 2 + 9, -Dp / 2 + 9, 2.6, 0.0, n=16)
        m.flag(-W / 2 + 6, Dp / 2 - 5, 9, D)
        giant_book(m, cx + R + 4.3, cy - R - 1.1, 1.7, 3.5, 2.6, 0.7, 't_green', 0.5)
    street(m, W, Dp, L)
    m.pop()


@building('bookflow', 'books', site='site_large')
def b_bookflow(m, L):
    """Print works: a clean hall under a rolling roof, like sheets of paper flowing off a press. Paper rolls at the dock."""
    D = 'd_books'
    W, Dp = {3: (38, 30), 4: (62, 44), 5: (74, 50)}[L]
    ph = fpad(m, W, Dp)
    m.push(0, 0, ph)
    sw, sd, sh, waves = (24, 13, 5.5, 2) if L == 3 else ((46, 20, 7.5, 4) if L == 4 else (58, 20, 7.5, 5))
    cy = 5.0
    x0, x1, y0, y1 = -sw / 2 + (0 if L < 5 else 0), sw / 2, cy - sd / 2, cy + sd / 2
    m.rbox(0, cy, sw, sd, 0, sh, P, r=1.0, seg=3, top=False)
    with m.side('front', x0, x1, y0, y1) as Lw:
        with m.use('glass'):
            m.plate(rrect2(0, sh / 2 + 0.3, Lw - 4, sh - 2.4, 0.8, 3), 0, 0.1, 'glass_b', edge=P)
        for mx in row(waves * 3, Lw - 4.5):
            m.fq(mx - 0.07, mx + 0.07, 1.6, sh - 1.0, -0.13, P)
    # the rolling roof: one long sheet in smooth waves, curling down at the far end like paper
    n = waves * 8
    amp = 1.5
    pts = []
    for i in range(n + 1):
        u = i / n
        pts.append((x0 - 1.0 + (sw + 2.0) * u, sh + 1.9 + amp * math.sin(2 * math.pi * waves * u - math.pi / 2)))
    for k in range(1, 5):
        a = k * math.pi / 8
        pts.append((x1 + 1.0 + 2.6 * math.sin(a), sh + 1.9 - amp - 2.6 * (1 - math.cos(a))))
    ya, yb = y0 - 1.6, y1 + 1.2
    for i in range(len(pts) - 1):
        (xa, za), (xb, zb) = pts[i], pts[i + 1]
        m.poly([(xa, yb, za), (xa, ya, za), (xb, ya, zb), (xb, yb, zb)], [tint('paper', 0.0), 'paper', 'paper', 'paper'])
        m.poly([(xa, ya, za - 0.35), (xa, yb, za - 0.35), (xb, yb, zb - 0.35), (xb, ya, zb - 0.35)], D)
        m.poly([(xa, ya, za - 0.35), (xb, ya, zb - 0.35), (xb, ya, zb), (xa, ya, za)], D)
        m.poly([(xb, yb, zb - 0.35), (xa, yb, za - 0.35), (xa, yb, za), (xb, yb, zb)], D)
    # glazed gaps under the waves
    for sy_, yy in ((-1, y0 + 0.1), (1, y1 - 0.1)):
        for i in range(n):
            (xa, za), (xb, zb) = pts[i], pts[i + 1]
            if xa < x0 or xb > x1:
                continue
            q = [(xa, yy, sh - 0.05), (xb, yy, sh - 0.05), (xb, yy, zb - 0.3), (xa, yy, za - 0.3)]
            with m.use('glass'):
                m.poly(q if sy_ < 0 else q[::-1], 'glass_c')
    # the roof sheet rests on slim posts standing on the hall's walls, at every trough
    for i in range(1, n):
        xa, za = pts[i]
        if pts[i - 1][1] > za < pts[i + 1][1] and x0 < xa < x1:
            for yy in (y0 + 0.3, y1 - 0.3):
                m.cyl(xa, yy, sh, za - 0.3, 0.14, 6, 'pale_metal', cap=False)
    for sname in ('left', 'right', 'back'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            glazing(m, -(Lw - 5) / 2, (Lw - 5) / 2, 1.4, sh - 1.2, 0.0, bay=2.0, lit=0.2)
    m.box(x0 - 0.2, x1 + 0.2, y0 - 0.2, y1 + 0.2, 0, 0.35, 'plinth', top=False)
    dxs = x0 + (4.5 if L == 3 else 7)
    portal(m, x1 - 5, y0 - 0.3, D, name='BookFlow', w=2.6, size=0.8)
    set_door(m, x1 - 5, -Dp / 2)
    paving(m, x1 - 7.2, x1 - 2.8, -Dp / 2 + 0.3, y0 - 3.3, 0.0, every=2.0)
    bike_hoops(m, x1 - 10, y0 - 4.5, 3)
    # the dock: a slim canopy, and the big rolls of paper
    disc(m, dxs, y0 - 3.5, 5.6, 5.5 if L > 3 else 4.0, 0.5, n=24)
    m.cyl(dxs, y0 - 3.5, 0, 5.6, 0.32, 10, P, r2=0.22, cap=False)
    m.cyl(dxs, y0 - 3.5, 0, 0.3, 0.6, 10, 'plinth')
    for k in range(4):                           # four struts spread the canopy's load into its column
        a = math.pi / 4 + k * math.pi / 2
        m.tube([(dxs + 0.25 * math.cos(a), y0 - 3.5 + 0.25 * math.sin(a), 4.0), (dxs + 2.6 * math.cos(a), y0 - 3.5 + 2.6 * math.sin(a), 5.6)], 0.08, 4, 'pale_metal', caps=False)
    strip(m, dxs, y0 - 3.5, 5.75, 5.4 if L > 3 else 3.9, D, 0.25, n=24)
    paper_roll(m, dxs - 2.4, y0 - 2.6, 0, 1.15, 2.3, upright=True)
    paper_roll(m, dxs + 2.2, y0 - 3.2, 0, 1.15, 2.3, upright=True)
    if L > 3:
        paper_roll(m, dxs + 0.2, y0 - 5.4, 0, 1.1, 2.4, rz=0.3)
        old.idea_board(m, x1 - 14, -Dp / 2 + 5.0, 0.0, 0.8)
        m.cyl(x0 + 3, y1 - 3, sh, sh + 12.0, 0.5, 10, P, r2=0.3, cap=True)
        halo(m, x0 + 3, y1 - 3, sh + 11.0, 1.4, D, r=0.2, n=16)
    if L == 5:
        for i, c in enumerate(('t_cyan', 't_magenta', 't_yel', 'iron')):
            sx_, sy_ = -W / 2 + 6, y1 - 2 - i * 4.4
            plinth_ring(m, sx_, sy_, 1.7, 16, h=0.4)
            m.lathe(sx_, sy_, [(1.7, 0), (1.7, 6.5), (1.2, 7.6), (0.0, 8.0)], 16, [PS, P, P, P], cap=False)
            strip(m, sx_, sy_, 4.2, 1.7, c, 0.9, n=16)
        truck(m, 4, -Dp / 2 + 5, 0, math.pi, col=P, load='box')
        m.flag(W / 2 - 5, Dp / 2 - 4, 10, D)
    street(m, W, Dp, L)
    m.pop()


@building('ipad', 'books')
def b_ipad(m, L):
    """Art studio: a soft white studio under one big curved skylight; a drawing tablet and giant pencils outside."""
    D = 'd_books'
    W, Dp = {3: (30, 24), 4: (46, 36), 5: (58, 42)}[L]
    ph = fpad(m, W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    w, d, h = (14, 10, 4.2) if L == 3 else (25, 16, 5.6)
    cx = 0 if L < 5 else -5
    cy = 3.5
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
    soft(m, cx, cy, w, d, 0, h, P, r=2.4)
    # the skylight: a quarter-barrel of glass sweeping from the roof down the front
    Rg = d * 0.62
    n = 9
    xa, xb = x0 + 2.2, x1 - 2.2
    arc = [(cy + d * 0.12 - Rg * math.sin(math.pi / 2 * i / n * 1.25), h - 1.6 + Rg * 0.92 * math.cos(math.pi / 2 * i / n * 1.25)) for i in range(n + 1)]
    for i in range(n):
        (ya, za), (yb, zb) = arc[i], arc[i + 1]
        with m.use('glass'):
            m.poly([(xb, ya, za), (xa, ya, za), (xa, yb, zb), (xb, yb, zb)], [mixc('glass_c', 'glass_b', i / n)] * 2 + [mixc('glass_c', 'glass_b', (i + 1) / n)] * 2)
    for sx, xx in ((-1, xa), (1, xb)):
        fan = [(xx, cy + d * 0.12, h - 1.6)] + [(xx, y, z) for y, z in arc]
        with m.use('glass'):
            m.poly(fan[::-1] if sx < 0 else fan, 'glass_b')
        for i in range(n):
            m.beam((xx, arc[i][0], arc[i][1]), (xx, arc[i + 1][0], arc[i + 1][1]), 0.3, 0.3, P)
    for k in range(1, 4):
        xx = xa + (xb - xa) * k / 4
        for i in range(n):
            m.beam((xx, arc[i][0], arc[i][1] + 0.03), (xx, arc[i + 1][0], arc[i + 1][1] + 0.03), 0.14, 0.1, P)
    strip_y = y0 - 0.08
    with m.use('glow'):
        m.box(x0 + 2.4, x1 - 2.4, strip_y - 0.05, strip_y, 0.5, 0.8, D, top=False)
    portal(m, cx + w / 2 - 4, y0 - 0.2, D, w=2.4, name='STUDIO' if L > 3 else None, size=0.7)
    px_ = cx + w / 2 - 4
    with m.side('front', x0, x1, y0, y1) as Lw:        # the studio's front: a long glazed band beside the door
        glazing(m, -Lw / 2 + 2.6, (px_ - cx) - 2.6, 1.1, h - 1.9, 0.0, bay=1.8, lit=0.25)
    paving(m, -2.0, 2.0, -Dp / 2 + 0.3, y0 - 5.5, 0.0, every=2.0)
    paving(m, min(0, px_) - 2.0, max(0, px_) + 2.0, y0 - 7.5, y0 - 5.5, 0.0, every=2.4, along='x', edge=None)
    paving(m, px_ - 2.0, px_ + 2.0, y0 - 5.5, y0 - 3.0, 0.0, every=2.0, edge=None)
    m.box(x0 - 0.2, x1 + 0.2, y0 - 0.2, y1 + 0.2, 0, 0.3, 'plinth', top=False)
    for xx_, yy_ in ((x0 + 0.5, y1 + 0.05), (x1 - 0.5, y1 + 0.05)):
        downpipe(m, xx_, yy_, h - 0.3)
    roof_kit(m, cx - w / 2 + 3.5, y1 - 2.2, h, 0.7, vents=1)
    bike_hoops(m, -5.5, y0 - 8.5, 3)
    for sname in ('left', 'right', 'back'):
        with m.side(sname, x0, x1, y0, y1) as Lw:
            with m.use('glow'):
                m.plate(rrect2(0, h / 2 + 0.2, Lw - 6, 2.0, 0.6, 3), 0, 0.1, 'pane', edge=P)
    tablet_easel(m, x0 - 0.5 + 3, y0 - 6.5 if L > 3 else y0 - 4.6, 0.35, 1.0 if L > 3 else 0.72)
    px, py = (x1 + 4.0, y0 - 3.5) if L > 3 else (x1 + 2.6, y0 - 3)
    m.lathe(px, py, [(1.5, 0), (1.75, 2.3), (1.55, 2.3), (1.45, 1.9)], 16, [shade(D, 0.85), D, D, shade(D, 0.5)], cap=True)
    for i, c in enumerate(('t_red', 't_blue', 't_green', 't_purple')[: (2 if L == 3 else 4)]):
        a = i * 1.7 + 0.3
        pencil(m, px + 0.55 * math.cos(a), py + 0.55 * math.sin(a), 0.4, c, h=7.5 - i * 0.6, r=0.42, lean=0.14, rz=a + math.pi / 2)
    if L == 5:
        ax, ay = W / 2 - 10, 4
        plinth_ring(m, ax, ay, 6.5, 24, h=0.4)
        drum(m, ax, ay, 0, 5.0, 6.5, n=24)
        gband(m, ax, ay, 1.0, 4.2, 6.53, n=24, lit=0.3)
        ring_beam(m, ax, ay, 5.2, 6.6, 24, h=0.3)
        dome(m, ax, ay, 5.2, 6.5, 2.6, n=24, k=5)
        with clear(m):
            m.cap(ngon(1.4, 12, ax, ay), 5.2 + 2.6 + 0.02, 'glass_c')
        portal(m, ax, ay - 6.6, D, w=2.2)
        round_paving(m, ax - 4.5, -Dp / 2 + 7, 5.5, 0.0, n=20, rings=(0.6,), spokes=6)
        strip(m, ax, ay, 4.6, 6.55, D, n=24)
        for i, (c, kind) in enumerate((('t_red', 0), ('t_blue', 1), ('t_yel', 2))):
            sx_ = ax - 4.5 + i * 4.5
            sy_ = -Dp / 2 + 7
            m.cyl(sx_, sy_, 0, 0.8, 1.0, 12, PS)
            if kind == 0:
                m.ball(sx_, sy_, 2.1, 1.3, shade(c, 0.85), n=14, rings=8, col1=tint(c, 0.15))
            elif kind == 1:
                soft(m, sx_, sy_, 1.9, 1.9, 0.8, 2.7, c, r=0.4)
            else:
                m.lathe(sx_, sy_, [(1.2, 0.8), (0.0, 3.5)], 16, [shade(c, 0.85), tint(c, 0.15)], bottom=True)
        m.flag(-W / 2 + 5, Dp / 2 - 4, 9, D)
    street(m, W, Dp, L)
    m.pop()


# ================================================================== FILM & MEDIA (blue)
def skeleton(m, cx, cy, z, s=1.0, rz=0.0):
    """A simple mammoth skeleton on a round plinth: spine, ribs, legs, skull and tusks, in bone white."""
    with m.at(cx, cy, z, rz):
        m.lathe(0, 0, [(4.6 * s, 0), (4.6 * s, 0.6), (4.2 * s, 0.8)], 20, [PS, P, P], cap=True)
        with m.at(0, 0, 0.8, s=s):
            B = 'bone'
            spine = [(0, 3.0, 3.4), (0, 1.5, 4.3), (0, -0.5, 4.6), (0, -2.0, 4.5), (0, -3.0, 4.0)]
            m.tube(spine, 0.2, 5, B)
            for i, yy in enumerate((1.8, 1.0, 0.2, -0.6, -1.4)):
                zz = 4.25 + 0.3 * math.sin((1.8 - yy) / 3.2 * math.pi)
                for sx in (-1, 1):
                    m.tube([(0, yy, zz), (sx * 1.1, yy, zz - 0.6), (sx * 1.25, yy, zz - 1.8), (sx * 0.7, yy, zz - 2.6)], 0.09, 4, B, caps=False)
            for (lx, ly, top) in ((-0.9, -1.9, 3.6), (0.9, -1.9, 3.6), (-0.9, 2.3, 3.3), (0.9, 2.3, 3.3)):
                m.tube([(lx, ly, top), (lx, ly + 0.2, top / 2), (lx, ly, 0.0)], [0.2, 0.15, 0.2], 5, B)
            m.ball(0, -3.9, 4.0, 0.95, shade(B, 0.9), n=8, rings=5, sz=1.2, col1=B)
            m.ball(0, -3.9, 5.1, 0.55, B, n=7, rings=4)
            for sx in (-1, 1):
                m.tube([(sx * 0.45, -4.5, 3.3), (sx * 1.0, -5.4, 2.2), (sx * 1.3, -6.4, 2.0), (sx * 1.0, -7.1, 2.9), (sx * 0.5, -7.2, 3.9)], [0.22, 0.2, 0.17, 0.12, 0.04], 6, 'paper')
            m.tube([(0, 3.0, 3.4), (0, 3.6, 2.6)], [0.12, 0.05], 4, B)


@building('yae', 'film', site='site_large')
def b_yae(m, L):
    """Natural history museum: a low white ring under a large glass dome, with a mammoth skeleton outside."""
    D = 'd_film'
    W, Dp = {3: (36, 32), 4: (62, 48), 5: (74, 54)}[L]
    ph = fpad(m, W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    R = 9.5 if L == 3 else 16.5
    cx, cy = (0, 4) if L < 5 else (-5, 4)
    plinth_ring(m, cx, cy, R, 36)
    drum(m, cx, cy, 0, 5.2, R, n=36)
    gband(m, cx, cy, 1.2, 4.2, R + 0.03, n=36, lit=0.25, mull=3)
    disc(m, cx, cy, 5.2, R + 1.3, 0.8, n=36)
    strip(m, cx, cy, 4.7, R + 0.02, D, n=36)
    Rd = R * 0.84
    dome(m, cx, cy, 6.0, Rd, Rd * 0.9, mat='glass', col='glass_b', col1='glass_c', n=36, k=8)
    for k in range(12 if L > 3 else 8):
        a = 2 * math.pi * k / (12 if L > 3 else 8)
        pts = [(cx + (Rd + 0.06) * math.cos(b) * math.cos(a), cy + (Rd + 0.06) * math.cos(b) * math.sin(a), 6.0 + (Rd * 0.9 + 0.06) * math.sin(b)) for b in [math.pi / 2 * i / 6 for i in range(7)]]
        for i in range(6):
            m.beam(pts[i], pts[i + 1], 0.16, 0.1, P)
    for b in (0.42, 0.85):
        m.lathe(cx, cy, [((Rd + 0.07) * math.cos(b), 6.0 + (Rd * 0.9) * math.sin(b) - 0.06), ((Rd + 0.07) * math.cos(b + 0.012), 6.0 + (Rd * 0.9) * math.sin(b + 0.012) + 0.06)], 36, P, cap=False)
    m.ball(cx, cy, 6.0 + Rd * 0.9 + 0.3, 0.5, 'gold_g', n=8, rings=4)
    portal(m, cx, cy - R - 0.3, D, name='YouAreExtinct' if L > 3 else 'MUSEUM', w=3.6, size=0.8)
    paving(m, cx - 2.8, cx + 2.8, -Dp / 2 + 0.3, cy - R - 3.4, 0.0, every=2.2)
    ring_beam(m, cx, cy, 6.25, Rd, 36, h=0.25, out=0.25)
    for k in range(2 if L == 3 else 3):
        seat(m, cx + R * 0.55 + k * 3.0, cy - R - 3.0 - k * 0.6, 0.15 * k, 2.4)
    signpost(m, cx - 6.5, -Dp / 2 + 3.0, 'MUSEUM', D, size=0.55) if L > 3 else None
    skeleton(m, cx - R - (3 if L == 3 else 6), cy - R - (1 if L == 3 else 2), 0, 0.55 if L == 3 else 0.9, rz=-0.5)
    if L > 3:
        for sx in (-1, 1):
            bowl(m, cx + sx * 7, cy - R - 3.5, 1.5, flowers='flower_white')
    if L == 5:
        ax, ay = W / 2 - 11, 6
        plinth_ring(m, ax, ay, 7.0, 24)
        drum(m, ax, ay, 0, 4.2, 7.0, n=24)
        gband(m, ax, ay, 1.0, 3.4, 7.03, n=24)
        ring_beam(m, ax, ay, 4.4, 7.0, 24, h=0.35)
        dome(m, ax, ay, 4.4, 7.0, 4.4, mat='glass', col='glass_b', col1='glass_c', n=24, k=6)
        for k in range(6):
            a = k * math.pi / 3
            m.tube([(ax + 7.05 * math.cos(b) * math.cos(a), ay + 7.05 * math.cos(b) * math.sin(a), 4.4 + 4.45 * math.sin(b)) for b in [math.pi / 2 * t / 4 for t in range(5)]], 0.1, 3, P, caps=False)
        portal(m, ax, ay - 7.1, D, w=2.4)
        strip(m, ax, ay, 3.8, 7.05, D, n=24)
        sabre_cat(m, W / 2 - 10, -Dp / 2 + 9, 0, 1.2, rz=0.45, col='bone')
        round_paving(m, cx + 6, -Dp / 2 + 8, 5.5, 0.0, n=20, rings=(0.6,), spokes=6)
        fountain_pool(m, cx + 6, -Dp / 2 + 8, 3.0, 0.0, n=18)
        for sx in (-1, 1):
            m.flag(cx + sx * 13, -Dp / 2 + 4, 10.5, D)
    street(m, W, Dp, L)
    m.pop()


def stadium(w, d, n=10, cx=0.0, cy=0.0):
    """A rectangle with fully rounded ends (a lounge-pill plan)."""
    return rrect(w, d, d / 2 - 0.01, n, cx, cy)


@building('noir', 'film')
def b_noir(m, L):
    """Late-night jazz lounge: a low rounded lounge with a tall slim fin of light, and a saxophone on the fin."""
    D = 'd_film'
    W, Dp = {3: (26, 22), 4: (40, 30), 5: (50, 36)}[L]
    ph = fpad(m, W, Dp)
    m.push(0, 0, ph)
    w, d, h = (13, 8.5, 4.4) if L == 3 else (24, 13, 5.2)
    cy = 3.0
    amber = mixc('lamp_warm', 'w_noir', 0.25)
    out = stadium(w, d, 8, 0, cy)
    m.frustum(out, out, 0, 1.0, P, top=False)
    with m.use('glow'):
        m.frustum(stadium(w - 0.3, d - 0.3, 8, 0, cy), stadium(w - 0.3, d - 0.3, 8, 0, cy), 1.0, 3.3, shade(amber, 0.8), top=False, col1=amber)
    m.frustum(out, out, 3.3, h, P, top=False)
    top = stadium(w + 1.6, d + 1.6, 8, 0, cy)
    m.frustum(top, top, h, h + 0.5, P, top=tint(P, 0.2))
    m.cap(top, h, shade(P, 0.75), up=False)
    with m.use('glow'):
        m.frustum(stadium(w + 0.1, d + 0.1, 8, 0, cy), stadium(w + 0.1, d + 0.1, 8, 0, cy), 3.3, 3.6, D, top=False)
    for mx in row(8 if L > 3 else 5, w - d + 2):
        m.cbox(mx, cy - d / 2 + 0.02, 0.2, 0.3, 1.0, 3.3, P, top=False)
    if L == 5:
        dome(m, -w * 0.18, cy, h + 0.5, 4.6, 3.4, n=24, k=6)
        strip(m, -w * 0.18, cy, h + 0.55, 4.62, D, 0.28, n=24)
        for i in range(3):
            table_set(m, w * 0.22 + (i % 2) * 2.6, cy - 2 + i * 2.2, h + 0.5, P, 2)
        # the roof terrace: a railing round the edge, a stair hatch in the dome's lee
        rail_line(m, [(x_, y_) for x_, y_ in stadium(w + 0.6, d + 0.6, 6, 0, cy)], h + 0.5, closed=True)
        m.string_lights((w * 0.1, cy - d / 2, h + 3.4), (w / 2 + 0.4, cy - d / 2 + 0.5, h + 3.0), sag=0.5, n=6)
        m.string_lights((w / 2 + 0.4, cy - d / 2 + 0.5, h + 3.0), (w / 2 + 0.4, cy + d / 2 - 0.5, h + 3.0), sag=0.7, n=7)
        for px, py in ((w * 0.1, cy - d / 2), (w / 2 + 0.4, cy - d / 2 + 0.5), (w / 2 + 0.4, cy + d / 2 - 0.5)):
            m.cyl(px, py, h + 0.5, h + 3.5, 0.07, 4, P, cap=False)
    # the fin of light, with the letters and the saxophone
    fx, fy = w / 2 - 1.2, cy - d / 2 - 1.6
    fh_ = 12.0 if L == 3 else 17.0
    with m.at(fx, fy, 0, 0.35):
        m.rbox(0, 0, 3.4, 1.6, 0, 0.5, 'plinth', r=0.4, seg=2)                           # the fin's footing
        prof = [(0.0, 0.0), (1.1, 0.0), (1.25, fh_ * 0.5), (0.5, fh_), (0.0, fh_)]
        pts = [(-x, z) for x, z in prof[::-1]] + prof[1:-1]
        m.plate([(x, z) for x, z in [(-1.1, 0), (1.1, 0), (1.25, fh_ * 0.5), (0.45, fh_), (-0.45, fh_), (-1.25, fh_ * 0.5)]], 0.3, 0.6, P, back=True)
        with m.use('glow'):
            m.poly([(x, -0.33, z) for x, z in [(-0.75, 1.2), (0.75, 1.2), (0.85, fh_ * 0.5), (0.25, fh_ - 0.6), (-0.25, fh_ - 0.6), (-0.85, fh_ * 0.5)]], D)
            m.poly([(x, 0.33, z) for x, z in [(-0.75, 1.2), (0.75, 1.2), (0.85, fh_ * 0.5), (0.25, fh_ - 0.6), (-0.25, fh_ - 0.6), (-0.85, fh_ * 0.5)]][::-1], D)
        ls = min(1.5, fh_ * 0.09)
        for i, ch_ in enumerate('NOIR'):
            m.text(ch_, ls, 0, fh_ * 0.5 - i * ls * 1.25 + ls * 0.6, 'neon_pink', y=-0.36, mat='glow', bold=0.03)
        saxophone(m, 0, 0, fh_ + 0.2, h=3.6 if L > 3 else 2.8)
    portal(m, -w * 0.12, cy - d / 2 - 0.2, D, w=2.4, name='NOIR HOURS' if L > 3 else None, size=0.7)
    set_door(m, -w * 0.12, -Dp / 2)
    paving(m, -w * 0.12 - 2.0, -w * 0.12 + 2.0, -Dp / 2 + 0.3, cy - d / 2 - 3.1, 0.0, every=2.0)
    m.frustum(stadium(w + 0.5, d + 0.5, 8, 0, cy), stadium(w + 0.5, d + 0.5, 8, 0, cy), 0, 0.3, 'plinth', top=False)
    if L > 3:
        with m.at(-w / 2 - 1.5, cy - d / 2 - 2.5, 0):
            crescent(m, 0, 4.6, 0, 1.4)
            m.cyl(-0.3, 0, 0, 3.4, 0.08, 4, P, cap=False)
        for tx in (2.0, 5.5):                     # a little terrace of tables, clear of the door
            table_set(m, tx, cy - d / 2 - 3.0, 0, P, 2, rz=0.4)
        umbrella_table(m, 4.0, cy - d / 2 - 6.0, 0, col=D) if L == 5 else None
    street(m, W, Dp, L, trees=L > 3)
    m.pop()


@building('influencers', 'film')
def b_influencers(m, L):
    """Photo studio: a soft white drum scooped open like a cyclorama, softboxes inside, a ring of light above."""
    D = 'd_film'
    W, Dp = {3: (30, 24), 4: (46, 36), 5: (58, 42)}[L]
    ph = fpad(m, W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    R, H = (7.0, 6.5) if L == 3 else (11.5, 9.5)
    cx, cy = (0, 3) if L < 5 else (-5, 3)
    n = 36
    op = 9                                       # segments left open at the front
    ring = [(cx + R * math.cos(-math.pi / 2 + 2 * math.pi * (i + 0.5) / n), cy + R * math.sin(-math.pi / 2 + 2 * math.pi * (i + 0.5) / n)) for i in range(n)]
    inner = [(cx + (R - 0.6) * math.cos(-math.pi / 2 + 2 * math.pi * (i + 0.5) / n), cy + (R - 0.6) * math.sin(-math.pi / 2 + 2 * math.pi * (i + 0.5) / n)) for i in range(n)]
    lo, hi = op // 2, n - op // 2 - 1
    for i in range(lo, hi):
        m.wall(ring[i], ring[i + 1], 0, H, shade(P, 0.93), col1=P)
        with m.use('glow'):
            m.wall(inner[i + 1], inner[i], 0.05, H, tint(D, 0.72), col1=tint(D, 0.86))        # the lit cyclorama inside
    for i in (lo, hi):
        a, b = (ring[i], inner[i]) if i == lo else (inner[i], ring[i])
        m.wall(b, a, 0, H, P) if i == lo else m.wall(b, a, 0, H, P)
    m.cap(ngon(R - 0.6, n, cx, cy, rot=-math.pi / 2 + math.pi / n), 0.06, 'pearl_hi')
    for i in list(range(hi, n)) + list(range(0, lo)):                                           # the lintel over the opening
        j = (i + 1) % n
        m.wall(ring[i], ring[j], H - 2.0, H, P)
        m.wall(inner[j], inner[i], H - 2.0, H, PS)
        m.poly([(*inner[i], H - 2.0), (*inner[j], H - 2.0), (*ring[j], H - 2.0), (*ring[i], H - 2.0)], PS)
    disc(m, cx, cy, H, R + 0.8, 0.9, n=n)
    with m.use('glow'):
        m.lathe(cx, cy, [(R + 0.1, H - 0.45), (R + 0.1, H - 0.15)], n, D, cap=False)
    # the open front is glazed: a curved glass wall under the lintel, with mullions and a pair of doors in the middle
    for i in list(range(hi, n)) + list(range(0, lo)):
        j = (i + 1) % n
        with clear(m):
            m.poly([(*ring[i], 0.1), (*ring[j], 0.1), (*ring[j], H - 2.0), (*ring[i], H - 2.0)], 'glass_c')
        m.beam((*ring[i], 0.0), (*ring[i], H - 2.0), 0.12, 0.12, P)
    m.lathe(cx, cy, [(R + 0.12, 0.0), (R + 0.12, 0.12)], n, P, cap=False)
    plinth_ring(m, cx, cy, R, n, h=0.3)
    with m.at(cx, cy - R, 0):
        m.box(-1.3, 1.3, -0.12, 0.05, 0, 2.4, 'brushed', top=False)
        with clear(m):
            m.fq(-1.2, -0.03, 0.05, 2.3, -0.14, 'glass_b')
            m.fq(0.03, 1.2, 0.05, 2.3, -0.14, 'glass_b')
    paving(m, cx - 2.0, cx + 2.0, -Dp / 2 + 0.3, cy - R - 0.6, 0.0, every=2.0)
    roof_kit(m, cx + R * 0.35, cy + R * 0.45, H + 0.9, 0.7, rz=0.5, vents=1)
    s = 1.0 if L > 3 else 0.7
    softbox(m, cx - R * 0.45, cy - R * 0.25, 0, h=4.2 * s, s=s, rz=math.pi + 0.75)
    softbox(m, cx + R * 0.45, cy - R * 0.25, 0, h=4.2 * s, s=s, rz=math.pi - 0.75)
    m.cyl(cx, cy + R * 0.25, 0, 0.9 * s, 0.4 * s, 8, PS)
    m.person(cx, cy + R * 0.25, 0.9 * s, 't_pink', 1.25 * s, 0)
    tripod_camera(m, cx - 3.5, cy - R - 2.0 * s, 0, h=2.6 * s, rz=math.pi + 0.4)
    hz = H + 0.9 + (3.6 if L > 3 else 2.6)
    halo(m, cx, cy, hz, 3.0 if L > 3 else 2.0, 'lamp', r=0.4 if L > 3 else 0.28, n=28, axis='y')
    m.cyl(cx, cy, H + 0.9, hz - (3.0 if L > 3 else 2.0), 0.14, 5, P, cap=False)
    totem(m, cx + R + 3.5, cy - R * 0.7, 'STUDIO', D, rz=-0.3, size=0.8)
    if L > 3:
        truck(m, W / 2 - 8, -Dp / 2 + 6, 0, math.pi, col=P, load='box', L=7.0)
        bowl(m, cx - R - 3, cy - R * 0.6, 1.4, flowers='flower_pink')
    if L == 5:
        ax, ay = W / 2 - 10, 5
        plinth_ring(m, ax, ay, 6.0, 24, h=0.35)
        drum(m, ax, ay, 0, 5.5, 6.0, n=24)
        ring_beam(m, ax, ay, 5.7, 6.1, 24, h=0.25)
        portal(m, ax - 3.0, ay - 5.3, D, w=2.2, rz=-0.5)
        with m.use('glow'):
            m.lathe(ax, ay, [(6.05, 1.2), (6.05, 4.4)], 24, ['t_green', tint('t_green', 0.2)], cap=False)
        dome(m, ax, ay, 5.5, 6.0, 2.2, n=24, k=5)
        with m.at(ax, ay - 6.1, 0):
            with m.use('glow'):
                m.box(-1.5, 1.5, -0.3, 0, 4.7, 5.5, 't_red', bottom=True)
            m.text('ON AIR', 0.55, 0, 4.85, 'trim', y=-0.33, mat='glow', bold=0.03)
        m.flag(-W / 2 + 5, Dp / 2 - 4, 9.5, D)
        round_paving(m, -W / 2 + 9, -Dp / 2 + 8, 4.5, 0.0, n=20, rings=(0.6,), spokes=6)
        fountain_pool(m, -W / 2 + 9, -Dp / 2 + 8, 2.4, 0.0, n=16)
        flag_row(m, cx - 4, -Dp / 2 + 2.6, (D, 't_pink', 't_yel'), 8.0, 2.4)
    street(m, W, Dp, L)
    m.pop()


# ================================================================== GAMES (orange)
@building('stickers', 'games')
def b_stickers(m, L):
    """Toy shop: a playful shop made of simple toy shapes, with giant stickers on the front."""
    D = 'd_games'
    W, Dp = {3: (24, 20), 4: (38, 30), 5: (50, 36)}[L]
    ph = fpad(m, W, Dp, 7)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    s = 0.68 if L == 3 else 1.0
    cy = 3.0
    # a soft cube, a cylinder with a cone hat, a ball on top
    soft(m, -3.5 * s, cy, 12 * s, 10 * s, 0, 8 * s, P, r=1.6 * s)
    drum(m, 6.5 * s, cy + 0.5, 0, 11 * s, 4.6 * s, n=28)
    m.lathe(6.5 * s, cy + 0.5, [(5.6 * s, 11 * s), (0.0, 18.5 * s)], 28, [shade(D, 0.9), tint(D, 0.2)], bottom=True)
    m.ball(6.5 * s, cy + 0.5, 19.0 * s, 0.9 * s, 't_yel', n=12, rings=6)
    strip(m, 6.5 * s, cy + 0.5, 10.3 * s, 4.6 * s, 't_teal', 0.4, n=28)
    m.ball(-6.5 * s, cy - 1 * s, 8 * s + 2.2 * s, 2.6 * s, shade('t_teal', 0.88), n=20, rings=10, col1=tint('t_teal', 0.2))
    with m.at(-3.5 * s, cy - 5 * s, 0):
        st_sunflower(m, -3.2 * s, 5.4 * s, 0, 1.5 * s)
        st_duck(m, 0.6 * s, 5.5 * s, 0, 1.45 * s)
        if L > 3:
            st_boat(m, 3.9 * s, 5.4 * s, 0, 1.3 * s)
        glazing(m, -5.1 * s, -0.1 * s, 0.7, 0.7 + 2.6 * s, 0.0, bay=1.25, lit=0.3)
    m.rbox(-3.5 * s, cy, 12 * s + 0.5, 10 * s + 0.5, 0, 0.3, 'plinth', r=1.6 * s + 0.25, seg=2, top=False)
    plinth_ring(m, 6.5 * s, cy + 0.5, 4.6 * s, 28, h=0.3)
    downpipe(m, -3.5 * s - 6 * s + 0.6, cy + 5 * s + 0.05, 8 * s - 0.4)
    with m.at(6.5 * s, cy + 0.5 - 4.6 * s, 0):
        if L > 3:
            st_dog(m, 0, 7.6, -0.1, 1.5)
    portal(m, 1.4 * s, cy - 5 * s - 0.2, D, w=2.2 * max(s, 0.85), name='Sticker Scenes' if L > 3 else None, size=0.62)
    paving(m, -1.8, 1.8, -Dp / 2 + 0.3, cy - 5 * s - 3.1, 0.0, every=2.0)
    if L > 3:
        paving(m, -1.8, 1.4 * s + 1.8, cy - 5 * s - 5.0, cy - 5 * s - 3.1, 0.0, along='x', edge=None)
    toy_block(m, -W / 2 + 4.5, -Dp / 2 + 5, 0, 2.0, 't_blue', 0.3, 'star')
    if L > 3:
        toy_block(m, -W / 2 + 4.7, -Dp / 2 + 5.1, 2.0, 1.6, 't_red', -0.2, 'heart')
        toy_duck(m, W / 2 - 6, -Dp / 2 + 6, 0, 1.2, -math.pi / 2 - 0.3)
    if L == 5:
        ax, ay = -W / 2 + 9, 6
        m.ball(ax, ay, 4.2, 5.0, shade('t_yel', 0.9), n=24, rings=12, col1=tint('t_yel', 0.25))
        m.cyl(ax, ay, 0, 0.6, 3.4, 20, PS)
        with m.at(ax, ay - 4.7, 0):
            round_win(m, 0, 4.4, 1.3, y=0.0)
        portal(m, ax, ay - 4.3, D, w=2.2)
        for px_, py_ in ((-W / 2 + 3, -Dp / 2 + 3), (-W / 2 + 14, -Dp / 2 + 3)):
            m.cyl(px_, py_, 0, 4.8, 0.08, 5, 'pale_metal', cap=False)
        m.bunting((-W / 2 + 3, -Dp / 2 + 3, 4.6), (-W / 2 + 14, -Dp / 2 + 3, 4.6), TOY, sag=0.9, n=9)
        m.flag(W / 2 - 4, Dp / 2 - 4, 9, D)
        for i in range(3):
            m.balloon(W / 2 - 10 + i * 0.9, -Dp / 2 + 9 - (i % 2) * 0.5, 6.0 + (i % 2) * 0.9, TOY[i * 2 + 1], 0.7, anchor=(W / 2 - 9.4, -Dp / 2 + 9, 0.3))
    street(m, W, Dp, L, trees=L > 3)
    m.pop()


@building('party', 'games')
def b_party(m, L):
    """Party house: a round house under a dome, with strings of lights and a few balloons. A one-phone party game."""
    D = 'd_games'
    W, Dp = {3: (26, 22), 4: (40, 32), 5: (52, 38)}[L]
    ph = m.pad(W, Dp, col='grass_g', r=8, seg=5)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    R, h = (5.2, 4.2) if L == 3 else (8.0, 5.4)
    cy = 3.5
    amber = mixc('pane', 'lamp_warm', 0.3)
    paving(m, -1.8, 1.8, -Dp / 2 + 0.3, cy - R - 2.8, 0.0, col='pave_light', every=1.8)
    round_paving(m, 0, cy, R + 2.2, 0.0, n=32, col='pave_light', rings=(), spokes=0, r_in=R)
    plinth_ring(m, 0, cy, R, 32, h=0.35)
    drum(m, 0, cy, 0, h, R, n=32)
    with m.use('glow'):
        for k in range(8):
            a = -math.pi / 2 + (k + 0.5) * math.pi / 4
            if abs(k - 7.5) < 1 or k == 0:
                continue
            with m.at(R * math.cos(a), cy + R * math.sin(a), 0, a + math.pi / 2):
                m.plate(disc2(0, h * 0.55, 1.0, 14), 0.05, 0.14, amber, edge=P)
    strip(m, 0, cy, h - 0.1, R + 0.02, D, 0.4, n=32)
    ring_beam(m, 0, cy, h + 0.3, R + 0.2, 32, h=0.35, out=0.35)
    dome(m, 0, cy, h + 0.3, R + 0.5, R * 0.8, col=P, n=32, k=7)
    m.lathe(0, cy, [(1.4, h + 0.3 + R * 0.78), (1.4, h + R * 0.8 + 0.9), (0.0, h + R * 0.8 + 1.5)], 12, [P, D, tint(D, 0.2)], cap=False)
    tr = R * 0.45
    tx, ty = R * 0.95, cy - R * 0.55
    th_ = h + R * 0.5 + (6 if L > 3 else 3)
    plinth_ring(m, tx, ty, tr, 24, h=0.35)
    drum(m, tx, ty, 0, th_, tr, n=24)
    ring_beam(m, tx, ty, th_, tr + 0.2, 24, h=0.3, out=0.3)
    with m.use('glow'):
        for zz in ((th_ - 2.2, th_ - 5.6) if L > 3 else (th_ - 2.2,)):
            m.lathe(tx, ty, [(tr + 0.04, zz - 0.9), (tr + 0.04, zz + 0.3)], 24, amber, cap=False)
    dome(m, tx, ty, th_, tr + 0.5, (tr + 0.5) * 1.0, col=D, n=24, k=6)
    m.cyl(tx, ty, th_ + tr, th_ + tr + 2.6, 0.06, 4, P, cap=False)
    if L == 5:
        with m.use('glow'):
            m.ball(tx, ty, th_ + tr + 2.9, 0.8, 'steel_light', n=10, rings=6, col1='trim')
    portal(m, 0, cy - R - 0.2, D, w=2.2, name='One Too Far' if L > 3 else 'PARTY', size=0.62)
    lp = [(-W / 2 + 3, -Dp / 2 + 3), (W / 2 - 3, -Dp / 2 + 3)]
    for lx, ly in lp:
        m.cyl(lx, ly, 0, 0.4, 0.3, 6, 'plinth')
        m.cyl(lx, ly, 0.4, 6.0, 0.09, 5, 'pale_metal', cap=False)
    bulbs = ['lamp_warm', 't_pink', 't_teal', 't_yel']
    m.string_lights((tx, ty - tr, th_ - 0.3), (lp[1][0], lp[1][1], 5.9), sag=1.4, n=7, cols=bulbs)
    m.string_lights((tx - tr, ty, th_ - 0.3), (lp[0][0], lp[0][1], 5.9), sag=2.0, n=10 if L > 3 else 7, cols=bulbs)
    if L > 3:
        m.string_lights((lp[0][0], lp[0][1], 5.9), (lp[1][0], lp[1][1], 5.9), sag=1.3, n=12, cols=bulbs)
    bcols = ['t_red', 't_yel', 't_blue', 't_green', 't_pink', 't_purple', 't_teal', 't_orange']
    ax, ay = -3.5, cy - R - 1.5
    for i in range(3):
        m.balloon(ax + (i - 1) * 0.95, ay + (i % 2) * 0.5, 5.4 + (i % 2) * 0.9, bcols[i], 0.72, anchor=(ax, ay, 0.2))
    if L > 3:
        for i, (suit, sc) in enumerate((('heart', 't_red'), ('star', 't_purple'))):
            with m.at(-R - 2.5 - i * 2.6, cy - R + 1, 0, 0.3 - i * 0.5):
                card(m, 0, 1.75, 2.1, 3.1, 0, 'trim', suit, sc)
                m.beam((0, 0.1, 2.4), (0, 1.3, 0), 0.12, 0.12, PS)
        umbrella_table(m, W / 2 - 8, -Dp / 2 + 9, 0, col=D)
        m.tree(-W / 2 + 4.5, Dp / 2 - 4.5, 0.95)
    if L == 5:
        ex, ey = -W / 2 + 10, cy + 3
        plinth_ring(m, ex, ey, 5.2, 24, h=0.4)
        dome(m, ex, ey, 0.4, 5.2, 4.4, col=P, n=24, k=6)
        strip(m, ex, ey, 0.5, 5.25, D, 0.3, n=24)
        with m.at(ex - 2.6, ey - 4.3, 0, -0.5):
            round_win(m, 0, 2.4, 0.9, y=0.25, col=amber)
        portal(m, ex + 0.8, ey - 5.2, D, w=2.2)
        paving(m, ex - 1.0, ex + 2.6, -Dp / 2 + 0.3, ey - 8.0, 0.0, col='pave_light', every=1.8)
        for i in range(5):
            m.balloon(ex + 6 + (i - 2) * 0.9, ey - 8 + (i % 2) * 0.5, 4.8 + (i % 3) * 0.8, bcols[3 + i], 0.7, anchor=(ex + 6, ey - 7.8, 0.1))
        m.flag(W / 2 - 4, Dp / 2 - 4, 9, D)
        m.rbox(W / 2 - 11, Dp / 2 - 9, 9.0, 7.0, 0, 0.3, 'deck_wood', r=1.5, seg=2)         # a dance deck under the lights
        with m.use('glow'):
            m.box(W / 2 - 15.3, W / 2 - 6.7, Dp / 2 - 12.4, Dp / 2 - 12.3, 0.1, 0.25, D)
        for k in range(3):
            umbrella_table(m, W / 2 - 14 + k * 3.2, Dp / 2 - 7.5, 0.3, col=D)
    m.pop()


# ================================================================== HEALTHCARE AI (green)
@building('duiyao', 'health')
def b_duiyao(m, L):
    """Pharmacy: the building is a pill, a capsule lying on its side, half green and half white, with a green cross."""
    D = 'd_health'
    W, Dp = {3: (26, 20), 4: (40, 28), 5: (52, 34)}[L]
    ph = fpad(m, W, Dp, 7)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    Lc, r = (15.0, 3.6) if L == 3 else (25.0, 5.2)
    cy = 3.0
    zc = r * 0.82
    capsule(m, 0, cy, zc, L=Lc, r=r, col_a=D, col_b=P, n=28)
    m.rbox(0, cy, Lc - 2 * r + 2, r * 1.5, 0, 0.5, PS, r=0.8, seg=3)
    for sx in (-1, 1):                           # two cradles under the pill's rounded ends
        m.rbox(sx * (Lc / 2 - r * 0.9), cy, r * 0.9, r * 1.3, 0, 0.9, 'plinth', r=0.4, seg=2)
    with m.at(0, cy - r * 0.985, 0):
        with m.use('glow'):
            m.plate(rrect2(Lc * 0.2, zc + 0.2, Lc * 0.3, r * 0.62, 0.7, 3), 0.05, 0.12, 'pane', edge=P)
            m.plate(rrect2(-Lc * 0.2, zc + 0.2, Lc * 0.3, r * 0.62, 0.7, 3), 0.05, 0.12, mixc('pane', D, 0.2), edge=tint(D, 0.5))
    portal(m, 0, cy - r - 0.15, D, w=2.4, name='PHARMACY' if L > 3 else None, size=0.7)
    paving(m, -1.9, 1.9, -Dp / 2 + 0.3, cy - r - 3.0, 0.0, every=2.0)
    if L > 3:                                    # a pill-shaped sign on two posts by the street
        sx_, sy_ = -W / 2 + 6.5, -Dp / 2 + 3.2
        for dx in (-1.2, 1.2):
            m.cyl(sx_ + dx, sy_, 0, 1.6, 0.07, 5, 'pale_metal', cap=False)
        capsule(m, sx_, sy_, 2.15, L=3.8, r=0.6, col_a=D, col_b=P, n=12)
        m.cbox(sx_, sy_, 3.0, 0.5, 0, 0.25, 'plinth')
    cs = 2.4 if L == 3 else 3.4
    px, py = Lc / 2 + 1.5, cy - r - 0.5
    m.cyl(px, py, 0, 0.4, 0.45, 8, 'plinth')
    m.cyl(px, py, 0.4, zc * 2 + 2.0, 0.2, 8, 'pale_metal', cap=False)
    cross3d(m, px, py, zc * 2 + 2.0 + cs / 2 - 0.3, s=cs, t=cs * 0.34, d=0.6, col=D)
    ms = 1.0 if L > 3 else 0.75
    gx, gy = -Lc / 2 - 1.5, cy - r - 2.2
    medicine_box(m, gx, gy, 0, 2.8 * ms, 1.5 * ms, 3.8 * ms, 0.25, col=P)
    with m.at(gx, gy, 0, 0.25):
        with m.use('glow'):
            fw_, fh_, yv = 2.4 * ms, 2.9 * ms, -1.4 * ms
            for sx in (-1, 1):
                for sz in (-1, 1):
                    cxv, czv = sx * fw_, 2.1 * ms + sz * fh_
                    m.fq(min(cxv, cxv - sx * 0.9 * ms), max(cxv, cxv - sx * 0.9 * ms), czv - 0.09, czv + 0.09, yv, 'lamp')
                    m.fq(cxv - 0.09, cxv + 0.09, min(czv, czv - sz * 0.9 * ms), max(czv, czv - sz * 0.9 * ms), yv, 'lamp')
        for sx in (-1, 1):
            m.cyl(sx * 2.4 * ms, -1.4 * ms + 0.05, 0, 5.0 * ms, 0.06, 4, PS, cap=False)
    if L > 3:
        scooter(m, Lc / 2 - 2, cy - r - 3.5, 0, 0.4)
        bowl(m, -5, cy - r - 3.0, 1.3, plant='leaf_light', flowers='flower_white')
    if L == 5:
        ax, ay = W / 2 - 9, Dp / 2 - 10
        plinth_ring(m, ax, ay, 6.0, 24, h=0.4)
        dome(m, ax, ay, 0.4, 6.0, 5.0, n=24, k=6)
        strip(m, ax, ay, 0.5, 6.05, D, 0.3, n=24)
        with m.at(ax + 2.6, ay - 5.0, 0, 0.45):
            round_win(m, 0, 2.6, 1.0, y=0.3)
        portal(m, ax - 1.0, ay - 6.0, D, w=2.2)
        capsule(m, -W / 2 + 8, Dp / 2 - 6, 1.6, L=7.0, r=1.4, col_a=P, col_b=D, n=16)
        m.cbox(-W / 2 + 8, Dp / 2 - 6, 3.0, 1.0, 0, 0.4, PS)
        for i in range(3):
            bowl(m, -W / 2 + 6 + i * 4.0, -Dp / 2 + 4, 1.3, plant='leaf_light', flowers=('flower_white', 'flower_yel', 'flower_pink')[i])
        m.flag(W / 2 - 4, -Dp / 2 + 5, 9, D)
        round_paving(m, W / 2 - 10, -Dp / 2 + 8, 4.5, 0.0, n=20, rings=(0.6,), spokes=6)
        fountain_pool(m, W / 2 - 10, -Dp / 2 + 8, 2.4, 0.0, n=16)
        seat(m, W / 2 - 10, -Dp / 2 + 3.2, 0.0, 2.2)
    street(m, W, Dp, L, trees=L > 3)
    m.pop()


@building('hackathons', 'health', site='site_large')
def b_hackathons(m, L):
    """Event hall: a wide lens-shaped hall with fins of light and a forecourt. Healthcare AI hackathons."""
    D = 'd_health'
    W, Dp = {3: (38, 30), 4: (64, 46), 5: (74, 52)}[L]
    ph = fpad(m, W, Dp)
    set_door(m, 0, -Dp / 2)
    m.push(0, 0, ph)
    R, sy, hh = (12.5, 0.6, 6.0) if L == 3 else (25.0, 0.56, 9.5)
    cx = 0 if L < 5 else -3
    cy = Dp / 2 - R * sy - 3.5
    n = 40
    drum(m, cx, cy, 0, 0.9, R + 0.3, n=n, sy=sy)
    gband(m, cx, cy, 0.9, 4.2, R - 0.4, n=n, sy=sy, lit=0.3, mull=2)
    # the lens: a shallow dome that overhangs the glass like a brim
    m.lathe(cx, cy, [(R - 0.5, 4.2), (R + 1.6, 4.5)], n, [shade(P, 0.72), shade(P, 0.85)], cap=False, sy=sy)
    dome(m, cx, cy, 4.5, R + 1.6, hh - 4.5, n=n, k=7, sy=sy)
    strip(m, cx, cy, 4.2, R + 1.45, D, 0.3, n=n, sy=sy) if False else None
    with m.use('glow'):
        m.lathe(cx, cy, [(R + 1.62, 4.42), (R + 1.66, 4.62)], n, D, cap=False, sy=sy)
    for b in (0.5, 1.0):
        m.lathe(cx, cy, [((R + 1.63) * math.cos(b), 4.5 + (hh - 4.5) * math.sin(b) - 0.02), ((R + 1.63) * math.cos(b + 0.01), 4.5 + (hh - 4.5) * math.sin(b + 0.01) + 0.05)], n, 'seam', cap=False, sy=sy)
    # the brim is carried on a ring of slim columns standing outside the glass, not on the glass
    for k in range(18 if L > 3 else 12):
        a = 2 * math.pi * (k + 0.5) / (18 if L > 3 else 12)
        if abs(math.sin(a) + 1) < 0.02:
            continue
        col_at(m, cx + (R + 0.6) * math.cos(a), cy + (R + 0.6) * sy * math.sin(a), 0.9, 4.25, 0.16)
    plinth_ring(m, cx, cy, R + 0.3, n, sy=sy, h=0.25, out=0.5)
    portal(m, cx, cy - R * sy - 0.1, D, w=4.0 if L > 3 else 3.0, name='HACKATHON', size=0.85 if L > 3 else 0.6)
    paving(m, cx - 3.0, cx + 3.0, -Dp / 2 + 0.3, cy - R * sy - 3.0, 0.0, every=2.2)
    # fins of light along the forecourt, each with a small emblem
    nb = 2 if L == 3 else (4 if L == 4 else 6)
    by = -Dp / 2 + (3.5 if L == 3 else 4.5)
    for i, bx in enumerate(row(nb, (W - 10) * nb / (nb - 1) if nb > 1 else 0)):
        if abs(bx) < 4:
            continue
        fh_ = 7.0 if L == 3 else 9.5
        with m.at(bx, by, 0):
            m.rbox(0, 0, 2.0, 1.0, 0, 0.35, 'plinth', r=0.3, seg=2)
            m.plate([(-0.5, 0), (0.5, 0), (0.75, fh_ * 0.55), (0.2, fh_), (-0.2, fh_), (-0.75, fh_ * 0.55)], 0.2, 0.4, P, back=True)
            with m.use('glow'):
                gp = [(-0.3, 1.0), (0.3, 1.0), (0.48, fh_ * 0.55), (0.08, fh_ - 0.5), (-0.08, fh_ - 0.5), (-0.48, fh_ * 0.55)]
                m.poly([(x, -0.22, z) for x, z in gp], D if i % 2 == 0 else tint(D, 0.3))
                m.poly([(x, 0.22, z) for x, z in gp][::-1], D if i % 2 == 0 else tint(D, 0.3))
                m.poly([(x, -0.25, z) for x, z in (cross2(0, fh_ * 0.42, 0.7, 0.22) if i % 3 == 0 else heart2(0, fh_ * 0.42, 0.34) if i % 3 == 2 else disc2(0, fh_ * 0.42, 0.3, 10))], 'trim')
    for sx in (-1, 1):
        bowl(m, cx + sx * (6 if L == 3 else 10), cy - R * sy - 3.0, 1.5, plant='leaf_light')
    if L > 3:
        for tx in (-16, 16):
            with m.at(tx + cx, cy - R * sy - 6.5, 0):
                m.rbox(0, 0, 3.6, 1.5, 0.95, 1.1, P, r=0.6, seg=3, bottom=True)
                m.cyl(0, 0, 0, 0.95, 0.2, 6, PS, cap=False)
                for lx in (-0.9, 0.9):
                    with m.use('glow'):
                        m.poly([(lx - 0.35, 0.27, 1.12), (lx + 0.35, 0.27, 1.12), (lx + 0.35, 0.42, 1.6), (lx - 0.35, 0.42, 1.6)], 'glass_c')
                    m.poly([(lx + 0.35, 0.29, 1.12), (lx - 0.35, 0.29, 1.12), (lx - 0.35, 0.44, 1.6), (lx + 0.35, 0.44, 1.6)], 'brushed')
    if L == 5:
        tx, ty = W / 2 - 7, cy - 2
        plinth_ring(m, tx, ty, 2.6, 20, h=0.4)
        m.lathe(tx, ty, [(2.6, 0), (2.0, 16.0), (2.0, 17.0)], 20, [PS, P, P], cap=False)
        with m.at(tx, ty - 2.5, 0):
            m.door(0, 1.2, 2.25, col='pearl_hi', glass=0.8, y=0.0, fw=0.1, dep=0.05, pane='glass_b', knob=None)
        with m.use('glow'):
            m.lathe(tx, ty, [(2.0, 17.0), (2.0, 19.4)], 20, 'lamp', cap=False)
        dome(m, tx, ty, 19.4, 2.5, 2.0, col=D, n=20, k=5)
        cross3d(m, tx, ty - 2.4, 12.5, s=2.4, t=0.82, d=0.4, col=D)
        with m.at(cx + R * 0.45, cy - R * sy * 0.92, 0):
            m.rbox(0, 0.2, 10.4, 0.6, hh - 2.2, hh + 3.2, 'iron', r=0.5, seg=3, bottom=True)
            with m.use('glow'):
                m.plate(rrect2(0, hh + 0.5, 9.6, 4.6, 0.4, 3), -0.1, 0.05, shade(D, 0.5))
            pulse_line(m, 0, hh + 0.5, -0.2, 8.0, 2.8, 'lamp', 0.26)
            for px in (-3.6, 3.6):
                m.cyl(px, 0.4, 4.0, hh - 2.2, 0.16, 5, P, cap=False)
        for i, fc in enumerate((D, 't_blue', 't_yel', 't_red')):
            m.flag(-W / 2 + 4 + i * 3.2, Dp / 2 - 5, 10, fc)
    street(m, W, Dp, L, trees=False)
    m.pop()


# ================================================================== level 3: each project's first building
# A modest first building: one simple volume with the project's idea in its smallest form, honest detail at human
# scale, and room visibly left on the plot to grow (a lawn with a line of light where the next phase will stand).
def first(pid):
    def deco(fn):
        FIRST[pid] = fn
        return fn
    return deco


def grow_here(m, cx, cy, w, d, r=2.0, round_=False):
    """Room to grow: a lawn with a line of light round the footprint of the next phase, and two slim markers."""
    if round_:
        outer, inner = ngon(w / 2, 24, cx, cy), ngon(w / 2 - 0.25, 24, cx, cy)
        m.cap(ngon(w / 2 + 0.6, 24, cx, cy), 0.03, 'grass_g')
    else:
        outer, inner = rrect(w, d, r, 3, cx, cy), rrect(w - 0.5, d - 0.5, max(r - 0.25, 0.05), 3, cx, cy)
        m.cap(rrect(w + 1.2, d + 1.2, r + 0.6, 3, cx, cy), 0.03, 'grass_g')
    with m.use('glow'):
        m.cap_ring(outer, inner, 0.06, 'lamp')
    for sx in (-1, 1):
        x_ = cx + sx * (w / 2 + 0.3)
        m.cyl(x_, cy - (0 if round_ else d / 2) , 0, 1.3, 0.1, 6, P, cap=False)
        with m.use('glow'):
            m.cyl(x_, cy - (0 if round_ else d / 2), 1.3, 1.5, 0.12, 6, 'lamp')


def first_street(m, W, Dp, dx, walk_to):
    """The walk from the street to the door, one lamp, a bench, bike hoops."""
    paving(m, dx - 1.8, dx + 1.8, -Dp / 2 + 0.3, walk_to, 0.0, every=2.0)
    lamp(m, W / 2 - 3, -Dp / 2 + 3)
    seat(m, -W / 2 + 4.5, -Dp / 2 + 3.0, 0.0, 2.0)
    bike_hoops(m, dx + 4.2, -Dp / 2 + 3.5, 3)


@first('hirvo')
def f_hirvo(m, L):
    """Hirvo's first office: a two-storey round glass pavilion with a railed roof terrace and a small halo."""
    D, W, Dp = 'd_software', 36, 30
    m.push(0, 0, fpad(m, W, Dp))
    cx, cy, R = 0, 0.5, 5.5
    plinth_ring(m, cx, cy, R, 28)
    gband(m, cx, cy, 0.45, 3.4, R, n=28, lit=0.3, mull=1)
    m.lathe(cx, cy, [(R, 3.4), (R, 4.0)], 28, P, cap=False)
    gband(m, cx, cy, 4.2, 6.9, R, n=28, lit=0.2, mull=1)
    disc(m, cx, cy, 7.0, R + 1.0, 0.6)
    rail_ring(m, cx, cy, 7.6, R + 0.6, n=24)
    m.cyl(cx + 1.5, cy + 1.5, 7.6, 10.6, 0.12, 6, 'pale_metal', cap=False)
    halo(m, cx + 1.5, cy + 1.5, 10.6, 1.6, D, r=0.18, n=16)
    roof_kit(m, cx - 2.0, cy + 2.0, 7.6, 0.55, vents=1)
    portal(m, cx, cy - R - 0.2, D, name='Hirvo', size=0.8)
    set_door(m, cx, -Dp / 2)
    first_street(m, W, Dp, cx, cy - R - 3.4)
    grow_here(m, 10.5, 4.0, 11.0, 0, round_=True)
    page_icon(m, cx + 7.5, 2.6, cy - R - 3.0, 1.6, 2.1)
    for sx in (-0.5, 0.5):
        m.cyl(cx + 7.5 + sx, cy - R - 2.9, 0, 2.6, 0.06, 5, 'pale_metal', cap=False)
    m.pop()


@first('trade')
def f_trade(m, L):
    """The first harbour shed: one small smooth vault with a loading door and one crane on a short quay."""
    D, W = 'd_software', 44
    m.ground_z = None
    m.ao_cell = 6.5
    front, quay = -17, 22
    ph = m.pad(W, quay - front, cy=(front + quay) / 2, skirt=9.0, col='pave_light', r=6, seg=4)
    set_door(m, 0, front)
    m.meta['quayEdge'] = round(-quay, 1)
    m.push(0, 0, ph)
    sw, sd, rh = 18.0, 11.0, 7.0
    x0, x1, y0, y1 = -sw / 2, sw / 2, -sd / 2, sd / 2
    Pv = m.vault(x0, x1, y0, y1, 0.0, rh, P, axis='x', n=12, over=0.8, end=None, th=0.4, ribs=0)
    for sx in (-1, 1):
        xx = sx * (sw / 2 - 0.3)
        with m.use('glass'):
            m.poly([(xx, y * 0.95, z * 0.95) for y, z in Pv][::(1 if sx < 0 else -1)], 'glass_b')
        for k in (3, 6, 9):
            m.beam((xx + sx * 0.1, Pv[k][0] * 0.95, 0), (xx + sx * 0.1, Pv[k][0] * 0.95, Pv[k][1] * 0.95), 0.18, 0.18, P)
    for yy, sg in ((Pv[0][0], -1), (Pv[-1][0], 1)):
        m.box(x0 - 0.3, x1 + 0.3, min(yy, yy + sg * 0.8), max(yy, yy + sg * 0.8), 0, 0.35, 'plinth', top='kerb')
    with m.at(3.5, y0 + 0.3, 0):
        m.rbox(0, 0.6, 6.0, 2.2, 0, 5.4, P, r=0.7, seg=2, bev=0.3)
        m.fq(-2.4, 2.4, 0, 4.4, -0.52, 'brushed')
        for k in range(3):
            m.fq(-2.4, 2.4, 1.0 + k * 1.1, 1.06 + k * 1.1, -0.54, 'seam')
    portal(m, -4.0, y0 - 0.2, D, w=2.2, name='HARBOUR', size=0.6)
    paving(m, -5.8, -2.2, front + 0.3, y0 - 3.2, 0.0, every=2.0)
    for k in range(2):
        pod_box(m, -13, sd / 2 + 4 + k * 2.8, 0, P, 6.2, band=(D, 't_orange')[k])
    quay_crane(m, 6, quay - 7.5, 0, s=0.55, col=P, boom=18)
    m.box(-W / 2 + 3, W / 2 - 3, quay - 1.0, quay - 0.5, 0, 0.06, 'hazard')
    for bx in row(4, W - 10):
        bollard(m, bx, quay - 1.8, col='brushed')
    px, pl, pw = -13, 34, 7.0
    m.box(px - pw / 2, px + pw / 2, quay - 0.5, quay + pl, -0.75, 0.05, P, bottom=True)
    for k in range(int(pl // 9) + 1):
        for sx in (-1, 1):
            m.cyl(px + sx * (pw / 2 - 0.7), min(quay + 3 + k * 9, quay + pl - 1), -9.5, -0.75, 0.5, 6, PS, cap=False)
    lamp(m, px, quay + pl - 1.2, 4.5, z=0.05)
    grow_here(m, 14.0, -7.0, 14.0, 9.0)
    lamp(m, W / 2 - 4, front + 3.5)
    m.pop()


@first('court')
def f_court(m, L):
    """The first court: one fenced half-court with floodlights and a small changing pavilion."""
    D, W, Dp = 'd_software', 38, 46
    m.push(0, 0, fpad(m, W, Dp))
    set_door(m, 0, -Dp / 2)
    cw, cd = 14.0, 13.0
    ccx, ccy = -8.5, -6.0
    half_court(m, ccx, ccy, cw, cd, 'court_red', 'A')
    fx_, fy_ = cw / 2 + 0.7, cd / 2 + 0.7
    pts = [(ccx + fx_ - 2.0, ccy - fy_), (ccx + fx_, ccy - fy_), (ccx + fx_, ccy + fy_), (ccx - fx_, ccy + fy_), (ccx - fx_, ccy - fy_), (ccx - fx_ + 2.0, ccy - fy_)]
    rail_line(m, pts, 0.0, 3.0, post=99)
    for p_ in pts:
        m.cyl(p_[0], p_[1], 0, 3.0, 0.07, 5, 'pale_metal', cap=False)
    floodlight(m, ccx - fx_ - 0.6, ccy - fy_ - 0.6, 10, math.pi * 0.75 + math.pi)
    # the pavilion: changing rooms and a booking desk under a soft roof
    px, py = 6.5, -4.0
    soft(m, px, py, 8.0, 5.0, 0, 3.4, P, r=1.2)
    with m.side('front', px - 4, px + 4, py - 2.5, py + 2.5) as Lw:
        glazing(m, -3.4, 0.6, 0.8, 2.6, 0.0, bay=1.3, lit=0.3)
    disc(m, px, py - 0.5, 3.4, 5.6, 0.4, sy=0.7)
    portal(m, px + 2.2, py - 2.6, D, w=2.0, name='COURTS', size=0.55)
    m.cyl(px + 4.5, py + 2.0, 0, 0.5, 1.0, 10, PS)
    m.ball(px + 4.5, py + 2.0, 1.7, 1.2, shade('t_orange', 0.85), n=12, rings=7, col1='t_orange')
    paving(m, -1.8, 1.8, -Dp / 2 + 0.3, py - 5.6, 0.0, every=2.0)
    paving(m, -1.8, px + 4.0, py - 7.4, py - 5.6, 0.0, along='x', edge=None)
    lamp(m, W / 2 - 3, -Dp / 2 + 3)
    seat(m, ccx, ccy + fy_ + 1.0, math.pi, 3.0, back=False)
    grow_here(m, 2.0, 11.5, 20.0, 0, round_=True)
    m.pop()


@first('uhome')
def f_uhome(m, L):
    """The first show home: one two-storey pod with a planted balcony, and a small glass welcome dome."""
    D, W, Dp = 'd_software', 36, 30
    m.push(0, 0, fpad(m, W, Dp))
    cx, cy, pw, pd, phh = -5.25, 3.0, 10.5, 11.0, 3.7
    for f in range(2):
        z = 0.3 + f * phh
        off = -1.2 if f == 0 else 0.0
        soft(m, cx, cy + off, pw, pd, z, z + phh - 0.45, P, r=2.2, seg=2)
        if f:
            m.rbox(cx, cy - 0.6, pw - 1.6, pd - 2.0, z - 0.47, z, 'seam', r=1.4, seg=1, top=False)
        with m.side('front', cx - pw / 2, cx + pw / 2, cy + off - pd / 2, cy + off + pd / 2, z) as Lw:
            m.plate(rrect2(0, (phh - 0.45) / 2, Lw - 3.2, phh - 1.5, 0.7, 2), 0.0, 0.12, 'glass_b' if f else 'lit_pane', edge=P)
            m.fq(-0.05, 0.05, 0.75, phh - 1.2, -0.14, P)
    zb_ = 0.3 + phh - 0.45
    yb_ = cy - 1.2 - pd / 2 + 0.25
    rail_line(m, [(cx - pw / 2 + 1.6, yb_ + 1.1), (cx - pw / 2 + 0.9, yb_), (cx + pw / 2 - 0.9, yb_), (cx + pw / 2 - 1.6, yb_ + 1.1)], zb_)
    m.rbox(cx - 2.8, yb_ + 0.6, 1.8, 0.6, zb_, zb_ + 0.45, PS, r=0.2, seg=1, top='soil')
    m.bush(cx - 2.8, yb_ + 0.6, 0.55, z=zb_ + 0.4)
    zt = 0.3 + 2 * phh - 0.45
    garden(m, cx, cy - 0.6, zt, 3.6, 3, trees=False)
    rail_line(m, [(cx - pw / 2 + 0.5, cy - pd / 2 + 0.5), (cx + pw / 2 - 0.5, cy - pd / 2 + 0.5), (cx + pw / 2 - 0.5, cy + pd / 2 - 0.5), (cx - pw / 2 + 0.5, cy + pd / 2 - 0.5)], zt, closed=True)
    ex, ey = cx, cy - 1.2 - pd / 2 - 3.6
    plinth_ring(m, ex, ey, 3.2, 20, h=0.4)
    dome(m, ex, ey, 0.4, 3.2, 2.8, mat='glass', col='glass_b', col1='glass_c', n=20)
    strip(m, ex, ey, 0.45, 3.25, D, 0.25, n=20)
    portal(m, ex, ey - 3.0, D, w=2.2, name='UHOME', size=0.6)
    set_door(m, ex, -Dp / 2)
    first_street(m, W, Dp, ex, ey - 6.0)
    grow_here(m, 10.0, 3.0, 13.0, 12.0)
    m.pop()


@first('pindou')
def f_pindou(m, L):
    """The first bead: one round shop with a porthole, a roof light in its hole, and a string of beads outside."""
    D, W, Dp = 'd_software', 24, 20
    m.push(0, 0, fpad(m, W, Dp, 7))
    bx, by, r = -2.5, 1.5, 4.2
    plinth_ring(m, bx, by, r * 0.66, 24, h=0.5)
    m.cyl(bx, by, 0, 0.5, r * 0.66, 24, PS, cap=False)
    m.ball(bx, by, r * 0.88, r, shade(P, 0.86), n=28, rings=14, col1=tint(P, 0.25))
    lip(m, bx, by, r * 0.88 + r * 0.98, r * 0.24, 12, out=0.12, h=0.18)
    with clear(m):
        m.cap(ngon(r * 0.24, 12, bx, by), r * 1.86, 'glass_c')
    with m.at(bx, by - r * 0.93, 0):
        round_win(m, r * 0.5, r * 1.05, r * 0.22)
    portal(m, bx, by - r * 0.9, D, w=2.2, size=0.6)
    set_door(m, 0, -Dp / 2)
    paving(m, -1.8, 1.8, -Dp / 2 + 0.3, by - r * 0.9 - 4.5, 0.0, every=2.0)
    paving(m, bx - 1.8, 1.8, by - r * 0.9 - 4.5, by - r * 0.9 - 2.8, 0.0, along='x', edge=None)
    rx, ry = -W / 2 + 3.0, -Dp / 2 + 4.0
    m.cyl(rx, ry, 0, 3.5, 0.1, 5, 'brushed')
    for i in range(3):
        giant_bead(m, rx, ry, 1.0 + i * 1.05, BEAD_COLS[(i * 2) % 8], R=0.85, n=12)
    lamp(m, W / 2 - 2.5, -Dp / 2 + 2.5)
    grow_here(m, 6.5, 3.0, 7.5, 0, round_=True)
    m.pop()


@first('books')
def f_books(m, L):
    """The first bookshop: a small round reading kiosk under one open-book canopy carried on four slim posts."""
    D, W, Dp = 'd_books', 30, 24
    m.push(0, 0, fpad(m, W, Dp))
    cx, cy, R, H = -4.0, 1.0, 4.2, 3.8
    plinth_ring(m, cx, cy, R, 24)
    gband(m, cx, cy, 0.45, 3.0, R, n=24, lit=0.35, mull=1)
    m.lathe(cx, cy, [(R, 3.0), (R, H)], 24, P, cap=True)
    with m.at(cx, cy, H + 0.6):                          # the canopy: an open book, pages rising from the spine
        for sx in (-1, 1):
            q = [(0, -R - 1.2, 0.3), (sx * (R + 1.8), -R - 1.2, 1.4), (sx * (R + 1.8), R + 1.2, 1.4), (0, R + 1.2, 0.3)]
            m.poly(q if sx > 0 else q[::-1], 'paper')
            m.poly([(p[0], p[1], p[2] - 0.3) for p in q][::-1 if sx > 0 else 1], D)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl(cx + sx * (R + 1.2), cy + sy * (R + 0.6), 0, H + 0.6 + 0.3 + 1.1 * (R + 1.2) / (R + 1.8) - 0.3, 0.09, 6, 'pale_metal', cap=False)
    m.cyl(cx, cy, H, H + 0.6, 0.4, 8, PS, cap=False)
    portal(m, cx, cy - R - 0.2, D, w=2.2, name='BOOKS', size=0.6)
    set_door(m, 0, -Dp / 2)
    paving(m, -1.8, 1.8, -Dp / 2 + 0.3, cy - R - 4.6, 0.0, every=2.0)
    paving(m, cx - 1.8, 1.8, cy - R - 4.6, cy - R - 2.9, 0.0, along='x', edge=None)
    giant_book(m, cx + R + 2.5, cy - R - 0.5, 0, 3.0, 2.2, 0.7, 't_red', 0.3)
    for k in range(2):
        seat(m, cx - R - 1.8, cy - 1.0 + k * 2.6, math.pi / 2, 1.8)
    lamp(m, W / 2 - 3, -Dp / 2 + 3)
    grow_here(m, 8.5, 2.0, 10.0, 0, round_=True)
    m.pop()


@first('bookflow')
def f_bookflow(m, L):
    """The first print works: one small shed under a single rolling wave of roof, with paper rolls at its dock."""
    D, W, Dp = 'd_books', 38, 30
    m.push(0, 0, fpad(m, W, Dp))
    cx, cy, sw, sd, sh = 1.0, 3.0, 14.0, 9.0, 4.6
    x0, x1, y0, y1 = cx - sw / 2, cx + sw / 2, cy - sd / 2, cy + sd / 2
    m.rbox(cx, cy, sw, sd, 0, sh, P, r=0.8, seg=2, top=False)
    m.box(x0 - 0.2, x1 + 0.2, y0 - 0.2, y1 + 0.2, 0, 0.3, 'plinth', top=False)
    n = 12
    pts = [(x0 - 0.8 + (sw + 1.6) * i / n, sh + 1.3 + 0.9 * math.sin(2 * math.pi * i / n - math.pi / 2)) for i in range(n + 1)]
    for (xa, za), (xb, zb) in zip(pts[:-1], pts[1:]):
        m.poly([(xa, y1 + 0.8, za), (xa, y0 - 1.0, za), (xb, y0 - 1.0, zb), (xb, y1 + 0.8, zb)], 'paper')
        m.poly([(xa, y0 - 1.0, za - 0.3), (xa, y1 + 0.8, za - 0.3), (xb, y1 + 0.8, zb - 0.3), (xb, y0 - 1.0, zb - 0.3)], D)
        m.poly([(xa, y0 - 1.0, za - 0.3), (xb, y0 - 1.0, zb - 0.3), (xb, y0 - 1.0, zb), (xa, y0 - 1.0, za)], D)
        with m.use('glass'):
            for yy, flip in ((y0 + 0.05, False), (y1 - 0.05, True)):
                q = [(xa, yy, sh), (xb, yy, sh), (xb, yy, max(sh + 0.05, zb - 0.3)), (xa, yy, max(sh + 0.05, za - 0.3))]
                m.poly(q[::-1] if flip else q, 'glass_c')
    for xx in (x0 + 0.4, cx, x1 - 0.4):
        for yy in (y0 + 0.3, y1 - 0.3):
            m.cyl(xx, yy, sh, sh + 0.4, 0.12, 6, 'pale_metal', cap=False)
    with m.side('front', x0, x1, y0, y1) as Lw:
        glazing(m, -Lw / 2 + 1.5, 1.5, 1.0, sh - 1.0, 0.0, bay=1.6, lit=0.25)
    portal(m, 7.0 if x1 - 2.5 > 7.0 else x1 - 2.5, y0 - 0.2, D, name='BookFlow', w=2.2, size=0.6)
    set_door(m, 7.0, -Dp / 2)
    paving(m, 5.2, 8.8, -Dp / 2 + 0.3, y0 - 3.1, 0.0, every=2.0)
    paper_roll(m, x0 - 2.2, y0 + 1.0, 0, 1.0, 2.0, upright=True)
    paper_roll(m, x0 - 2.0, y0 + 3.4, 0, 1.0, 2.0, upright=True)
    lamp(m, -W / 2 + 3, -Dp / 2 + 3)
    bike_hoops(m, 11.5, -Dp / 2 + 3.5, 3)
    grow_here(m, -11.0, 4.0, 10.0, 14.0)
    m.pop()


@first('ipad')
def f_ipad(m, L):
    """The first studio: one small white room with one curved skylight and an easel at the door."""
    D, W, Dp = 'd_books', 30, 24
    m.push(0, 0, fpad(m, W, Dp))
    cx, cy, w, d, h = -2.0, 2.5, 10.0, 7.0, 3.6
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
    soft(m, cx, cy, w, d, 0, h, P, r=1.6)
    m.box(x0 - 0.2, x1 + 0.2, y0 - 0.2, y1 + 0.2, 0, 0.3, 'plinth', top=False)
    Rg, nn = d * 0.45, 7
    xa, xb = x0 + 1.4, x1 - 1.4
    arc = [(cy + 0.4 - Rg * math.sin(math.pi / 2 * i / nn), h - 0.2 + Rg * 0.7 * math.cos(math.pi / 2 * i / nn)) for i in range(nn + 1)]
    for i in range(nn):
        (ya, za), (yb, zb) = arc[i], arc[i + 1]
        with m.use('glass'):
            m.poly([(xb, ya, za), (xa, ya, za), (xa, yb, zb), (xb, yb, zb)], 'glass_c')
    for xx in (xa, (xa + xb) / 2, xb):
        for i in range(nn):
            m.beam((xx, arc[i][0], arc[i][1]), (xx, arc[i + 1][0], arc[i + 1][1]), 0.16, 0.12, P)
    for xx in (xa, xb):
        with m.use('glass'):
            m.poly([(xx, cy + 0.4, h - 0.2)] + [(xx, y_, z_) for y_, z_ in arc][::(1 if xx == xb else -1)], 'glass_b')
    portal(m, cx + 2.5, y0 - 0.2, D, w=2.2, name='STUDIO', size=0.55)
    set_door(m, 0, -Dp / 2)
    paving(m, -1.8, 1.8, -Dp / 2 + 0.3, y0 - 4.5, 0.0, every=2.0)
    paving(m, -1.8, cx + 4.3, y0 - 4.5, y0 - 2.8, 0.0, along='x', edge=None)
    tablet_easel(m, x0 - 1.5, y0 - 3.0, 0.35, 0.6)
    downpipe(m, x0 + 0.5, y1 + 0.05, h - 0.3)
    lamp(m, W / 2 - 3, -Dp / 2 + 3)
    grow_here(m, 9.5, 3.0, 8.0, 12.0)
    m.pop()


@first('yae')
def f_yae(m, L):
    """The first museum room: a small glass dome on a low drum, with the mammoth skeleton out front."""
    D, W, Dp = 'd_film', 36, 32
    m.push(0, 0, fpad(m, W, Dp))
    cx, cy, R = 4.0, 4.0, 6.0
    plinth_ring(m, cx, cy, R, 28)
    drum(m, cx, cy, 0, 3.4, R, n=28)
    gband(m, cx, cy, 0.8, 2.8, R + 0.03, n=28, lit=0.25, mull=2)
    ring_beam(m, cx, cy, 3.7, R, 28, h=0.3)
    dome(m, cx, cy, 3.7, R * 0.95, R * 0.8, mat='glass', col='glass_b', col1='glass_c', n=28, k=6)
    for k in range(6):
        a = k * math.pi / 3
        m.tube([(cx + (R * 0.95 + 0.04) * math.cos(b) * math.cos(a), cy + (R * 0.95 + 0.04) * math.cos(b) * math.sin(a), 3.7 + (R * 0.8 + 0.04) * math.sin(b)) for b in [math.pi / 2 * t / 4 for t in range(5)]], 0.08, 3, P, caps=False)
    portal(m, cx, cy - R - 0.2, D, w=2.4, name='MUSEUM', size=0.6)
    set_door(m, 0, -Dp / 2)
    paving(m, -1.8, 1.8, -Dp / 2 + 0.3, cy - R - 4.4, 0.0, every=2.0)
    paving(m, -1.8, cx + 1.8, cy - R - 4.4, cy - R - 2.6, 0.0, along='x', edge=None)
    skeleton(m, -9.0, -4.0, 0, 0.55, rz=-0.5)
    seat(m, -9.0, -10.5, 0.0, 2.2)
    lamp(m, W / 2 - 3, -Dp / 2 + 3)
    grow_here(m, -9.5, 8.0, 12.0, 9.0)
    m.pop()


@first('noir')
def f_noir(m, L):
    """The first lounge: one small pill-shaped room with amber light, a short fin with the saxophone."""
    D, W, Dp = 'd_film', 26, 22
    m.push(0, 0, fpad(m, W, Dp))
    w, d, h, cy = 9.5, 6.0, 3.8, 3.0
    cx = -1.56 + 1.6
    amber = mixc('lamp_warm', 'w_noir', 0.25)
    out = stadium(w, d, 8, cx, cy)
    m.frustum(stadium(w + 0.4, d + 0.4, 8, cx, cy), stadium(w + 0.4, d + 0.4, 8, cx, cy), 0, 0.3, 'plinth', top=False)
    m.frustum(out, out, 0, 0.9, P, top=False)
    with m.use('glow'):
        m.frustum(stadium(w - 0.3, d - 0.3, 8, cx, cy), stadium(w - 0.3, d - 0.3, 8, cx, cy), 0.9, 2.8, shade(amber, 0.8), top=False, col1=amber)
    m.frustum(out, out, 2.8, h, P, top=False)
    top = stadium(w + 1.2, d + 1.2, 8, cx, cy)
    m.frustum(top, top, h, h + 0.4, P, top=tint(P, 0.2))
    m.cap(top, h, shade(P, 0.75), up=False)
    for mx in row(4, w - d + 2):
        m.cbox(cx + mx, cy - d / 2 + 0.02, 0.2, 0.3, 0.9, 2.8, P, top=False)
    fx, fy, fh_ = cx + w / 2 + 1.0, cy - d / 2 - 1.0, 8.0
    with m.at(fx, fy, 0, 0.35):
        m.rbox(0, 0, 2.6, 1.3, 0, 0.4, 'plinth', r=0.3, seg=2)
        m.plate([(-0.8, 0), (0.8, 0), (0.9, fh_ * 0.5), (0.35, fh_), (-0.35, fh_), (-0.9, fh_ * 0.5)], 0.22, 0.44, P, back=True)
        with m.use('glow'):
            gp = [(-0.55, 1.0), (0.55, 1.0), (0.62, fh_ * 0.5), (0.2, fh_ - 0.5), (-0.2, fh_ - 0.5), (-0.62, fh_ * 0.5)]
            m.poly([(x, -0.24, z) for x, z in gp], D)
            m.poly([(x, 0.24, z) for x, z in gp][::-1], D)
        saxophone(m, 0, 0, fh_ + 0.15, h=2.2)
    portal(m, -1.56, cy - d / 2 - 0.2, D, w=2.2, name='NOIR', size=0.55)
    set_door(m, -1.56, -Dp / 2)
    paving(m, -3.4, 0.3, -Dp / 2 + 0.3, cy - d / 2 - 3.0, 0.0, every=2.0)
    table_set(m, 4.0, cy - d / 2 - 3.0, 0, P, 2, rz=0.4)
    lamp(m, -W / 2 + 3, -Dp / 2 + 3)
    grow_here(m, cx, cy + 0.5, w + 6.0, 0, round_=False) if False else grow_here(m, -8.0, 4.0, 6.0, 9.0)
    m.pop()


@first('influencers')
def f_influencers(m, L):
    """The first photo studio: one small round room with a glass front, and a ring light out on the forecourt."""
    D, W, Dp = 'd_film', 30, 24
    m.push(0, 0, fpad(m, W, Dp))
    cx, cy, R, H = -3.0, 2.5, 4.6, 4.2
    plinth_ring(m, cx, cy, R, 24, h=0.3)
    with m.use('glow'):
        m.lathe(cx, cy, [(R - 0.5, 0.06), (R - 0.5, H - 0.3)], 24, [tint(D, 0.72), tint(D, 0.86)], cap=False)
    n = 24
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        pa, pb = (cx + R * math.cos(a0), cy + R * math.sin(a0)), (cx + R * math.cos(a1), cy + R * math.sin(a1))
        front = math.sin((a0 + a1) / 2) < -0.6
        if front:
            with clear(m):
                m.poly([(*pa, 0.1), (*pb, 0.1), (*pb, H - 1.0), (*pa, H - 1.0)], 'glass_c')
            m.beam((*pa, 0), (*pa, H - 1.0), 0.1, 0.1, P)
            m.wall(pa, pb, H - 1.0, H, P)
        else:
            m.wall(pa, pb, 0, H, shade(P, 0.93), col1=P)
    m.cap(ngon(R - 0.5, n, cx, cy), 0.06, 'pearl_hi')
    disc(m, cx, cy, H, R + 0.6, 0.6, n=24)
    softbox(m, cx - 1.6, cy, 0, h=3.0, s=0.7, rz=math.pi + 0.6)
    with m.at(cx, cy - R, 0):
        with clear(m):
            m.fq(-1.1, -0.03, 0.05, 2.25, -0.06, 'glass_b')
            m.fq(0.03, 1.1, 0.05, 2.25, -0.06, 'glass_b')
        m.box(-1.2, 1.2, -0.08, 0.02, 2.25, 2.4, 'brushed', bottom=True)
    set_door(m, 0, -Dp / 2)
    paving(m, -1.8, 1.8, -Dp / 2 + 0.3, cy - R - 3.0, 0.0, every=2.0)
    paving(m, cx - 1.8, 1.8, cy - R - 3.0, cy - R - 0.4, 0.0, edge=None)
    ring_light(m, 4.5, -3.0, 0.0, R=1.0, r=0.18)
    tripod_camera(m, 4.5, -6.0, 0, h=1.8, rz=math.pi)
    totem(m, -W / 2 + 4.0, -Dp / 2 + 3.5, 'STUDIO', D, size=0.6)
    lamp(m, W / 2 - 3, -Dp / 2 + 3)
    grow_here(m, 8.5, 5.5, 9.0, 0, round_=True)
    m.pop()


@first('stickers')
def f_stickers(m, L):
    """The first toy shop: one soft cube with two big stickers, a shop window and a toy block at the door."""
    D, W, Dp = 'd_games', 24, 20
    m.push(0, 0, fpad(m, W, Dp, 7))
    cx, cy, w, d, h = -2.5, 2.0, 8.0, 6.5, 5.2
    soft(m, cx, cy, w, d, 0, h, P, r=1.3)
    m.rbox(cx, cy, w + 0.4, d + 0.4, 0, 0.3, 'plinth', r=1.5, seg=2, top=False)
    m.ball(cx - 1.5, cy + 0.8, h + 1.1, 1.5, shade('t_teal', 0.88), n=16, rings=8, col1=tint('t_teal', 0.2))
    with m.at(cx, cy - d / 2, 0):
        st_sunflower(m, -2.2, 4.0, 0, 0.95)
        st_duck(m, 0.4, 4.1, 0, 0.9)
        glazing(m, -3.5, -0.6, 0.6, 2.7, 0.0, bay=1.0, lit=0.3)
    portal(m, cx + 2.2, cy - d / 2 - 0.2, D, w=1.9, name='STICKERS', size=0.45)
    set_door(m, 0, -Dp / 2)
    paving(m, -1.6, 1.6, -Dp / 2 + 0.3, cy - d / 2 - 4.0, 0.0, every=1.8)
    paving(m, -1.6, cx + 4.0, cy - d / 2 - 4.0, cy - d / 2 - 2.8, 0.0, along='x', edge=None)
    toy_block(m, -W / 2 + 3.0, -Dp / 2 + 4.0, 0, 1.6, 't_blue', 0.3, 'star')
    lamp(m, W / 2 - 2.5, -Dp / 2 + 2.5)
    grow_here(m, 6.5, 3.0, 7.0, 0, round_=True)
    m.pop()


@first('party')
def f_party(m, L):
    """The first party house: one small dome on a low drum, round windows, lights strung to two poles."""
    D, W, Dp = 'd_games', 26, 22
    m.push(0, 0, m.pad(W, Dp, col='grass_g', r=8, seg=5))
    cx, cy, R, h = -2.0, 3.0, 4.2, 2.8
    amber = mixc('pane', 'lamp_warm', 0.3)
    round_paving(m, cx, cy, R + 1.8, 0.0, n=28, col='pave_light', rings=(), spokes=0, r_in=R)
    plinth_ring(m, cx, cy, R, 28, h=0.35)
    drum(m, cx, cy, 0, h, R, n=28)
    with m.use('glow'):
        for k in (1, 2, 5, 6):
            a = -math.pi / 2 + (k + 0.5) * math.pi / 4
            with m.at(cx + R * math.cos(a), cy + R * math.sin(a), 0, a + math.pi / 2):
                m.plate(disc2(0, h * 0.55, 0.7, 12), 0.05, 0.12, amber, edge=P)
    ring_beam(m, cx, cy, h + 0.3, R + 0.2, 28, h=0.3, out=0.3)
    dome(m, cx, cy, h + 0.3, R + 0.4, R * 0.75, col=P, n=28, k=6)
    strip(m, cx, cy, h - 0.1, R + 0.02, D, 0.35, n=28)
    portal(m, cx, cy - R - 0.2, D, w=2.0, name='PARTY', size=0.55)
    set_door(m, 0, -Dp / 2)
    paving(m, -1.6, 1.6, -Dp / 2 + 0.3, cy - R - 4.0, 0.0, col='pave_light', every=1.8)
    paving(m, cx - 1.6, 1.6, cy - R - 4.0, cy - R - 2.6, 0.0, col='pave_light', along='x', edge=None)
    lp = [(-W / 2 + 3, -Dp / 2 + 3), (W / 2 - 3, -Dp / 2 + 3)]
    for lx, ly in lp:
        m.cyl(lx, ly, 0, 0.4, 0.3, 6, 'plinth')
        m.cyl(lx, ly, 0.4, 5.0, 0.09, 5, 'pale_metal', cap=False)
    bulbs = ['lamp_warm', 't_pink', 't_teal', 't_yel']
    m.string_lights((cx, cy - R * 0.5, h + R * 0.7), (lp[0][0], lp[0][1], 4.9), sag=1.2, n=7, cols=bulbs)
    m.string_lights((cx, cy - R * 0.5, h + R * 0.7), (lp[1][0], lp[1][1], 4.9), sag=1.4, n=8, cols=bulbs)
    for i in range(3):
        m.balloon(cx + R + 1.0 + (i - 1) * 0.9, cy - R - 0.8 + (i % 2) * 0.4, 4.2 + (i % 2) * 0.7, ('t_red', 't_yel', 't_blue')[i], 0.6, anchor=(cx + R + 1.0, cy - R - 0.8, 0.2))
    grow_here(m, 7.5, 4.0, 7.0, 0, round_=True)
    m.pop()


@first('duiyao')
def f_duiyao(m, L):
    """The first pharmacy: a small pill kiosk on two cradles, a window to the street, and the green cross."""
    D, W, Dp = 'd_health', 26, 20
    m.push(0, 0, fpad(m, W, Dp, 7))
    Lc, r, cx, cy = 10.0, 2.6, -3.0, 2.5
    zc = r + 0.5
    for sx in (-1, 1):
        m.rbox(cx + sx * (Lc / 2 - r * 0.9), cy, r * 0.9, r * 1.3, 0, 1.2, 'plinth', r=0.4, seg=2)
    capsule(m, cx, cy, zc, L=Lc, r=r, col_a=D, col_b=P, n=24)
    with m.at(cx, cy - r * 0.985, 0):
        with m.use('glass'):
            m.plate(rrect2(Lc * 0.18, zc + 0.2, Lc * 0.28, r * 0.6, 0.6, 2), 0.05, 0.1, 'glass_b', edge=P)
    m.cyl(cx, cy - r + 0.5, 0, 0.5, 1.6, 10, PS) if False else None
    portal(m, cx - 1.6, cy - r - 0.1, D, w=2.0, size=0.5)
    landing_steps(m, cx - 1.6, cy - r - 0.75, 2.6, 0.5)
    set_door(m, 0, -Dp / 2)
    paving(m, -1.6, 1.6, -Dp / 2 + 0.3, cy - r - 5.0, 0.0, every=1.8)
    paving(m, cx - 3.2, 1.6, cy - r - 5.0, cy - r - 3.4, 0.0, along='x', edge=None)
    px, py = cx + Lc / 2 + 1.2, cy - r - 0.5
    m.cyl(px, py, 0, 0.4, 0.4, 8, 'plinth')
    m.cyl(px, py, 0.4, zc * 2 + 1.6, 0.16, 8, 'pale_metal', cap=False)
    cross3d(m, px, py, zc * 2 + 2.6, s=2.0, t=0.7, d=0.5, col=D)
    lamp(m, W / 2 - 2.5, -Dp / 2 + 2.5)
    grow_here(m, 6.0, 4.5, 9.0, 7.0)
    m.pop()


@first('hackathons')
def f_hackathons(m, L):
    """The first event room: a small lens-roofed pavilion on a ring of columns, and two fins of light."""
    D, W, Dp = 'd_health', 38, 30
    m.push(0, 0, fpad(m, W, Dp))
    cx, cy, R, sy = -4.0, 3.0, 7.5, 0.7
    n = 28
    plinth_ring(m, cx, cy, R - 0.4, n, sy=sy, h=0.25, out=0.4)
    gband(m, cx, cy, 0.4, 3.4, R - 0.4, n=n, sy=sy, lit=0.3, mull=1)
    m.lathe(cx, cy, [(R - 0.5, 3.4), (R + 1.0, 3.7)], n, [shade(P, 0.72), shade(P, 0.85)], cap=False, sy=sy)
    dome(m, cx, cy, 3.7, R + 1.0, 2.0, n=n, k=5, sy=sy)
    with m.use('glow'):
        m.lathe(cx, cy, [(R + 1.02, 3.62), (R + 1.05, 3.8)], n, D, cap=False, sy=sy)
    for k in range(10):
        a = 2 * math.pi * (k + 0.5) / 10
        col_at(m, cx + (R + 0.4) * math.cos(a), cy + (R + 0.4) * sy * math.sin(a), 0.0, 3.45, 0.14)
    portal(m, cx, cy - (R - 0.4) * sy - 0.1, D, w=2.6, name='HACKATHON', size=0.5)
    set_door(m, 0, -Dp / 2)
    paving(m, -1.8, 1.8, -Dp / 2 + 0.3, cy - R * sy - 3.6, 0.0, every=2.0)
    paving(m, cx - 1.8, 1.8, cy - R * sy - 3.6, cy - R * sy - 2.0, 0.0, along='x', edge=None)
    for i, bx in enumerate((-13.0, 6.0)):
        with m.at(bx, -Dp / 2 + 4.0, 0):
            m.rbox(0, 0, 2.0, 1.0, 0, 0.35, 'plinth', r=0.3, seg=2)
            m.plate([(-0.5, 0), (0.5, 0), (0.7, 3.6), (0.2, 6.5), (-0.2, 6.5), (-0.7, 3.6)], 0.2, 0.4, P, back=True)
            with m.use('glow'):
                gp = [(-0.3, 1.0), (0.3, 1.0), (0.45, 3.6), (0.08, 6.0), (-0.08, 6.0), (-0.45, 3.6)]
                m.poly([(x, -0.22, z) for x, z in gp], D)
                m.poly([(x, 0.22, z) for x, z in gp][::-1], D)
    lamp(m, W / 2 - 3, -Dp / 2 + 3)
    grow_here(m, 11.5, 5.0, 11.0, 14.0)
    m.pop()
