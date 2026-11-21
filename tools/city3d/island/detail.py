"""Construction detail for the island buildings: the pieces that make a bold shape read as something built.

Railings (1.1 m, glass with a metal top rail), stairs (0.17 m risers, stringers, handrails), plinths under
drums, ring beams under domes and shells, sills and heads round glazing bands, columns and brackets under
canopies and cantilevers, roof plant (screened units, hatches, vents), downpipes, paved paths with banding,
lamps, benches, planters with trees, bike hoops. Everything is in metres at human scale.
Front = -Y in Blender (+Z in glTF).
"""
import math
from contextlib import contextmanager
from ilib import rrect, rect, ngon, shade, tint, mixc, C, rrect2

P, PS = 'pearl', 'pearl_shade'
RAIL_H = 1.1          # railing height
RISE, RUN = 0.17, 0.29


@contextmanager
def clear(m):
    """See-through glass (railings, canopies, skylights), whatever the model's default glazing is."""
    old = m.glass_mat
    m.glass_mat = 'glass'
    with m.use('glass'):
        yield
    m.glass_mat = old


def _arc_pts(cx, cy, r, n, sy, a0, a1):
    k = max(1, int(round(n * abs(a1 - a0) / (2 * math.pi))))
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / k), cy + r * sy * math.sin(a0 + (a1 - a0) * i / k)) for i in range(k + 1)]


def rail_line(m, pts, z=0.0, h=RAIL_H, closed=False, post=2.4, glass=True, col='pale_metal'):
    """A balustrade along a polyline: frameless glass panels in a base channel, a round metal handrail on top.
    pts = (x, y) at height z, or (x, y, z) points (a sloping rail on a stair or ramp)."""
    P3 = [(p[0], p[1], p[2] if len(p) > 2 else z) for p in pts]
    if closed:
        P3 = P3 + [P3[0]]
    for a, b in zip(P3[:-1], P3[1:]):
        L = math.dist(a[:2], b[:2])
        k = max(1, int(round(L / post)))
        for j in range(k):
            t0, t1 = j / k, (j + 1) / k
            pa = [a[i] + (b[i] - a[i]) * t0 for i in range(3)]
            pb = [a[i] + (b[i] - a[i]) * t1 for i in range(3)]
            if glass:
                with clear(m):
                    m.sheet([(pa[0], pa[1], pa[2] + 0.08), (pb[0], pb[1], pb[2] + 0.08), (pb[0], pb[1], pb[2] + h - 0.06), (pa[0], pa[1], pa[2] + h - 0.06)], 'glass_c')
                m.poly([(pa[0], pa[1], pa[2]), (pb[0], pb[1], pb[2]), (pb[0], pb[1], pb[2] + 0.1), (pa[0], pa[1], pa[2] + 0.1)], col)
                m.poly([(pb[0], pb[1], pb[2]), (pa[0], pa[1], pa[2]), (pa[0], pa[1], pa[2] + 0.1), (pb[0], pb[1], pb[2] + 0.1)], col)
            else:
                m.beam((pa[0], pa[1], pa[2]), (pa[0], pa[1], pa[2] + h), 0.05, 0.05, col)
                m.beam((pa[0], pa[1], pa[2] + h * 0.5), (pb[0], pb[1], pb[2] + h * 0.5), 0.03, 0.03, col)
    if not glass and not closed:
        e = P3[-1]
        m.beam((e[0], e[1], e[2]), (e[0], e[1], e[2] + h), 0.05, 0.05, col)
    m.tube([(p[0], p[1], p[2] + h) for p in P3], 0.045, 3, col, caps=False)


def rail_ring(m, cx, cy, z, r, n=24, sy=1.0, h=RAIL_H, a0=0.0, a1=2 * math.pi, post=2.0):
    """A balustrade round a round (or oval) edge, or along an arc from a0 to a1 (radians, 0 = +x)."""
    pts = _arc_pts(cx, cy, r, n, sy, a0, a1)
    full = abs(a1 - a0) >= 2 * math.pi - 1e-6
    rail_line(m, pts[:-1] if full else pts, z, h, closed=full, post=post)


def rail_gap(m, cx, cy, z, r, n=24, sy=1.0, gap_at=-math.pi / 2, gap=0.35, h=RAIL_H):
    """A ring railing with one opening (where a stair or a door comes in)."""
    rail_ring(m, cx, cy, z, r, n, sy, h, gap_at + gap, gap_at + 2 * math.pi - gap)


def plinth_ring(m, cx, cy, r, n=28, sy=1.0, h=0.45, out=0.3, col='plinth', z=0.0):
    """The stone base a drum stands on."""
    rs = (r + out)
    m.lathe(cx, cy, [(rs, z - 0.05), (rs, z + h), (r, z + h)], n, [shade(col, 0.9), col, col], cap=False, sy=sy)


def ring_beam(m, cx, cy, z, r, n=28, sy=1.0, h=0.5, out=0.22, col=P):
    """The band a dome or shell sits on (z = its top), with its soffit."""
    m.lathe(cx, cy, [(r - 0.1, z - h), (r + out, z - h), (r + out, z), (r - 0.1, z)], n, [shade(col, 0.72), shade(col, 0.85), col, tint(col, 0.2)], cap=False, sy=sy)


def lip(m, cx, cy, z, r, n=28, sy=1.0, out=0.14, h=0.16, col=P):
    """A slim projecting sill or head round a curved wall."""
    m.lathe(cx, cy, [(r, z - h / 2), (r + out, z - h / 2), (r + out, z + h / 2), (r, z + h / 2)], n, [shade(col, 0.8), col, tint(col, 0.15), col], cap=False, sy=sy)


def slab_edge(m, cx, cy, z, r, n=28, sy=1.0, h=0.3, col='seam'):
    """A floor line: the edge of a slab seen through or across a glass wall."""
    m.lathe(cx, cy, [(r + 0.04, z - h / 2), (r + 0.04, z + h / 2)], n, col, cap=False, sy=sy)


def columns(m, cx, cy, z0, z1, r, k, rr=0.2, sy=1.0, a0=0.0, col=P, base=True):
    """k slim round columns standing on a circle of radius r (supports under a canopy, a ring or a deck)."""
    for i in range(k):
        a = a0 + 2 * math.pi * i / k
        x, y = cx + r * math.cos(a), cy + r * sy * math.sin(a)
        col_at(m, x, y, z0, z1, rr, col, base)


def col_at(m, x, y, z0, z1, rr=0.2, col=P, base=True):
    if base:
        m.cyl(x, y, z0, z0 + 0.18, rr * 1.7, 8, 'plinth')
    m.cyl(x, y, z0 + (0.18 if base else 0), z1, rr, 8, col, cap=False)
    m.cyl(x, y, z1 - 0.12, z1, rr * 1.5, 8, col, cap=False)


def bracket(m, x, y, z_wall, out, rz=0.0, depth=1.2, t=0.18, col=P):
    """A tapered bracket under a cantilever, out from a wall (facing -y before rz)."""
    with m.at(x, y, 0, rz):
        m.plate([(0, z_wall), (0, z_wall - depth), (out * 0.25, z_wall - depth), (out, z_wall - 0.15), (out, z_wall)][::-1], t / 2, t, col, edge=shade(col, 0.85), back=True)


def stair(m, x, y, z0, z1, w=1.8, rz=0.0, solid=None, rails=(True, True), col='pave_light', side_col=P, wall_side=None):
    """A straight flight climbing towards +y (before rz) from (x, y, z0) to z1: 0.17 m risers, 0.29 m treads,
    handrails at 0.9 m on posts. solid=True: steps on a solid mass (from the ground); else treads on two stringers.
    Returns the run length."""
    n = max(1, int(round((z1 - z0) / RISE)))
    rise = (z1 - z0) / n
    L = (n - 1) * RUN + 0.3
    solid = (z0 < 0.6) if solid is None else solid
    with m.at(x, y, z0, rz):
        for i in range(n):
            ya, za = i * RUN, (i + 1) * rise
            if solid:
                m.box(-w / 2, w / 2, ya, ya + RUN + 0.02, 0.0 if i == 0 else za - rise - 0.02, za, col, top=tint(C(col), 0.08))
            else:
                m.box(-w / 2 + 0.12, w / 2 - 0.12, ya, ya + RUN + 0.02, za - 0.06, za, col, bottom=True)
        if solid:
            for sx in (-1, 1):            # the cheek walls
                q = [(sx * w / 2, 0, 0), (sx * w / 2, L, 0), (sx * w / 2, L, z1 - z0), (sx * w / 2, 0, rise)]
                m.poly(q if sx > 0 else q[::-1], side_col)
        else:
            for sx in (-1, 1):            # the stringers
                m.beam((sx * (w / 2 - 0.08), -0.05, rise * 0.5 - 0.25), (sx * (w / 2 - 0.08), L, (z1 - z0) - 0.25), 0.16, 0.35, side_col)
        for sx, on in zip((-1, 1), rails):
            if on:
                a, b = (sx * (w / 2 - 0.06), 0.1, rise + 0.9), (sx * (w / 2 - 0.06), L - 0.1, (z1 - z0) + 0.9)
                m.tube([a, b], 0.04, 4, 'pale_metal', caps=True)
                for t in (0.0, 0.5, 1.0):
                    px, py, pz = a[0], a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t
                    m.beam((px, py, pz - 0.9), (px, py, pz), 0.05, 0.05, 'pale_metal')
                with clear(m):
                    m.sheet([(a[0], a[1], a[2] - 0.8), (b[0], b[1], b[2] - 0.8), (b[0], b[1], b[2] - 0.08), (a[0], a[1], a[2] - 0.08)], 'glass_c')
    return L


def landing_steps(m, cx, y_front, w, z_top, z_bot=0.0, rz=0.0, col='pave_light'):
    """A short flight of solid steps up to a raised floor at z_top; y_front = the top step's front edge. Steps
    come out towards -y. Returns the outer edge."""
    n = max(1, int(round((z_top - z_bot) / RISE)))
    rise = (z_top - z_bot) / n
    with m.at(cx, y_front, 0, rz):
        for i in range(n):
            m.box(-w / 2, w / 2, -(n - i) * RUN, 0.02, z_bot + i * rise, z_bot + (i + 1) * rise, col)
    return y_front - n * RUN


def downpipe(m, x, y, z_top, z0=0.0, r=0.07):
    m.cyl(x, y, z0, z_top, r, 5, 'pale_metal', cap=False)
    m.cyl(x, y, z0, z0 + 0.12, r * 2.2, 5, 'pale_metal')


def roof_kit(m, x, y, z, s=1.0, rz=0.0, hatch=True, vents=2):
    """Roof plant: a unit behind a slatted pearl screen, a hatch, vents."""
    with m.at(x, y, z, rz, s=s):
        m.rbox(0, 0, 3.2, 2.0, 0, 0.25, 'plinth', r=0.2, seg=1)
        m.rbox(0, 0, 2.6, 1.5, 0.25, 1.4, 'steel_light', r=0.25, seg=1, top='brushed')
        m.cyl(0.5, 0, 1.4, 1.5, 0.45, 8, 'iron')
        for k in range(5):
            m.fq(-1.2 + k * 0.6 - 0.05, -1.2 + k * 0.6 + 0.05, 0.35, 1.3, -0.77, 'seam')
        if hatch:
            m.rbox(-2.6, 0.2, 1.1, 1.1, 0, 0.5, PS, r=0.1, seg=1)
            m.rbox(-2.6, 0.2, 1.2, 1.2, 0.5, 0.6, 'steel_light', r=0.1, seg=1, bottom=True)
        for i in range(vents):
            vx = 2.4 + i * 0.9
            m.cyl(vx, 0.4, 0, 0.8, 0.16, 6, 'brushed', cap=False)
            m.cyl(vx, 0.4, 0.8, 0.95, 0.3, 6, 'brushed', r2=0.08)


def paving(m, x0, x1, y0, y1, z=0.0, col='pave', band='pave_dark', every=2.4, along='y', edge='kerb'):
    """A paved walk or forecourt: slabs with darker bands across, and kerb edges."""
    m.box(x0, x1, y0, y1, z, z + 0.04, col, top=col)
    if along == 'y':
        k = max(1, int((y1 - y0) / every))
        for i in range(1, k):
            yy = y0 + (y1 - y0) * i / k
            m.box(x0 + 0.1, x1 - 0.1, yy - 0.12, yy + 0.12, z + 0.04, z + 0.05, band, top=band)
        if edge:
            for xx in (x0, x1 - 0.18):
                m.box(xx, xx + 0.18, y0, y1, z, z + 0.1, edge)
    else:
        k = max(1, int((x1 - x0) / every))
        for i in range(1, k):
            xx = x0 + (x1 - x0) * i / k
            m.box(xx - 0.12, xx + 0.12, y0 + 0.1, y1 - 0.1, z + 0.04, z + 0.05, band, top=band)
        if edge:
            for yy in (y0, y1 - 0.18):
                m.box(x0, x1, yy, yy + 0.18, z, z + 0.1, edge)


def round_paving(m, cx, cy, r, z=0.0, n=28, col='pave', band='pave_dark', rings=(0.55,), spokes=8, sy=1.0, r_in=0.0):
    """A round forecourt or plaza: a disc of paving with concentric and radial bands."""
    if r_in > 0:
        m.cap_ring(ngon(r, n, cx, cy, sy=sy), ngon(r_in, n, cx, cy, sy=sy), z + 0.04, col)
    else:
        m.cap(ngon(r, n, cx, cy, sy=sy), z + 0.04, col)
    for f in rings:
        m.cap_ring(ngon(r * f + 0.15, n, cx, cy, sy=sy), ngon(r * f - 0.15, n, cx, cy, sy=sy), z + 0.05, band)
    for k in range(spokes):
        a = 2 * math.pi * (k + 0.5) / spokes
        ri = max(r_in, r * min(rings) if rings else r * 0.3)
        ca, sa = math.cos(a), math.sin(a)
        nx, ny = -sa * 0.13, ca * 0.13
        p0 = (cx + ri * ca, cy + ri * sa * sy)
        p1 = (cx + (r - 0.3) * ca, cy + (r - 0.3) * sa * sy)
        m.poly([(p0[0] - nx, p0[1] - ny, z + 0.05), (p1[0] - nx, p1[1] - ny, z + 0.05), (p1[0] + nx, p1[1] + ny, z + 0.05), (p0[0] + nx, p0[1] + ny, z + 0.05)], band)


def lamp_post(m, x, y, h=4.5, z=0.0, col=P):
    """A slim pearl street lamp with a disc head that glows underneath."""
    m.cyl(x, y, z, z + 0.3, 0.17, 5, 'plinth', cap=False)
    m.cyl(x, y, z + 0.3, z + h, 0.065, 5, col, cap=False, r2=0.05)
    m.lathe(x, y, [(0.5, z + h), (0.42, z + h + 0.2), (0.0, z + h + 0.26)], 7, [col, tint(C(col), 0.2), tint(C(col), 0.2)], cap=False)
    with m.use('glow'):
        m.cap(ngon(0.5, 7, x, y), z + h, 'lamp', up=False)


def bollard_light(m, x, y, z=0.0):
    m.cyl(x, y, z, z + 0.75, 0.12, 6, PS, cap=False)
    with m.use('glow'):
        m.cyl(x, y, z + 0.75, z + 0.95, 0.12, 6, 'lamp')


def seat(m, x, y, rz=0.0, w=2.2, z=0.0, back=True):
    """A pearl bench on two stone feet."""
    with m.at(x, y, z, rz):
        for sx in (-1, 1):
            m.cbox(sx * (w / 2 - 0.35), 0, 0.25, 0.5, 0, 0.42, 'plinth')
        m.rbox(0, 0, w, 0.6, 0.42, 0.52, P, r=0.12, seg=1, bottom=True)
        if back:
            m.rbox(0, 0.27, w, 0.1, 0.52, 0.95, P, r=0.05, seg=1)


def planter_tree(m, x, y, s=0.8, r=1.2, z=0.0, kind='round', col='leaf'):
    """A tree in a round pearl planter with a stone rim."""
    m.lathe(x, y, [(r * 0.85, z), (r, z + 0.55), (r - 0.12, z + 0.6)], 8, [PS, P, P], cap=False)
    m.cap(ngon(r - 0.12, 8, x, y), z + 0.52, 'soil')
    m.tree(x, y, s, kind, z=z + 0.5, col=col)


def hedge(m, x0, x1, y, z=0.0, h=0.8, d=0.9, col='leaf_dark', box_col=PS):
    """A low planter box with a clipped hedge."""
    m.rbox((x0 + x1) / 2, y, x1 - x0, d, z, z + 0.45, box_col, r=0.2, seg=1, top='soil')
    m.rbox((x0 + x1) / 2, y, x1 - x0 - 0.2, d - 0.2, z + 0.45, z + 0.45 + h, col, r=0.3, seg=2, bev=0.2, top=tint(C(col), 0.15))


def bike_hoops(m, x, y, k=4, rz=0.0, gap=0.9, col='pale_metal'):
    """A row of bike hoops."""
    with m.at(x, y, 0, rz):
        for i in range(k):
            hx = (i - (k - 1) / 2) * gap
            pts = [(hx, -0.4 * math.cos(math.pi * t / 4), 0.85 * math.sin(math.pi * t / 4) if 0 < t < 4 else 0.0) for t in range(5)]
            pts = [(hx, -0.4, 0.0), (hx, -0.4, 0.65), (hx, -0.28, 0.85), (hx, 0.28, 0.85), (hx, 0.4, 0.65), (hx, 0.4, 0.0)]
            m.tube(pts, 0.035, 4, col, caps=False)


def pod_bay(m, x, y, rz=0.0, col='d_software'):
    """A charging bay for the little pod cars: a pad with a light line and a slim charger post."""
    with m.at(x, y, 0, rz):
        m.box(-1.6, 1.6, -3.0, 3.0, 0.0, 0.03, 'pave_dark', top='pave_dark')
        with m.use('glow'):
            for sx in (-1.55, 1.45):
                m.box(sx, sx + 0.1, -3.0, 3.0, 0.03, 0.05, col)
        m.rbox(0, 3.3, 0.5, 0.35, 0, 1.4, P, r=0.15, seg=1)
        with m.use('glow'):
            m.fq(-0.15, 0.15, 0.9, 1.25, 3.12, col)


def signpost(m, x, y, text, D, rz=0.0, size=0.7, h=2.4):
    """A name sign on two posts, with lit letters on a pearl board edged in the town colour."""
    with m.at(x, y, 0, rz):
        n = len(text)
        bw = max(1.6, n * size * 0.62 + 0.8)
        for sx in (-1, 1):
            m.cyl(sx * (bw / 2 - 0.3), 0.12, 0, h + 0.2, 0.06, 5, 'pale_metal', cap=False)
        m.cbox(0, 0.12, bw + 0.3, 0.6, 0, 0.3, 'plinth')
        m.sign(text, 0, h - size * 0.74 - 0.35, size, col=D, board=P, y=0.0, t=0.2, r=0.3)
        with m.use('glow'):
            m.fq(-bw / 2 + 0.2, bw / 2 - 0.2, h + 0.1, h + 0.18, -0.21, D)


def flag_row(m, x0, y, cols, h=9.0, gap=2.6, rz=0.0):
    for i, c in enumerate(cols):
        m.flag(x0 + i * gap, y, h, c, pole='pale_metal')
        m.cyl(x0 + i * gap, y, 0, 0.3, 0.2, 6, 'plinth')


def fountain_pool(m, cx, cy, r=3.5, z=0.0, n=20, jets=True):
    """A round pool with a stone rim, a basin and jets of water."""
    m.lathe(cx, cy, [(r, z), (r, z + 0.5), (r - 0.4, z + 0.5), (r - 0.4, z + 0.3)], n, ['plinth', 'kerb', 'kerb', 'plinth'], cap=False)
    with m.use('glass'):
        m.cap(ngon(r - 0.4, n, cx, cy), z + 0.32, 'water_g')
    if jets:
        m.lathe(cx, cy, [(0.6, z + 0.3), (0.35, z + 1.1), (1.2, z + 1.3), (1.25, z + 1.45), (0.0, z + 1.45)], 10, ['kerb', 'kerb', P, P, P], cap=False)
        with clear(m):
            m.lathe(cx, cy, [(0.3, z + 1.45), (0.15, z + 2.6), (0.0, z + 3.0)], 6, 'glass_c', cap=False)
            for k in range(6):
                a = k * math.pi / 3
                m.tube([(cx + (r - 1.0) * math.cos(a), cy + (r - 1.0) * math.sin(a), z + 0.32), (cx + (r - 1.6) * math.cos(a), cy + (r - 1.6) * math.sin(a), z + 1.4),
                        (cx + (r - 2.1) * math.cos(a), cy + (r - 2.1) * math.sin(a), z + 0.6)], 0.06, 3, 'glass_c', caps=False)


def glazing(m, x0, x1, z0, z1, y=0.0, bay=1.6, col='glass_b', frame=P, transom=None, mat='glass', lit=0.0):
    """A straight band of glass set into a wall (facing -y): slim mullions, a sill and a head, an optional transom."""
    with m.use(mat):
        m.fq(x0, x1, z0, z1, y - 0.02, col)
    k = max(1, int(round((x1 - x0) / bay)))
    for i in range(k + 1):
        xx = x0 + (x1 - x0) * i / k
        m.box(xx - 0.06, xx + 0.06, y - 0.14, y, z0, z1, frame)
        if 0 < i <= k and lit and m.rng.random() < lit:
            with m.use('glow'):
                xa = x0 + (x1 - x0) * (i - 1) / k
                m.fq(xa + 0.1, xx - 0.1, z0 + 0.1, z1 - 0.1, y - 0.03, 'lit_pane')
    m.box(x0 - 0.1, x1 + 0.1, y - 0.2, y, z0 - 0.14, z0, frame)
    m.box(x0 - 0.1, x1 + 0.1, y - 0.16, y, z1, z1 + 0.12, frame)
    if transom:
        m.box(x0, x1, y - 0.12, y, transom - 0.05, transom + 0.05, frame)


def rail_ring_clear(m, cx, cy, z, r, n=32, sy=1.0, avoid=(), h=RAIL_H, gaps=()):
    """A ring railing that stops where it would run into something round: avoid = [(x, y, radius), ...];
    gaps = [(angle, half-width in radians), ...] leave openings (a stair head, a door)."""
    pts = [(cx + r * math.cos(2 * math.pi * i / n), cy + r * sy * math.sin(2 * math.pi * i / n)) for i in range(n)]

    def ok(i):
        x, y = pts[i]
        a = 2 * math.pi * i / n
        for ga, gw in gaps:
            if abs((a - ga + math.pi) % (2 * math.pi) - math.pi) < gw:
                return False
        return all(math.hypot(x - ax, y - ay) > ar for ax, ay, ar in avoid)
    flags = [ok(i) for i in range(n)]
    if all(flags):
        rail_line(m, pts, z, h, closed=True)
        return
    start = flags.index(False)
    run = []
    for k in range(1, n + 1):
        i = (start + k) % n
        if flags[i]:
            run.append(pts[i])
        else:
            if len(run) > 1:
                rail_line(m, run, z, h)
            run = []
    if len(run) > 1:
        rail_line(m, run, z, h)
