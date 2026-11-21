"""Island life: the metro cars and the hill tram, houses, trees, cars, a bus, street furniture, boats,
the lighthouse, beach things and the animals.

Buildings face -Y in Blender (+Z in glTF). Everything that moves (trains, tram, cars, bus, boats, animals)
has its length along X and faces +X. Boats sit with the waterline at height 0. The gull is modelled in
flight with its body at the origin.
"""
import math
from mathutils import Vector
from ilib import IModel, rrect, rect, ngon, shade, tint, mixc, C, disc2, star2, rrect2, cross2, xsec
from parts2 import *
from detail import rail_line, rail_ring, plinth_ring, lamp_post, planter_tree, clear, seat, hedge

MODELS = []


def model(name, cls='prop', **kw):
    def deco(fn):
        def make():
            m = IModel(name, cls, **kw)
            fn(m)
            return m
        MODELS.append((name, make))
        return fn
    return deco


def inset_quad(q, k=0.14, off=0.03):
    P = [Vector(p) for p in q]
    c = sum(P, Vector((0, 0, 0))) / 4
    n = (P[1] - P[0]).cross(P[3] - P[0])
    n = n.normalized() * off if n.length > 1e-9 else Vector((0, 0, 0))
    return [tuple(p + (c - p) * k + n) for p in P]


def wheel(m, x, y, r=0.5, w=0.28, n=7, col='rubber', hub='steel_light'):
    """A wheel on the +y or -y side (y = centre of the outer face)."""
    s = 1 if y > 0 else -1
    m.hcyl((x, y - s * w, r), (x, y, r), r, n, col)
    m.poly([(x + r * 0.5 * math.cos(2 * math.pi * k / 5) * (1 if s < 0 else -1), y + s * 0.02, r + r * 0.5 * math.sin(2 * math.pi * k / 5)) for k in range(5)], hub)


# ================================================================== the floating metro and the hill pod
# No track: the trains and the pod hover along a lane of lights. A car is one smooth capsule: a pearl shell,
# a flush band of dark glass, flush sliding doors, a thin line in the line's colour, and a soft glow underneath.
def _emit(m, pts, col, mat='city', flip=False, mirror=False):
    """One polygon, with repeated points dropped. mirror = the same piece on the -y side."""
    cols = list(col) if isinstance(col, list) else [col] * len(pts)
    if mirror:
        pts = [(p[0], -p[1], p[2]) for p in pts]
        flip = not flip
    P, Cc = [], []
    for p, c in zip(pts, cols):
        if not P or (Vector(p) - Vector(P[-1])).length > 1e-5:
            P.append(p)
            Cc.append(c)
    if len(P) > 1 and (Vector(P[0]) - Vector(P[-1])).length < 1e-5:
        P.pop()
        Cc.pop()
    if len(P) < 3:
        return
    if flip:
        P.reverse()
        Cc.reverse()
    with m.use(mat):
        m.poly(P, Cc)


def _both(m, pts, col, mat='city', flip=False):
    _emit(m, pts, col, mat, flip)
    _emit(m, pts, col, mat, flip, mirror=True)


class Capsule:
    """A hover car's shell from one half cross-section.
    prof = [(y, z, role of the strip above this point), ...] from the bottom centre round the side to the top centre.
    Roles: belly and skirt glow; keel, low, waist, top, roof are shell; line is the accent; band is glass;
    waist is shell on the body and the light strip round the tip of a nose."""

    def __init__(self, m, prof, accent='line', glass=('pane_dark', 'pane'), glow='hover', shell='pearl'):
        self.m = m
        self.P = [(y, z) for y, z, _ in prof]
        self.roles = [r for _, _, r in prof][:-1]
        self.accent, self.glass, self.glow, self.shell = accent, glass, glow, shell
        zs = [z for (y, z), r in zip(self.P, self.roles + ['']) if r == 'band']
        self.band = self.roles.index('band')
        self.gz = (self.P[self.band][1], self.P[-1][1])

    def half(self, x):
        return [(x, y, z) for y, z in self.P]

    def gcol(self, p):
        t = min(1.0, max(0.0, (p[2] - self.gz[0]) / (self.gz[1] - self.gz[0])))
        return mixc(self.glass[0], self.glass[1], t ** 0.8)

    def paint(self, role, kind='plain', k=0, lit=99, glow_to=99):
        """(material, colour) of a strip. kind: plain, frame (no glass: the end frame by a gangway), nose."""
        if role in ('belly', 'skirt'):
            return ('glow', self.glow) if (self.glow and (kind != 'nose' or k < glow_to)) else ('city', 'pearl_shade' if role == 'belly' else self.shell)
        if role == 'keel':
            return ('city', 'pearl_shade')
        if role == 'line':
            return ('city', self.accent)
        if role in ('band', 'canopy'):
            return ('city', self.shell) if kind == 'frame' else ('glass', None)
        if role == 'lampz' and kind == 'nose' and k >= lit:
            return ('glow', 'lamp')
        if role == 'band2':
            return ('glass', None) if kind == 'plain' else ('city', self.shell)
        if role == 'waist' and kind == 'nose' and k >= lit:
            return ('glow', 'lamp')
        if role == 'roof':
            return ('city', 'pearl_hi')
        return ('city', self.shell)

    def quad(self, a, b, s, mat, col, flip=False):
        q = [a[s], a[s + 1], b[s + 1], b[s]]
        c = [self.gcol(p) for p in q] if col is None else col
        _both(self.m, q, c, mat, flip)

    def body(self, spans, door_z):
        """Straight shell. spans = [(x0, x1, kind)], kind = plain, frame or door (the doorway is left open)."""
        for x0, x1, kind in spans:
            a, b = self.half(x0), self.half(x1)
            for s, role in enumerate(self.roles):
                za, zb = self.P[s][1], self.P[s + 1][1]
                if kind == 'door' and za >= door_z[0] - 1e-6 and zb <= door_z[1] + 1e-6:
                    continue
                mat, col = self.paint(role, 'plain' if kind == 'door' else kind)
                self.quad(a, b, s, mat, col)

    def end_cap(self, x, sgn, col='rubber', door=(0.5, 2.0), zf=None):
        """The end bulkhead by a gangway: a solid wall with a door-sized dark way through to the next car."""
        h = self.half(x)
        ring = h + [(p[0], -p[1], p[2]) for p in reversed(h[1:-1])]
        self.m.poly(ring if sgn > 0 else ring[::-1], self.shell)
        self.m.poly(ring[::-1] if sgn > 0 else ring, self.shell)             # seen from inside the car too
        z0 = zf if zf is not None else self.P[self.band][1] - 0.1
        for d in (0.03, -0.03):
            q = [(x + sgn * d, -door[0], z0), (x + sgn * d, door[0], z0), (x + sgn * d, door[0], z0 + door[1]), (x + sgn * d, -door[0], z0 + door[1])]
            self.m.poly(q if sgn * d > 0 else q[::-1], col)

    def nose(self, x0, NL, sgn, zc, ts, vis, glass_to, lit, glow_to, pw=(2.3, 0.5), pu=(1.9, 0.6), pd=(2.6, 0.5)):
        """A long rounded nose from x0 towards sgn. Every section shrinks towards the tip at height zc.
        vis = for each ring, the profile point where the glass stops (it climbs to the roof centre, so the
        band of side glass sweeps up into a wrap-round screen). Glass runs for the first glass_to spans."""
        def ring(t):
            ky = (1 - t ** pw[0]) ** pw[1] if t < 1 else 0.0
            ku = (1 - t ** pu[0]) ** pu[1] if t < 1 else 0.0
            kd = (1 - t ** pd[0]) ** pd[1] if t < 1 else 0.0
            return [(x0 + sgn * NL * t, y * ky, zc + (z - zc) * (ku if z >= zc else kd)) for y, z in self.P]
        H = [ring(t) for t in ts]
        flip = sgn < 0
        nseg = len(self.roles)
        for k in range(len(ts) - 1):
            a, b = H[k], H[k + 1]
            b0, b1 = (vis[k], vis[k + 1]) if k < glass_to else (self.band, self.band)
            for s, role in enumerate(self.roles):
                if s >= self.band and k < glass_to:
                    if s < b0:
                        self.quad(a, b, s, 'glass', None, flip)
                    elif s >= b1:
                        self.quad(a, b, s, 'city', 'pearl_hi' if role == 'roof' else self.shell, flip)
                    continue
                mat, col = self.paint(role, 'nose', k, lit, glow_to)
                if role in ('band', 'canopy'):
                    mat, col = 'city', self.shell
                self.quad(a, b, s, mat, col, flip)
            if k < glass_to and b1 > b0:           # the slanting edge of the screen
                for j in range(b0, b1):
                    t1 = [a[b0], b[j + 1], b[j]]
                    _both(self.m, t1, [self.gcol(p) for p in t1], 'glass', flip)
                    _both(self.m, [a[j], a[j + 1], b[b1]], 'pearl_hi' if self.roles[min(j, nseg - 1)] == 'roof' else self.shell, 'city', flip)
        return H


def glass_doors(m, c, doorways, dw, zp, yp, segs, prefix='door', proud=0.04):
    """Sliding door leaves that follow the body's curve: glass in a slim pearl frame, child nodes <name>_door_N that
    slide along x. segs = the profile strips a leaf covers (the accent line at its foot, glass above).
    zp, yp = height and half-width of the leaves' own origins."""
    leaves = [(dx + h_ * dw / 4, sy, h_) for sy in (-1, 1) for dx in sorted(doorways) for h_ in (-1, 1)]
    lw = dw / 2
    for i, (lx, sy, h_) in enumerate(leaves):
        m.part(f'{prefix}_{i + 1}', pivot=(lx, sy * yp, zp))
        xa, xb = lx - lw / 2, lx + lw / 2

        def strip(x0, x1, pa, pb, col, mat='city', o=proud, sy=sy):
            q = [(x0, sy * (pa[0] + o), pa[1]), (x1, sy * (pa[0] + o), pa[1]), (x1, sy * (pb[0] + o), pb[1]), (x0, sy * (pb[0] + o), pb[1])]
            with m.use(mat):
                m.poly(q if sy < 0 else q[::-1], col)
        for s_ in segs:
            pa, pb = c.P[s_], c.P[s_ + 1]
            if c.roles[s_] == 'line':
                strip(xa, xb, pa, pb, c.accent)
            else:
                strip(xa, xb, pa, pb, [c.gcol((0, 0, pa[1]))] * 2 + [c.gcol((0, 0, pb[1]))] * 2 if sy < 0 else [c.gcol((0, 0, pb[1]))] * 2 + [c.gcol((0, 0, pa[1]))] * 2, 'glass')
                for x0, x1 in ((xa, xa + 0.05), (xb - 0.05, xb)):                 # the frame's two stiles
                    strip(x0, x1, pa, pb, c.shell, o=proud + 0.012)
        pa, pb = c.P[segs[-1]], c.P[segs[-1] + 1]                                # the top rail
        pm = (pb[0] + (pa[0] - pb[0]) * 0.14, pb[1] + (pa[1] - pb[1]) * 0.14)
        strip(xa, xb, pm, pb, c.shell, o=proud + 0.012)
        # the leaf's own edges, so it has thickness when it slides open
        for xe, d in ((xa, -1), (xb, 1)):
            for s_ in segs:
                pa, pb = c.P[s_], c.P[s_ + 1]
                q = [(xe, sy * (pa[0] - 0.01), pa[1]), (xe, sy * (pa[0] + proud), pa[1]), (xe, sy * (pb[0] + proud), pb[1]), (xe, sy * (pb[0] - 0.01), pb[1])]
                m.poly(q if d * sy > 0 else q[::-1], 'seam')
    m.part('')
    return [{'name': f'{m.name}_{prefix}_{i + 1}', 'side': '+z' if sy < 0 else '-z', 'open': [round(h_ * (dw / 2 - 0.04), 2), 0, 0]} for i, (lx, sy, h_) in enumerate(leaves)]


FLOOR_C = (0.36, 0.40, 0.45)


def cabin(m, x0, x1, zf, hwf, blocks, poles=(), seat='line', rail_z=1.95, rail_y=0.5):
    """What shows through the glass: the floor, rows of seats (blocks = [(xa, xb)] of seating on each side),
    two grab rails under the roof and the poles that carry them."""
    m.poly([(x0, -hwf, zf), (x1, -hwf, zf), (x1, hwf, zf), (x0, hwf, zf)], FLOOR_C)
    for xa, xb in blocks:
        for sy in (-1, 1):
            ya, yb = sorted((sy * 0.46, sy * (hwf - 0.06)))
            m.box(xa, xb, ya, yb, zf, zf + 0.3, 'pearl_shade', top='pearl_shade')            # the seat base
            n = max(1, round((xb - xa) / 0.95))
            for k in range(n):
                sx0 = xa + (xb - xa) * k / n + 0.04
                sx1 = xa + (xb - xa) * (k + 1) / n - 0.04
                yc, wy = (ya + yb) / 2, (yb - ya) - 0.08
                m.rbox((sx0 + sx1) / 2 - 0.05, yc, sx1 - sx0 - 0.1, wy, zf + 0.3, zf + 0.46, seat, r=0.12, seg=1)     # the cushion
                bx = sx1 - 0.08                                                                      # the back, raked, with a headrest
                m.beam((bx, yc, zf + 0.44), (bx + 0.16, yc, zf + 1.08), wy - 0.06, 0.1, seat)
                m.beam((bx + 0.15, yc, zf + 1.06), (bx + 0.19, yc, zf + 1.3), wy * 0.55, 0.12, shade(seat, 0.85))
    for sy in (-1, 1):
        rod(m, (x0 + 0.05, sy * rail_y, zf + rail_z), (x1 - 0.05, sy * rail_y, zf + rail_z), 0.03, 'pale_metal')
        for px in poles:
            rod(m, (px, sy * rail_y, zf), (px, sy * rail_y, zf + rail_z), 0.03, 'pale_metal')


def rod(m, a, b, r=0.03, col='pale_metal'):
    m.tube([a, b], r, 3, col, caps=False)


def _oval(hw, zc, ad, au, zs_lo, zs_hi, pd=3.5, pu=2.2):
    """Points of a rounded (near-elliptical) half cross-section at the heights given."""
    out = []
    for z in zs_lo:
        out.append((hw * (1 - ((zc - z) / ad) ** pd) ** (1 / pd), z))
    for z in zs_hi:
        out.append((hw * max(0.0, 1 - ((z - zc) / au) ** pu) ** (1 / pu), z))
    return out


# the metro car's half cross-section: a rounded tube 2.9 m wide. Solid pearl below the floor line (1.1 m), then one
# glass canopy all the way over the roof.
METRO = [(0.0, 0.34, 'belly'), (0.5, 0.34, 'keel'), (0.94, 0.45, 'skirt'), (1.12, 0.58, 'low'), (1.20, 0.66, 'low'), (1.33, 0.85, 'lampz'),
         (1.404, 1.10, 'line'), (1.42, 1.20, 'band'), (1.45, 1.95, 'canopy'), (1.378, 2.60, 'canopy'), (1.173, 3.10, 'canopy'),
         (0.877, 3.45, 'canopy'), (0.525, 3.66, 'canopy'), (0.0, 3.75, '')]


def metro_car(m, end):
    """A floating bullet-train car: 14.5 m of rounded body, 2.9 m wide. The belly and the hover skirt are solid pearl;
    from the floor line up it is one glass canopy over the roof, carried on slim pearl ribs, with the cabin showing
    through (floor, seats, grab rails). end=True adds a long tapered nose at +x with the driver's desk in it.
    The origin is on the lane's datum (what the manifest calls rail level): floor 1.1 m above it, belly 0.34 m."""
    m.ao = 2.2
    m.glass_mat = 'glass_tint'           # smoked, slightly blue-grey glass: reflects the sky, the cabin shows faintly
    c = Capsule(m, METRO, glass=('pane_light', 'glass_c'))
    xe, dw, dz, zf = 7.25, 1.5, (1.10, 3.10), 1.10
    spans = [(-xe, -7.0, 'frame'), (-7.0, -4.37, 'plain'), (-4.37, -4.25, 'frame'), (-4.25, -2.75, 'door'), (-2.75, -2.63, 'frame'), (-2.63, -0.06, 'plain'),
             (-0.06, 0.06, 'frame'), (0.06, 2.63, 'plain'), (2.63, 2.75, 'frame'), (2.75, 4.25, 'door'), (4.25, 4.37, 'frame')]
    if not end:
        spans += [(4.37, 7.0, 'plain'), (7.0, xe, 'frame')]
    c.body(spans, dz)
    c.end_cap(-xe, -1)
    if end:
        top = len(METRO) - 1
        ts = [0.0, 0.12, 0.25, 0.38, 0.51, 0.63, 0.74, 0.84, 0.92, 0.97, 1.0]
        c.nose(4.37, 4.85, 1, 1.15, ts, [top] * len(ts), glass_to=6, lit=6, glow_to=7, pw=(2.2, 0.55), pu=(1.6, 0.75), pd=(3.0, 0.5))
        cabin(m, -xe + 0.1, 6.3, zf, 1.36, [(-6.9, -4.5), (-2.4, 2.4)], poles=(-4.4, -2.6, 2.6, 4.4))
        # the driver's place in the nose: a seat and a desk with a lit screen
        m.box(4.75, 5.2, -0.3, 0.3, zf, zf + 0.5, 'pearl_shade', top='line')
        m.box(5.6, 6.2, -0.75, 0.75, zf, zf + 0.82, 'pearl_shade', top='rubber')
        with m.use('glow'):
            m.poly([(5.62, -0.45, zf + 0.84), (6.0, -0.45, zf + 0.84), (6.0, 0.45, zf + 0.84), (5.62, 0.45, zf + 0.84)], 'hover_soft')
    else:
        c.end_cap(xe, 1)
        cabin(m, -xe + 0.1, xe - 0.1, zf, 1.36, [(-6.9, -4.5), (-2.4, 2.4), (4.5, 6.9)], poles=(-4.4, -2.6, 2.6, 4.4))
    doors = glass_doors(m, c, (-3.5, 3.5), dw, 1.10, 1.47, (6, 7, 8, 9))
    m.meta.update(forward='+x', length=14.5, width=2.9, height=3.75, floor=1.1, pitch=14.6, doorWidth=1.5, doors=doors, doorways=[-3.5, 3.5],
                  railLevel=0.0, underside=0.34, hover=True, doorTop=3.1, sideAtFloor=1.4)


@model('train_end', 'train', seed=31, ground=None, smooth=62.0)
def train_end(m):
    metro_car(m, True)


@model('train_mid', 'train', seed=32, ground=None, smooth=62.0)
def train_mid(m):
    metro_car(m, False)


# the hill pod's half cross-section: a glass bubble 2.5 m wide on a pearl base
POD = [(0.0, 0.30, 'belly'), (0.42, 0.30, 'keel'), (0.81, 0.40, 'skirt'), (0.99, 0.52, 'low'), (1.10, 0.68, 'lampz'), (1.19, 0.90, 'line'),
       (1.213, 1.00, 'band'), (1.25, 1.75, 'canopy'), (1.19, 2.35, 'canopy'), (1.01, 2.80, 'canopy'), (0.76, 3.12, 'canopy'), (0.45, 3.32, 'canopy'), (0.0, 3.40, '')]


@model('tram', 'train', seed=33, ground=None, smooth=62.0)
def tram(m):
    """The hill pod (it keeps the node name `tram`): a small flying glass bubble on a pearl base, 10.2 m long and
    2.5 m wide, rounded at both ends since it goes up and down the hill without turning. Benches show through the glass.
    Doors are child nodes that slide along x. The origin is on the lane's datum: the floor is 0.9 m above it."""
    m.ao = 2.2
    m.glass_mat = 'glass_tint'
    c = Capsule(m, POD, glass=('pane_light', 'glass_c'))
    c.body([(-3.2, -3.05, 'frame'), (-3.05, -1.75, 'door'), (-1.75, -1.65, 'frame'), (-1.65, 1.65, 'plain'), (1.65, 1.75, 'frame'), (1.75, 3.05, 'door'), (3.05, 3.2, 'frame')], (0.90, 2.80))
    top = len(POD) - 1
    ts = [0.0, 0.2, 0.4, 0.6, 0.77, 0.9, 0.97, 1.0]
    for sgn in (-1, 1):
        c.nose(sgn * 3.2, 1.9, sgn, 0.95, ts, [top] * len(ts), glass_to=5, lit=5, glow_to=5, pw=(2.0, 0.5), pu=(2.0, 0.55), pd=(2.6, 0.5))
    cabin(m, -4.2, 4.2, 0.9, 1.16, [(-1.5, 1.5)], poles=(-1.7, 1.7), rail_z=1.85, rail_y=0.42)
    for sy in (-1, 1):                       # a step plate under each doorway closes the gap to the dock
        for dx in (-2.4, 2.4):
            ya, yb = sorted((sy * 1.05, sy * 1.30))
            m.rbox(dx, (ya + yb) / 2, 1.5, yb - ya, 0.74, 0.9, 'pearl', r=0.08, seg=1, bev=0.04, bottom=True)
            m.box(dx - 0.6, dx + 0.6, min(sy * 1.3, sy * 1.302), max(sy * 1.3, sy * 1.302), 0.86, 0.9, 'seam', top=False)
    doors = glass_doors(m, c, (-2.4, 2.4), 1.3, 1.02, 1.27, (5, 6, 7, 8))
    m.meta.update(forward='+x', length=10.2, width=2.5, height=3.4, floor=0.9, doorWidth=1.3, doors=doors, doorways=[-2.4, 2.4],
                  railLevel=0.0, underside=0.30, hover=True, doorTop=2.8)


# ================================================================== lane rings: slim floating gates the trains fly through
def ring_gate(m, path, th=0.32, w_in=0.26, w_out=0.1, col='pearl', glow='hover'):
    """A slim ring standing across the lane (its axis along x). path = [(y, z, ny, nz)]: the inner edge and its
    outward normal, counter-clockwise seen from +x. The inner face is a band of light."""
    n = len(path)
    for i in range(n):
        j = (i + 1) % n
        (ya, za, na, ma), (yb, zb, nb, mb) = path[i], path[j]
        ia, ib = (ya, za), (yb, zb)
        oa, ob = (ya + na * th, za + ma * th), (yb + nb * th, zb + mb * th)
        with m.use('glow'):
            m.poly([(-w_in, *ia), (w_in, *ia), (w_in, *ib), (-w_in, *ib)], glow)
        m.poly([(w_in, *ia), (w_out, *oa), (w_out, *ob), (w_in, *ib)], tint(col, 0.2))
        m.poly([(w_out, *oa), (-w_out, *oa), (-w_out, *ob), (w_out, *ob)], col)
        m.poly([(-w_out, *oa), (-w_in, *ia), (-w_in, *ib), (-w_out, *ob)], shade(col, 0.94))


@model('lane_ring', 'lane', seed=34, ground=None, smooth=70.0, ao=1.2)
def lane_ring(m):
    """A floating ring gate for one lane: a clear round opening 5.1 m across. The origin is the ring's centre."""
    R, n = 2.55, 28
    path = [(R * math.cos(2 * math.pi * k / n), R * math.sin(2 * math.pi * k / n), math.cos(2 * math.pi * k / n), math.sin(2 * math.pi * k / n)) for k in range(n)]
    ring_gate(m, path)
    m.meta.update(axis='x', opening=[2 * R, 2 * R], lanes=[0.0], thickness=0.32, depth=0.52, centre='origin', aboveDatum=1.97)


@model('lane_ring_double', 'lane', seed=35, ground=None, smooth=70.0, ao=1.2)
def lane_ring_double(m):
    """One shared ring gate for both lanes (4.2 m apart): a rounded opening 9.3 m wide and 5.1 m high.
    The origin is the centre, midway between the lanes."""
    R, n, off = 2.55, 12, 2.1
    path = []
    for k in range(n + 1):
        a = -math.pi / 2 + math.pi * k / n
        path.append((off + R * math.cos(a), R * math.sin(a), math.cos(a), math.sin(a)))
    for k in range(n + 1):
        a = math.pi / 2 + math.pi * k / n
        path.append((-off + R * math.cos(a), R * math.sin(a), math.cos(a), math.sin(a)))
    ring_gate(m, path)
    m.meta.update(axis='x', opening=[round(2 * (R + off), 2), 2 * R], lanes=[off, -off], thickness=0.32, depth=0.52, centre='origin', aboveDatum=1.97)


# ================================================================== houses: small rounded pod homes
def flatwin(m, cx, z0, w, h, pane='pane', frame='trim', y=0.0):
    m.fq(cx - w / 2 - 0.15, cx + w / 2 + 0.15, z0 - 0.15, z0 + h + 0.15, y - 0.05, frame)
    with m.use('glow'):
        m.fq(cx - w / 2, cx + w / 2, z0, z0 + h, y - 0.08, pane)
    m.fq(cx - 0.05, cx + 0.05, z0, z0 + h, y - 0.1, frame)


def flatdoor(m, cx, w, h, col, y=0.0, frame='trim'):
    m.fq(cx - w / 2 - 0.15, cx + w / 2 + 0.15, 0, h + 0.15, y - 0.05, frame)
    m.fq(cx - w / 2, cx + w / 2, 0, h, y - 0.08, col)
    m.box(cx - w / 2 - 0.3, cx + w / 2 + 0.3, y - 0.8, y, -0.2, 0.0, 'pave_light')


def pod_door(m, x, y, col, rz=0.0, w=1.3, h=2.4):
    with m.at(x, y, 0, rz):
        m.rbox(0, 0.25, w + 0.8, 1.0, -1.5, h + 0.5, 'pearl', r=0.3, seg=2, bev=0.2)
        m.fq(-w / 2, w / 2, 0, h, -0.27, col)
        with m.use('glow'):
            m.poly([(x_, -0.29, z_) for x_, z_ in disc2(0, h * 0.7, w * 0.26, 8)], 'pane')
        m.box(-w / 2 - 0.3, w / 2 + 0.3, -1.1, -0.25, -1.5, 0.0, 'pave_light')
        m.box(w / 2 + 0.25, w / 2 + 0.35, -0.35, -0.25, h - 0.6, h - 0.2, 'pale_metal', bottom=True)
        with m.use('glow'):
            m.box(w / 2 + 0.18, w / 2 + 0.42, -0.5, -0.35, h - 0.65, h - 0.15, 'lamp', bottom=True)


def pod_win(m, x, y, z, r, rz=0.0):
    """A round window: a moulded frame standing proud of the wall, glass set into it, a slim sill."""
    with m.at(x, y, 0, rz):
        m.plate(disc2(0, z, r + 0.18, 14), 0.02, 0.09, 'pearl_hi', edge='pearl_shade')
        with m.use('glass'):
            m.poly([(x_, -0.075, z_) for x_, z_ in disc2(0, z, r, 14)], 'glass_b')
        m.fq(-r, r, z - 0.03, z + 0.03, -0.08, 'pearl_hi')
        m.box(-r * 0.7, r * 0.7, -0.08, 0.0, z - r - 0.3, z - r - 0.18, 'pearl_shade', bottom=True)


def _dome(m, cx, cy, z, r, h, col='pearl', n=20, k=5, mat='city'):
    prof = [(r * math.cos(math.pi / 2 * i / k) if i < k else 0.0, z + h * math.sin(math.pi / 2 * i / k)) for i in range(k + 1)]
    cols = [mixc(shade(col, 0.9), tint(col, 0.25), i / k) for i in range(k + 1)]
    with m.use(mat):
        m.lathe(cx, cy, prof, n, cols, cap=False)


@model('house_a', 'house', seed=41, smooth=62.0)
def house_a(m):
    """A dome home with a round window and a coral door."""
    R = 4.6
    m.cyl(0, 0, -1.5, 2.4, R, 20, 'pearl', cap=False)
    _dome(m, 0, 0, 2.4, R, 3.4)
    with m.use('glow'):
        m.lathe(0, 0, [(R + 0.03, 2.15), (R + 0.03, 2.4)], 20, 't_orange', cap=False)
    pod_door(m, 0, -R + 0.05, 't_orange')
    plinth_ring(m, 0, 0, R - 0.12, 20, h=0.3, out=0.12)
    # a small terrace beside the door: paving, a planter, a seat
    m.box(R * 0.2, R + 1.0, -R - 1.0, -R * 0.35, 0, 0.12, 'pave_light')
    m.rbox(R + 0.5, -R * 0.6, 0.9, 2.4, 0.12, 0.65, 'pearl_shade', r=0.3, seg=1, top='soil')
    m.bush(R + 0.5, -R * 0.6, 0.55, z=0.6)
    seat(m, R * 0.75, -R - 0.55, 0.0, 1.6, z=0.12)
    for a in (-0.9, 0.9, 2.2, 4.1):
        an = -math.pi / 2 + a
        pod_win(m, (R + 0.02) * math.cos(an), (R + 0.02) * math.sin(an), 1.5, 0.6, an + math.pi / 2)
    m.bush(R + 0.45, -R * 0.4, 0.8)
    m.meta.update(door=[0, round(R + 1.2, 2)])


@model('house_b', 'house', seed=42, smooth=62.0)
def house_b(m):
    """Two joined pods: a soft box and a small dome."""
    m.rbox(-1.5, 0.5, 7.4, 6.4, -1.5, 3.3, 'pearl', r=1.6, seg=3, bev=0.7, top='pearl_hi')
    m.cyl(3.6, -0.6, -1.5, 2.0, 2.9, 16, 'pearl', cap=False)
    _dome(m, 3.6, -0.6, 2.0, 2.9, 2.4, n=16)
    with m.use('glow'):
        m.lathe(3.6, -0.6, [(2.93, 1.75), (2.93, 2.0)], 16, 't_teal', cap=False)
        m.poly([(x_, -2.73, z_) for x_, z_ in rrect2(-1.9, 1.7, 3.6, 1.5, 0.5, 2)], 'pane')
    pod_door(m, 3.6, -3.5, 't_teal')
    m.rbox(-1.5, 0.5, 7.7, 6.7, 0, 0.3, 'plinth', r=1.75, seg=3)
    plinth_ring(m, 3.6, -0.6, 2.75, 16, h=0.3, out=0.15)
    m.rbox(-1.5, 0.5, 5.2, 4.0, 3.3, 3.75, 'pearl_shade', r=1.2, seg=2, top='soil')          # the roof planter
    pod_win(m, -5.22, 0.5, 1.7, 0.6, -math.pi / 2)
    pod_win(m, -1.5, 3.72, 1.7, 0.6, math.pi)
    m.blob(-2.5, 0.5, 3.95, 1.1, 'leaf', n=7, rings=3, sz=0.6)
    m.blob(-0.3, 1.0, 3.9, 0.8, 'leaf_light', n=6, rings=3, sz=0.6)
    m.meta.update(door=[3.6, 4.6])


@model('house_c', 'house', seed=43, smooth=62.0)
def house_c(m):
    """A two-storey drum home under a disc roof, with a balcony."""
    R = 3.9
    m.cyl(0, 0, -1.5, 6.4, R, 20, 'pearl', cap=False)
    m.lathe(0, 0, [(R + 0.9, 6.4), (R + 1.2, 6.7), (R + 0.8, 7.0)], 20, ['pearl_shade', 'pearl', 'pearl_hi'], cap=True, bottom=True)
    with m.use('glass'):
        m.lathe(0, 0, [(R + 0.03, 3.7), (R + 0.03, 5.6)], 20, ['glass_b', 'glass_c'], cap=False)
    m.lathe(0, 0, [(R + 0.02, 3.2), (R + 1.3, 3.2), (R + 1.3, 3.45), (R + 0.02, 3.45)], 20, 'pearl', cap=False, bottom=False)
    m.cap(ngon(R + 1.3, 20), 3.45, 'pearl_hi')
    with m.use('glow'):
        m.lathe(0, 0, [(R + 1.33, 3.25), (R + 1.33, 3.4)], 20, 't_yel', cap=False)
    pod_door(m, 0, -R + 0.05, 't_yel')
    plinth_ring(m, 0, 0, R, 20, h=0.3)
    rail_ring(m, 0, 0, 3.45, R + 1.15, n=20)                                                 # the balcony's railing
    for a in (1.2, 2.6, 4.2):
        an = -math.pi / 2 + a
        pod_win(m, (R + 0.02) * math.cos(an), (R + 0.02) * math.sin(an), 1.6, 0.55, an + math.pi / 2)
    m.bush(-R - 0.5, -R * 0.4, 0.8)
    m.meta.update(door=[0, round(R + 1.2, 2)])


@model('house_d', 'house', seed=44, smooth=62.0)
def house_d(m):
    """A beach pod: a white capsule on a low deck, with a wide window to the sea."""
    capsule(m, 0, 0, 2.3, L=10.5, r=2.4, col_a='pearl', col_b='pearl', n=16)
    m.rbox(0, 0, 9.0, 4.6, -1.5, 0.5, 'pearl_shade', r=1.2, seg=2, top='deck_wood')
    with m.use('glow'):
        m.poly([(x_, -2.42, z_) for x_, z_ in rrect2(-1.6, 2.5, 4.6, 1.5, 0.6, 2)], 'pane')
        m.poly([(x_, 2.42, z_) for x_, z_ in reversed(rrect2(0, 2.5, 5.0, 1.3, 0.6, 2))], 'pane')
    pod_door(m, 2.6, -2.25, 'roof_sage', h=2.6)
    for sx in (-1, 1):                         # the capsule rests on two cradles on the deck
        m.rbox(sx * 3.4, 0, 1.4, 3.6, 0.5, 1.0, 'pearl_shade', r=0.4, seg=2)
    m.rbox(-3.2, -2.9, 1.6, 0.8, 0.5, 0.95, 'pearl_shade', r=0.3, seg=1, top='soil')
    m.bush(-3.2, -2.9, 0.5, z=0.9)
    with m.use('glow'):
        m.box(-3.6, 3.6, -2.34, -2.3, 0.55, 0.7, 'roof_sage', top=False)
    m.meta.update(door=[2.6, 3.4])


# ================================================================== trees (nature stays natural)
def real_tree(m, trunk, clumps, branch_to=3, bark='bark'):
    """A tree with a tapering trunk, a few branches and a canopy of overlapping clumps.
    trunk = [(x, y, z, r), ...]; clumps = [(x, y, z, r, colour, squash), ...]."""
    m.tube([(x, y, z) for x, y, z, r in trunk], [r for *_, r in trunk], 6, [bark, bark, shade(bark, 0.85)][:len(trunk)] if len(trunk) <= 3 else bark, caps=False)
    tx, ty, tz, tr = trunk[-1]
    fx, fy, fz, fr = trunk[-2]
    for (cx, cy, cz, r, col, sq) in clumps[:branch_to]:
        m.tube([(fx, fy, fz + (tz - fz) * 0.3), ((fx + cx) / 2, (fy + cy) / 2, (fz + cz) / 2 + 0.4), (cx * 0.85, cy * 0.85, cz - r * 0.25)], [fr * 0.6, fr * 0.42, fr * 0.22], 4, shade(bark, 0.9), caps=False)
    for (cx, cy, cz, r, col, sq) in clumps:
        m.ball(cx, cy, cz, r * 0.97, shade(col, 0.62), n=12, rings=6, sz=sq, col1=tint(col, 0.2), rot=m.rng.random())


@model('tree_a', 'tree', seed=51, smooth=75.0)
def tree_a(m):
    """A broad round tree (an oak), about 10 m."""
    real_tree(m, [(0, 0, -0.5, 0.5), (0.1, 0.05, 2.2, 0.4), (0.2, 0.1, 4.4, 0.3)],
              [(2.3, 0.6, 6.0, 2.3, 'leaf', 0.8), (-2.1, 1.1, 6.3, 2.2, 'leaf_dark', 0.8), (-0.3, -2.2, 5.9, 2.1, 'leaf_light', 0.8),
               (0.2, 0.3, 7.6, 2.7, 'leaf', 0.8), (0.9, 2.0, 6.4, 1.8, 'leaf_dark', 0.8)])


@model('tree_b', 'tree', seed=52, smooth=75.0)
def tree_b(m):
    """A tall narrow tree (a poplar or elm), about 13 m."""
    real_tree(m, [(0, 0, -0.5, 0.42), (0.05, 0, 3.0, 0.34), (0.1, 0.05, 5.6, 0.24)],
              [(0.9, 0.3, 6.2, 1.9, 'leaf_dark', 1.1), (-0.8, 0.5, 7.6, 1.9, 'leaf', 1.1), (0.4, -0.7, 9.2, 1.8, 'leaf_dark', 1.15),
               (-0.2, 0.2, 10.9, 1.5, 'leaf', 1.2), (0.1, 0.0, 12.2, 1.0, 'leaf_light', 1.2)], branch_to=2)


@model('tree_c', 'tree', seed=53, smooth=75.0)
def tree_c(m):
    """A low spreading tree with a wide flat crown, about 8 m."""
    real_tree(m, [(0, 0, -0.5, 0.48), (0.3, 0.1, 1.8, 0.38), (0.9, 0.2, 3.6, 0.28)],
              [(3.4, 0.4, 5.4, 2.4, 'leaf_light', 0.55), (-1.6, 1.8, 5.6, 2.5, 'leaf', 0.55), (0.2, -2.3, 5.3, 2.3, 'leaf', 0.55),
               (1.0, 0.4, 6.4, 3.0, 'leaf_light', 0.5), (-0.4, 3.2, 5.0, 1.7, 'leaf_dark', 0.6)])


@model('tree_pine', 'tree', seed=55, smooth=75.0)
def tree_pine(m):
    """A pine with a bare lower trunk and layered boughs, about 13 m."""
    m.tube([(0, 0, -0.5), (0.05, 0, 4.0), (0.1, 0, 12.0)], [0.4, 0.3, 0.08], 6, ['bark', 'bark', shade('bark', 0.8)], caps=False)
    Pn = 'leaf_pine'
    for z0, z1, r in ((3.4, 6.4, 3.3), (5.2, 8.2, 2.8), (7.0, 9.8, 2.2), (8.8, 11.4, 1.6), (10.4, 13.0, 1.0)):
        m.lathe(0.05, 0, [(r * 0.35, z0 + 0.5), (r, z0), (r * 0.5, z0 + (z1 - z0) * 0.55), (0.0, z1)], 8, [shade(Pn, 0.55), shade(Pn, 0.75), Pn, tint(Pn, 0.2)], cap=False, rot=m.rng.random())


@model('palm', 'tree', seed=54, smooth=75.0)
def palm(m):
    """A coconut palm, about 10 m, with a curved ringed trunk and drooping fronds."""
    P_ = [(0, 0, -0.5), (0.15, 0, 1.4), (0.45, 0, 3.2), (0.95, 0, 5.0), (1.6, 0, 6.8), (2.3, 0, 8.4), (2.9, 0, 9.6)]
    m.tube(P_, [0.46, 0.36, 0.33, 0.3, 0.28, 0.26, 0.3], 6, ['bark', 'bark_pale', 'bark', 'bark_pale', 'bark', 'bark_pale', 'bark'], caps=False)
    top = Vector(P_[-1])
    for k in range(9):
        a = 2 * math.pi * k / 9 + 0.3
        d = Vector((math.cos(a), math.sin(a), 0))
        s_ = Vector((-math.sin(a), math.cos(a), 0))
        lift = 0.9 if k % 2 == 0 else 0.4
        spine = [top, top + d * 1.7 + Vector((0, 0, lift)), top + d * 3.3 + Vector((0, 0, lift * 0.3 - 0.5)), top + d * 4.4 + Vector((0, 0, -2.0))]
        wid = [0.25, 0.75, 0.6, 0.05]
        for i in range(3):
            q = [tuple(spine[i] - s_ * wid[i] - Vector((0, 0, 0.12 * wid[i]))), tuple(spine[i + 1] - s_ * wid[i + 1] - Vector((0, 0, 0.12 * wid[i + 1]))),
                 tuple(spine[i + 1] + s_ * wid[i + 1] - Vector((0, 0, 0.12 * wid[i + 1]))), tuple(spine[i] + s_ * wid[i] - Vector((0, 0, 0.12 * wid[i])))]
            c = ['leaf', 'leaf_light', 'leaf_dark'][(k + i) % 3]
            m.sheet(q[::-1], tint(c, 0.1), shade(c, 0.65))
    for k in range(3):
        a = 2 * math.pi * k / 3
        m.ball(top.x + 0.42 * math.cos(a), top.y + 0.42 * math.sin(a), top.z - 0.5, 0.3, 'fur_dark', n=5, rings=3)


# ================================================================== road vehicles: smooth pod cars and a driverless shuttle
def pod_shell(m, rings, col, side_glass=(), top_glass=(), roof=None, belly='pearl_shade', pane=('pane_dark', 'pane')):
    """A pod car's body. rings = [(x, width share, floor, belt, top, roof share)] from the tail to the nose.
    Between two rings the strip above the belt is glass if its number is in side_glass, and the roof strip is
    glass if it is in top_glass (that is how the wrap-round screens are made). Returns the half rings."""
    hw = rings[0][-1]
    H = []
    for x, k, z0, belt, top, kk, _ in rings:
        w = hw * k
        H.append([(x, 0.0, z0), (x, w * 0.84, z0), (x, w, z0 + 0.3), (x, w, belt), (x, w * kk, top - 0.1), (x, 0.0, top)])
    zlo, zhi = min(r[3] for r in rings), max(r[4] for r in rings)

    def gcol(p):
        return mixc(pane[0], pane[1], min(1.0, max(0.0, (p[2] - zlo) / (zhi - zlo))) ** 0.8)
    for k in range(len(H) - 1):
        a, b = H[k], H[k + 1]
        for s_ in range(5):
            q = [a[s_], a[s_ + 1], b[s_ + 1], b[s_]]
            if (s_ == 3 and k in side_glass) or (s_ == 4 and k in top_glass):
                _both(m, q, [gcol(p_) for p_ in q], 'glass')
            else:
                _both(m, q, belly if s_ == 0 else (roof if (s_ == 4 and roof) else col))
    for h_, flip in ((H[0], True), (H[-1], False)):
        ring = h_ + [(p_[0], -p_[1], p_[2]) for p_ in reversed(h_[1:-1])]
        m.poly(ring[::-1] if flip else ring, col)
    return H


def pod_wheels(m, xs, W, r=0.5, w=0.3, hub='pearl_shade'):
    """Wheels with smooth white discs, set just inside the body sides, each under a dark arch."""
    n = 12
    for wx in xs:
        for sy in (-1, 1):
            ys = sy * (W / 2 + 0.008)
            arc = [(wx + (r + 0.12) * math.cos(math.pi * t / 6), ys, r + (r + 0.12) * math.sin(math.pi * t / 6)) for t in range(7)]
            arc2 = [(x_ + (x_ - wx) * 0.22, y_, r + (z_ - r) * 1.22) for x_, y_, z_ in arc]
            for i in range(6):
                q = [arc[i], arc[i + 1], arc2[i + 1], arc2[i]]
                m.poly(q if sy > 0 else q[::-1], 'rubber')
    for wx in xs:
        for sy in (-1, 1):
            yo, yi = sy * (W / 2 + 0.03), sy * (W / 2 + 0.03 - w)
            ro = [(wx + r * math.cos(2 * math.pi * i / n + 0.39), yo, r + r * math.sin(2 * math.pi * i / n + 0.39)) for i in range(n)]
            ri = [(p_[0], yi, p_[2]) for p_ in ro]
            for i in range(n):
                j = (i + 1) % n
                q = [ro[i], ro[j], ri[j], ri[i]]
                m.poly(q if sy > 0 else q[::-1], 'rubber')
            m.poly(ro[::-1] if sy > 0 else ro, 'rubber')
            hp = [(wx + r * 0.62 * math.cos(2 * math.pi * i / n + 0.39), yo + sy * 0.015, r + r * 0.62 * math.sin(2 * math.pi * i / n + 0.39)) for i in range(n)]
            m.poly(hp[::-1] if sy > 0 else hp, hub)


def pod_lights(m, H, sill, accent='t_teal', zf=0.0):
    """A slim light bar across the nose (white) and the tail (red), and a line of light along each sill."""
    with m.use('glow'):
        for h_, sgn, c in ((H[-1], 1, 'lamp'), (H[0], -1, 't_red')):
            x, w, z = h_[3][0] + sgn * 0.015, h_[3][1] * 0.82, h_[3][2] - 0.06 + zf
            q = [(x, -w, z - 0.16), (x, w, z - 0.16), (x, w, z), (x, -w, z)]
            m.poly(q if sgn > 0 else q[::-1], c)
        xa, xb, y, z = sill
        for sy in (-1, 1):
            q = [(xa, sy * (y + 0.012), z), (xb, sy * (y + 0.012), z), (xb, sy * (y + 0.012), z + 0.1), (xa, sy * (y + 0.012), z + 0.1)]
            m.poly(q if sy < 0 else q[::-1], accent)


@model('car_a', 'car', seed=61, smooth=70.0)
def car_a(m):
    """A small bubble pod car: a pearl shell under one big curved canopy."""
    m.ao = 2.5
    W = 2.7
    H = pod_shell(m, [(-3.0, 0.70, 0.64, 0.98, 1.14, 0.80, W / 2), (-2.72, 0.90, 0.48, 1.12, 1.62, 0.78, 0), (-1.8, 1.0, 0.42, 1.16, 2.14, 0.72, 0),
                      (-0.2, 1.0, 0.42, 1.16, 2.2, 0.72, 0), (1.3, 1.0, 0.42, 1.12, 1.9, 0.74, 0), (2.5, 0.90, 0.48, 1.04, 1.26, 0.80, 0), (3.0, 0.70, 0.64, 0.92, 1.04, 0.82, 0)],
                  'pearl', side_glass=(1, 2, 3, 4), top_glass=(1, 3, 4), roof='pearl_hi')
    pod_lights(m, H, (-1.2, 0.9, W / 2, 0.52), accent='t_orange')
    for sy in (-1, 1):                         # a coral lower body and one door per side, with a seam and a handle
        q = [(-2.6, sy * (W / 2 + 0.01), 0.55), (2.4, sy * (W / 2 + 0.01), 0.55), (2.4, sy * (W / 2 + 0.01), 0.95), (-2.6, sy * (W / 2 + 0.01), 0.95)]
        m.poly(q if sy < 0 else q[::-1], 't_orange')
        for dx in (-0.95, 0.75):
            q = [(dx - 0.025, sy * (W / 2 + 0.02), 0.5), (dx + 0.025, sy * (W / 2 + 0.02), 0.5), (dx + 0.025, sy * (W / 2 + 0.02), 1.15), (dx - 0.025, sy * (W / 2 + 0.02), 1.15)]
            m.poly(q if sy < 0 else q[::-1], 'seam')
    pod_wheels(m, (-1.9, 1.9), W)
    m.meta.update(forward='+x')


@model('car_b', 'car', seed=62, smooth=70.0)
def car_b(m):
    """A long low pod car in soft silver, with a glass roof."""
    m.ao = 2.5
    W = 2.7
    H = pod_shell(m, [(-3.3, 0.68, 0.62, 0.94, 1.06, 0.80, W / 2), (-3.0, 0.90, 0.48, 1.06, 1.36, 0.80, 0), (-1.7, 1.0, 0.42, 1.10, 1.80, 0.70, 0),
                      (0.1, 1.0, 0.42, 1.10, 1.86, 0.70, 0), (1.7, 1.0, 0.42, 1.08, 1.46, 0.76, 0), (2.9, 0.90, 0.48, 1.0, 1.16, 0.80, 0), (3.3, 0.68, 0.62, 0.9, 1.0, 0.82, 0)],
                  'brushed', side_glass=(1, 2, 3, 4), top_glass=(1, 2, 3, 4))
    pod_lights(m, H, (-1.3, 1.3, W / 2, 0.52), accent='hover')
    for sy in (-1, 1):                         # two doors per side
        for dx in (-1.45, 0.05, 1.5):
            q = [(dx - 0.025, sy * (W / 2 + 0.02), 0.5), (dx + 0.025, sy * (W / 2 + 0.02), 0.5), (dx + 0.025, sy * (W / 2 + 0.02), 1.1), (dx - 0.025, sy * (W / 2 + 0.02), 1.1)]
            m.poly(q if sy < 0 else q[::-1], 'seam')
    pod_wheels(m, (-2.1, 2.1), W)
    m.meta.update(forward='+x')


@model('car_c', 'car', seed=63, smooth=70.0)
def car_c(m):
    """A tall pod van with a rounded glass nose."""
    m.ao = 2.5
    W = 2.8
    H = pod_shell(m, [(-3.2, 0.80, 0.60, 1.25, 2.20, 0.80, W / 2), (-2.95, 0.95, 0.46, 1.30, 2.56, 0.82, 0), (-0.9, 1.0, 0.42, 1.30, 2.68, 0.84, 0),
                      (1.1, 1.0, 0.42, 1.30, 2.62, 0.82, 0), (2.3, 0.95, 0.44, 1.24, 1.96, 0.78, 0), (2.95, 0.84, 0.52, 1.10, 1.34, 0.80, 0), (3.2, 0.70, 0.64, 0.96, 1.08, 0.82, 0)],
                  'pearl_hi', side_glass=(2, 3, 4), top_glass=(3, 4))
    for sy in (-1, 1):                         # a band of the island's teal along the load space
        q = [(-2.7, sy * (W / 2 + 0.012), 1.45), (-1.1, sy * (W / 2 + 0.012), 1.45), (-1.1, sy * (W / 2 + 0.012), 1.75), (-2.7, sy * (W / 2 + 0.012), 1.75)]
        m.poly(q if sy < 0 else q[::-1], 't_teal')
    pod_lights(m, H, (-1.2, 1.1, W / 2, 0.52))
    pod_wheels(m, (-2.0, 2.0), W)
    m.meta.update(forward='+x')


# the shuttle's half cross-section: 3.2 m wide
SHUTTLE = [(0.0, 0.45, 'keel'), (1.25, 0.45, 'keel'), (1.52, 0.62, 'low'), (1.6, 0.95, 'low'), (1.6, 1.40, 'line'), (1.6, 1.52, 'waist'),
           (1.6, 1.66, 'band'), (1.6, 2.95, 'top'), (1.48, 3.34, 'roof'), (0.9, 3.58, 'roof'), (0.0, 3.62, '')]


@model('bus', 'car', seed=64, smooth=62.0)
def bus(m):
    """The island shuttle: a rounded driverless bus, the same at both ends, pearl with a teal line and a long band of glass.
    Doors on the right-hand side (it keeps right, like the trains)."""
    m.ao = 3.0
    c = Capsule(m, SHUTTLE, accent='t_teal')
    c.body([(-4.0, 4.0, 'plain')], (9.0, 9.0))
    ts, vis = [0.0, 0.4, 0.72, 0.9, 1.0], [7, 9, 10, 10, 10]
    for sgn in (-1, 1):
        c.nose(sgn * 4.0, 1.5, sgn, 1.46, ts, vis, glass_to=4, lit=2, glow_to=0, pw=(3.4, 0.5), pu=(3.0, 0.5), pd=(3.4, 0.5))
    hw = 1.6
    for sy in (-1, 1):
        ys = sy * (hw + 0.014)

        def sq(xa, xb, za, zb, col, mat='city', sy=sy, ys=ys):
            q = [(xa, ys, za), (xb, ys, za), (xb, ys, zb), (xa, ys, zb)]
            with m.use(mat):
                m.poly(q if sy < 0 else q[::-1], col)
        for px in ((-2.0, 2.0) if sy > 0 else (0.0,)):
            sq(px - 0.07, px + 0.07, 1.66, 2.95, 'pearl')
        if sy < 0:
            for dx in (-2.6, 2.6):
                sq(dx - 0.75, dx + 0.75, 0.72, 2.95, 'pane_dark', 'glass')
                sq(dx - 0.03, dx + 0.03, 0.72, 2.95, 'seam')
                sq(dx - 0.8, dx - 0.75, 0.72, 2.95, 'pearl')
                sq(dx + 0.75, dx + 0.8, 0.72, 2.95, 'pearl')
                with m.use('glow'):
                    q = [(dx - 0.35, ys, 3.0), (dx + 0.35, ys, 3.0), (dx + 0.35, sy * 1.58, 3.08), (dx - 0.35, sy * 1.58, 3.08)]
                    m.poly(q, 'lamp_warm')
    pod_wheels(m, (-3.1, 3.1), 3.2, 0.58, 0.34)
    m.meta.update(forward='+x', doorSide='+z')


# ================================================================== street furniture
@model('streetlamp', 'prop', seed=71, smooth=62.0)
def streetlamp(m):
    """A sleek street lamp, 7 m: a slim curved mast with a disc of light. The head reaches towards the front."""
    m.cyl(0, 0, 0, 0.5, 0.2, 8, 'pearl_shade')
    m.tube([(0, 0, 0.4), (0, 0, 5.2), (0, -0.5, 6.4), (0, -1.5, 6.95)], [0.1, 0.085, 0.075, 0.07], 6, 'pearl', caps=False)
    m.lathe(0, -1.6, [(0.55, 6.86), (0.6, 6.95), (0.3, 7.08), (0.0, 7.1)], 10, 'pearl', cap=False)
    with m.use('glow'):
        m.cap(ngon(0.52, 10, 0, -1.6), 6.85, 'lamp', up=False)
    m.meta.update(lamp=[0, 6.85, 1.6])


@model('bench', 'prop', seed=72, smooth=62.0)
def bench(m):
    """A sleek bench: a soft white seat on two brushed-metal feet."""
    m.rbox(0, 0, 2.4, 0.6, 0.42, 0.56, 'pearl', r=0.25, seg=2, bottom=True)
    m.rbox(0, -0.28, 2.4, 0.12, 0.56, 1.0, 'pearl', r=0.05, seg=1, bottom=True)
    for sx in (-0.8, 0.8):
        m.cbox(sx, 0, 0.14, 0.44, 0, 0.42, 'brushed', top=False)


# ================================================================== boats
def hull(m, L, W, H, col, deck='deck_wood', stripe=None, draft=0.8, stern=0.7, n=6, bow=0.55, bottom='navy'):
    """A simple hull from stern (-x) to bow (+x) with a flush deck; waterline at 0. The stripe runs along the top edge."""
    hw = W / 2
    rings, colr = [], []
    xs = [-L / 2 + L * i / n for i in range(n + 1)]
    for i, x in enumerate(xs):
        t = i / n
        k = stern + (1 - stern) * min(1, t * 3) if t < 0.45 else max(0.0, 1 - ((t - 0.45) / 0.55) ** 1.8)
        k = max(k, 0.0)
        sheer = H + (0.5 * H) * max(0, t - bow) ** 1.5 * 3
        if i == n:
            half = [(0.0, -draft * 0.3), (0.001, -draft * 0.2), (0.002, 0.1), (0.002, 0.12), (0.003, sheer - 0.32), (0.003, sheer - 0.3), (0.003, sheer), (0.003, sheer)]
        else:
            half = [(0.0, -draft), (hw * k * 0.55, -draft * 0.85), (hw * k * 0.93, 0.1), (hw * k * 0.93, 0.12), (hw * k * 0.99, sheer - 0.32), (hw * k * 0.99, sheer - 0.3), (hw * k, sheer), (hw * k, sheer)]
        ring = [(x, y, z) for y, z in half] + [(x, -y, z) for y, z in reversed(half)]
        rings.append(ring)
        sc = stripe if stripe else col
        hc = [bottom, bottom, bottom, col, col, sc, sc, deck]          # the last point is doubled so the deck keeps its own colour
        colr.append(hc + hc[::-1])
    m.loft(rings, colr, caps=(True, False))


def glass_canopy(m, cx, z, L, w, h, col=('glass_b', 'glass_c'), n=10, base=None):
    """A long streamlined glass canopy (half an egg lying along x) on the plane z."""
    r = w / 2
    with m.at(cx, 0, 0, math.pi / 2):
        if base:
            m.lathe(0, 0, [(r + 0.12, z - 0.02), (r + 0.12, z + 0.16), (r, z + 0.2)], n, base, cap=False, sy=L / w)
        with m.use('glass'):
            m.lathe(0, 0, [(r, z + (0.2 if base else 0.0)), (r * 0.93, z + h * 0.45), (r * 0.62, z + h * 0.84), (0.0, z + h)], n,
                    [col[0], col[0], col[1], col[1]], cap=False, sy=L / w)


@model('boat_sail', 'boat', seed=81, ground=None, smooth=62.0)
def boat_sail(m):
    """A sleek sailing yacht: a pearl hull, a low glass canopy and two clean white sails. Waterline at 0."""
    L, W = 9.5, 2.9
    hull(m, L, W, 0.95, 'pearl', deck='pearl_hi', stripe='t_blue')
    glass_canopy(m, -0.9, 0.75, 4.0, 1.7, 0.85, base='pearl')
    m.tube([(0.9, 0, 0.75), (0.9, 0, 6.0), (0.9, 0, 11.8)], [0.11, 0.09, 0.04], 5, 'pearl', caps=False)
    m.beam((0.9, 0, 2.05), (-4.0, 0, 2.15), 0.1, 0.12, 'pearl_shade')
    S, Sh = 'pearl_hi', 'pearl'
    for q in ([(0.78, 0.02, 2.3), (-3.9, 0.12, 2.4), (-1.9, 0.5, 6.3)], [(0.78, 0.02, 2.3), (-1.9, 0.5, 6.3), (0.8, 0.02, 11.5)]):
        m.sheet(q, [S, S, Sh], [Sh, Sh, S])
    for q in ([(1.1, 0.0, 1.5), (2.7, -0.3, 4.6), (4.45, -0.1, 1.2)], [(1.1, 0.0, 1.5), (1.0, 0.0, 10.2), (2.7, -0.3, 4.6)]):
        m.sheet(q, [S, Sh, S], [Sh, S, Sh])
    m.sheet([(0.8, 0.03, 10.3), (-0.42, 0.2, 8.6), (0.8, 0.03, 8.5)][::-1], 't_blue')
    # the rigging: a forestay to the bow, a backstay to the stern, shrouds to each side on a spreader
    for a, b in (((0.9, 0, 11.7), (4.5, 0, 1.05)), ((0.9, 0, 11.7), (-4.6, 0, 1.0)),
                 ((0.9, 0, 7.5), (0.9, 0.75, 7.5)), ((0.9, 0, 7.5), (0.9, -0.75, 7.5))):
        m.tube([a, b], 0.018, 3, 'pale_metal', caps=False)
    for sy in (-1, 1):
        m.tube([(0.9, 0, 11.0), (0.9, sy * 0.75, 7.5), (0.7, sy * 1.3, 1.0)], 0.018, 3, 'pale_metal', caps=False)
        m.tube([(4.0, sy * 0.35, 1.75), (3.2, sy * 0.95, 1.7), (-3.0, sy * 1.3, 1.6), (-4.4, sy * 1.0, 1.6)], 0.025, 3, 'pale_metal', caps=False)
        for px in (3.6, 1.0, -1.6, -4.0):
            m.cyl(px, sy * (1.3 if -3 < px < 3 else 1.0), 0.95, 1.65, 0.02, 3, 'pale_metal', cap=False)
    with m.use('glow'):
        m.ball(0.9, 0, 11.9, 0.14, 'lamp', n=4, rings=2)
    m.meta.update(forward='+x', waterline=0.0)


@model('boat_fishing', 'boat', seed=82, ground=None, smooth=62.0)
def boat_fishing(m):
    """A sleek fishing launch: a pearl hull, a round glass wheelhouse under a disc roof, and a smooth arch over the
    working deck with a net float hanging from it. Waterline at 0."""
    L, W = 11.5, 3.8
    hull(m, L, W, 1.3, 'pearl', deck='pearl_hi', stripe='t_teal', draft=1.0)
    cx = 1.7
    m.lathe(cx, 0, [(1.36, 1.05), (1.36, 1.75)], 12, 'pearl', cap=False, sy=0.92)
    with m.use('glass'):
        m.lathe(cx, 0, [(1.34, 1.75), (1.3, 2.95)], 12, ['glass_b', 'glass_c'], cap=False, sy=0.92)
    m.lathe(cx - 0.15, 0, [(1.75, 2.95), (1.95, 3.1), (1.75, 3.28), (0.0, 3.5)], 12, ['pearl_shade', 'pearl', 'pearl_hi', 'pearl_hi'], cap=False, bottom=True, sy=0.86)
    with m.use('glow'):
        m.lathe(cx - 0.15, 0, [(1.97, 3.04), (1.97, 3.16)], 12, 't_teal', cap=False, sy=0.86)
    m.tube([(cx - 0.3, 0, 3.4), (cx - 0.45, 0, 5.0), (cx - 0.7, 0, 6.3)], [0.08, 0.06, 0.03], 4, 'pearl', caps=False)
    with m.use('glow'):
        m.ball(cx - 0.72, 0, 6.42, 0.15, 'lamp', n=4, rings=2)
    # the arch over the working deck, and the float hanging from it
    ax = -3.3
    m.tube([(ax, -1.45, 1.05), (ax, -1.4, 2.6), (ax, -0.8, 3.5), (ax, 0.0, 3.8), (ax, 0.8, 3.5), (ax, 1.4, 2.6), (ax, 1.45, 1.05)], 0.11, 5, 'pearl', caps=False)
    m.beam((ax, 0, 3.7), (ax, 0, 2.75), 0.04, 0.04, 'seam')
    m.lathe(ax, 0, [(0.0, 1.95), (0.42, 2.2), (0.42, 2.5), (0.0, 2.78)], 6, 't_orange', cap=False)
    m.rbox(-1.3, 0.55, 1.5, 0.9, 1.1, 1.6, 't_teal', r=0.25, seg=1, bev=0.1)
    m.rbox(-1.5, -0.6, 1.1, 0.8, 1.1, 1.5, 'pearl_shade', r=0.25, seg=1, bev=0.1)
    for bx in (-2.2, 1.6):
        m.ball(bx, -W / 2 * 0.9, 0.95, 0.28, 't_orange', n=5, rings=3)
    m.meta.update(forward='+x', waterline=0.0)


# the ferry's cabin, half cross-section: two decks of glass with the line's red between them
FERRY = [(0.0, 2.2, 'keel'), (3.2, 2.2, 'low'), (3.4, 2.5, 'low'), (3.4, 3.05, 'band2'), (3.4, 4.45, 'line'), (3.4, 4.7, 'waist'),
         (3.4, 4.95, 'band'), (3.4, 6.3, 'top'), (3.22, 6.9, 'roof'), (2.2, 7.32, 'roof'), (0.0, 7.45, '')]


@model('ferry', 'boat', seed=83, ground=None, smooth=62.0)
def ferry(m):
    """The island ferry, about 34 m: one long smooth cabin with two decks of glass on a pearl hull, a glass bridge
    on the roof and a slim red fin. Waterline at 0."""
    L, W = 34.0, 9.0
    hull(m, L, W, 2.4, 'pearl', deck='pearl_hi', stripe='line', draft=1.4, stern=0.92, n=8, bow=0.6)
    c = Capsule(m, FERRY, glow=None, glass=('glass_b', 'glass_c'))
    xa, xb = -11.5, 4.5
    c.body([(xa, xb, 'plain')], (99.0, 99.0))
    c.nose(xa, 3.0, -1, 4.57, [0.0, 0.45, 0.8, 1.0], [7, 7, 7, 7], glass_to=2, lit=99, glow_to=0, pw=(3.0, 0.5), pu=(3.0, 0.5), pd=(9.0, 0.5))
    c.nose(xb, 7.2, 1, 4.57, [0.0, 0.2, 0.4, 0.58, 0.74, 0.87, 0.96, 1.0], [7, 9, 10, 10, 10, 10, 10, 10], glass_to=6, lit=5, glow_to=0,
           pw=(2.2, 0.5), pu=(1.8, 0.6), pd=(7.0, 0.5))
    for sy in (-1, 1):                         # slim pillars along both decks
        ys = sy * 3.415
        for k in range(1, 7):
            px = xa + (xb - xa) * k / 7
            for za, zb in ((3.05, 4.45), (4.95, 6.3)):
                q = [(px - 0.09, ys, za), (px + 0.09, ys, za), (px + 0.09, ys, zb), (px - 0.09, ys, zb)]
                m.poly(q if sy < 0 else q[::-1], 'pearl')
    # the bridge: a glass canopy on the roof, and a slim fin with a light
    glass_canopy(m, 2.2, 7.25, 7.0, 3.6, 1.7, n=12, base='pearl')
    fin = [(-7.6, 7.3), (-4.4, 7.3), (-6.4, 11.4), (-7.4, 11.4)]
    for sy in (-1, 1):
        q = [(x_, sy * 0.14, z_) for x_, z_ in fin[:2]] + [(x_, sy * 0.05, z_) for x_, z_ in fin[2:]]
        m.poly(q if sy < 0 else q[::-1], 'line')
    m.poly([(fin[1][0], -0.14, fin[1][1]), (fin[1][0], 0.14, fin[1][1]), (fin[2][0], 0.05, fin[2][1]), (fin[2][0], -0.05, fin[2][1])], 'line')
    m.poly([(fin[0][0], 0.14, fin[0][1]), (fin[0][0], -0.14, fin[0][1]), (fin[3][0], -0.05, fin[3][1]), (fin[3][0], 0.05, fin[3][1])], 'line')
    with m.use('glow'):
        m.ball(-6.9, 0, 11.6, 0.24, 'lamp', n=5, rings=3)
    # the open stern deck: a glass rail, and a flag
    with m.use('glass'):
        for sy in (-1, 1):
            m.sheet([(-16.4, sy * 3.9, 2.25), (-14.3, sy * 3.9, 2.25), (-14.3, sy * 3.9, 3.3), (-16.4, sy * 3.9, 3.3)], 'glass_c')
        m.sheet([(-16.4, -3.9, 2.25), (-16.4, 3.9, 2.25), (-16.4, 3.9, 3.3), (-16.4, -3.9, 3.3)], 'glass_c')
    for sy in (-1, 1):                         # rails along the foredeck, on posts
        pts = [(5.5, sy * 3.75, 2.3), (9.0, sy * 3.05, 2.42), (12.5, sy * 2.0, 2.75), (15.5, sy * 0.8, 3.25)]
        m.tube([(x_, y_, z_ + 1.0) for x_, y_, z_ in pts], 0.04, 3, 'pale_metal', caps=False)
        for x_, y_, z_ in pts:
            m.cyl(x_, y_, z_ - 0.1, z_ + 1.0, 0.035, 4, 'pale_metal', cap=False)
    # the gangway: folded up against the side by the stern doors, on a hinge, with its own handrails
    with m.at(-12.6, -3.55, 2.3):
        m.box(-1.0, 1.0, -0.12, 0.0, 0.0, 3.2, 'brushed', bottom=True)
        for sx in (-1, 1):
            m.box(sx * 1.0 - 0.05, sx * 1.0 + 0.05, -0.5, -0.12, 0.0, 3.2, 'pale_metal', bottom=True)
        m.cyl(0, -0.05, -0.1, 0.1, 0.12, 6, 'iron') if False else None
    m.cyl(-16.2, 0, 2.25, 5.4, 0.06, 4, 'pearl', cap=False)
    m.sheet([(-16.25, 0, 4.2), (-16.25, 0, 5.3), (-17.5, 0.1, 5.05), (-17.5, 0.1, 4.45)], 'line')
    m.meta.update(forward='+x', waterline=0.0)


# ================================================================== the lighthouse
@model('lighthouse', 'landmark', seed=85, smooth=62.0)
def lighthouse(m):
    """A smooth white spire that tapers up to a glass lamp room under a pointed cap, with the keeper's pod beside it.
    Child node lighthouse_lamp turns about the vertical axis."""
    m.lathe(0, 0, [(6.5, -3.0), (5.9, 0.15), (5.2, 0.7), (3.4, 0.9)], 18, ['plinth', 'pearl_shade', 'pearl', 'pearl'], cap=True)
    H, z0 = 21.0, 0.9
    zt = z0 + H

    def rad(z):
        t = (z - z0) / H
        return 1.4 + 1.95 * (1 - t) ** 2.3
    prof, cols = [], []
    for k in range(9):
        z = z0 + H * (k / 8) ** 0.9
        prof.append((rad(z), z))
        cols.append(mixc('pearl', 'pearl_hi', k / 8))
    m.lathe(0, 0, prof, 16, cols, cap=False)
    with m.use('glow'):                      # two rings of light in the line's red: one low, one under the gallery
        for zz, hh in ((z0 + H * 0.3, 0.3), (zt - 1.7, 0.4)):
            m.lathe(0, 0, [(rad(zz) + 0.04, zz), (rad(zz + hh) + 0.04, zz + hh)], 16, 'line', cap=False)
    # the gallery: a smooth disc; the lamp room: a drum of glass; the cap: a point with a needle
    m.lathe(0, 0, [(1.42, zt - 1.1), (2.9, zt - 0.15), (3.15, zt + 0.1), (2.9, zt + 0.3)], 16, ['pearl_shade', 'pearl', 'pearl_hi', 'pearl_hi'], cap=True)
    m.lathe(0, 0, [(1.95, zt + 0.3), (1.95, zt + 1.0)], 12, 'pearl', cap=False)
    for k in range(12):                      # the gallery's rail
        a = 2 * math.pi * k / 12
        m.cyl(2.85 * math.cos(a), 2.85 * math.sin(a), zt + 0.3, zt + 1.4, 0.04, 4, 'pale_metal', cap=False)
    m.torus(0, 0, zt + 1.4, 2.85, 0.045, 12, 3, 'pale_metal', axis='z')
    m.torus(0, 0, zt + 0.85, 2.85, 0.03, 12, 3, 'pale_metal', axis='z')
    with m.use('glass'):
        m.lathe(0, 0, [(1.85, zt + 1.0), (1.95, zt + 2.4), (1.85, zt + 3.7)], 12, ['glass_b', 'glass_c', 'glass_c'], cap=False)
    m.lathe(0, 0, [(2.25, zt + 3.65), (2.3, zt + 3.85), (1.5, zt + 4.7), (0.45, zt + 5.5), (0.12, zt + 6.0), (0.04, zt + 6.9)], 12,
            ['pearl_shade', 'pearl', 'pearl_hi', 'pearl_hi', 'pale_metal', 'pale_metal'], cap=False, bottom=True)
    with m.use('glow'):
        m.lathe(0, 0, [(2.32, zt + 3.68), (2.32, zt + 3.82)], 12, 'line', cap=False)
        m.ball(0, 0, zt + 6.9, 0.16, 't_red', n=4, rings=2)
    with m.at(0, -rad(z0) + 0.15, z0):
        pod_door(m, 0, 0, 'line')
    for i, zz in enumerate((6.5, 11.0, 15.5)):
        a = -math.pi / 2 + (i - 1) * 0.9
        r = rad(zz) + 0.03
        pod_win(m, r * math.cos(a), r * math.sin(a), zz, 0.42, a + math.pi / 2)
    # the keeper's pod
    m.cyl(6.4, 1.5, -1.5, 2.6, 3.2, 16, 'pearl', cap=False)
    _dome(m, 6.4, 1.5, 2.6, 3.2, 2.4, n=16)
    with m.use('glow'):
        m.lathe(6.4, 1.5, [(3.23, 2.35), (3.23, 2.6)], 16, 'line', cap=False)
    pod_door(m, 6.4, 1.5 - 3.15, 'line')
    pod_win(m, 6.4 + 3.22, 1.5, 1.6, 0.55, math.pi / 2)
    # the lamp
    m.part('lamp', pivot=(0, 0, zt + 2.4))
    with m.use('glow'):
        m.cyl(0, 0, zt + 1.3, zt + 3.4, 0.5, 8, 'lamp')
        for sx in (-1, 1):
            with m.at(0, 0, zt + 2.4, 0.0 if sx > 0 else math.pi):
                with m.at(0.5, 0, 0, ry=math.pi / 2):
                    m.lathe(0, 0, [(0.5, 0.0), (0.95, 0.55), (0.75, 0.7), (0.0, 0.78)], 8, ['lamp_warm', 'lamp', 'lamp', 'trim'], cap=False)
    m.part('')
    m.meta.update(height=round(zt + 6.9, 1), lampHeight=round(zt + 2.4, 1), door=[0, 4.5])


# ================================================================== beach
@model('umbrella', 'prop', seed=86, smooth=62.0)
def umbrella(m):
    """A beach shade: a smooth white disc with a teal rim on a slim stem."""
    m.cyl(0, 0, -0.5, 2.7, 0.055, 5, 'pearl', cap=False)
    m.lathe(0, 0, [(2.1, 2.3), (2.07, 2.42), (2.07, 2.42), (1.62, 2.72), (0.9, 2.95), (0.0, 3.05)], 12, ['t_teal', 't_teal', 'pearl_hi', 'pearl_hi', 'pearl_hi', 'pearl_hi'], cap=False)
    m.poly([(2.1 * math.cos(2 * math.pi * k / 12), -2.1 * math.sin(2 * math.pi * k / 12), 2.3) for k in range(12)], 'pearl_shade')


@model('sunbed', 'prop', seed=87, smooth=62.0)
def sunbed(m):
    """A sleek sun lounger: one curved white shell with a teal pad on a slim foot (head towards -x)."""
    line = [(1.0, 0.30), (0.2, 0.33), (-0.28, 0.42), (-0.95, 0.94)]
    hw, th = 0.35, 0.07
    rings = []
    for x, z in reversed(line):
        rings.append([(x, -hw, z - th), (x, hw, z - th), (x, hw, z), (x, -hw, z)])
    m.loft(rings, ['pearl_shade', 'pearl', 'pearl', 'pearl'][:1] * len(rings) if False else 'pearl')
    for (xa, za), (xb, zb) in zip(line[:-1], line[1:]):
        m.poly([(xb, -hw + 0.07, zb + 0.012), (xa, -hw + 0.07, za + 0.012), (xa, hw - 0.07, za + 0.012), (xb, hw - 0.07, zb + 0.012)], 't_teal')
    m.cbox(0.35, 0, 0.7, 0.3, 0, 0.26, 'pearl_shade', top=False)


# ================================================================== animals (simple and charming, not realistic)
@model('gull', 'animal', smooth=80.0, ao=1.5, seed=91, ground=None)
def gull(m):
    """A seagull in flight (wingspan about 2.6 m). The wings are child nodes that flap about the body line."""
    W_, G = 'trim', 'steel_light'
    rings = [[(-0.62, 0.0, 0.02)] * 4,
             [(-0.2, 0.0, -0.13), (-0.2, 0.15, 0.0), (-0.2, 0.0, 0.13), (-0.2, -0.15, 0.0)],
             [(0.25, 0.0, -0.11), (0.25, 0.12, 0.02), (0.25, 0.0, 0.14), (0.25, -0.12, 0.02)],
             [(0.48, 0.0, 0.02), (0.48, 0.06, 0.07), (0.48, 0.0, 0.13), (0.48, -0.06, 0.07)]]
    m.loft(rings, [W_, W_, W_, W_], caps=(False, False))
    m.poly([(0.48, 0.0, 0.02), (0.48, 0.06, 0.07), (0.72, 0.0, 0.05)], 't_orange')
    m.poly([(0.48, 0.06, 0.07), (0.48, 0.0, 0.13), (0.72, 0.0, 0.05)], 't_orange')
    m.poly([(0.48, 0.0, 0.13), (0.48, -0.06, 0.07), (0.72, 0.0, 0.05)], 't_orange')
    m.poly([(0.48, -0.06, 0.07), (0.48, 0.0, 0.02), (0.72, 0.0, 0.05)], 't_orange')
    m.sheet([(-0.5, -0.12, 0.03), (-0.85, 0.0, 0.03), (-0.5, 0.12, 0.03)][::-1], G)
    for sy, nm in ((1, 'wing_l'), (-1, 'wing_r')):
        m.part(nm, pivot=(0.0, sy * 0.1, 0.06))
        a = [(0.2, sy * 0.1, 0.06), (-0.18, sy * 0.1, 0.06), (-0.22, sy * 0.75, 0.16), (0.16, sy * 0.75, 0.16)]
        b = [(0.16, sy * 0.75, 0.16), (-0.22, sy * 0.75, 0.16), (-0.3, sy * 1.3, 0.08), (-0.12, sy * 1.3, 0.08)]
        m.sheet(a if sy > 0 else a[::-1], [G, G, G, G], W_)
        m.sheet(b if sy > 0 else b[::-1], [G, G, 'iron', 'iron'] if sy > 0 else ['iron', 'iron', G, G], W_)
    m.part('')
    m.meta.update(forward='+x', wingspan=2.6)


@model('dolphin', 'animal', smooth=80.0, ao=1.5, seed=92, ground=None)
def dolphin(m):
    """A dolphin caught mid-leap (about 4 m). Water surface at 0."""
    G, Bc = 'skin_grey', 'trim'

    def ring(x, z, r, k=1.0):
        return [(x, 0.0, z - r * 0.9), (x, r * k, z - r * 0.25), (x, r * k * 0.8, z + r * 0.6), (x, 0.0, z + r), (x, -r * k * 0.8, z + r * 0.6), (x, -r * k, z - r * 0.25)]
    arc = lambda x: 1.15 - 0.2 * x * x
    xs = [-2.0, -1.5, -0.8, 0.0, 0.75, 1.25, 1.55]
    rs = [0.1, 0.2, 0.37, 0.46, 0.42, 0.32, 0.17]
    rings = [ring(x, arc(x), r) for x, r in zip(xs, rs)]
    cols = [[Bc, shade(G, 1.05), G, shade(G, 0.85), G, shade(G, 1.05)]] * len(rings)
    m.loft(rings, cols, caps=(True, False))
    tip = (1.95, 0.0, arc(1.95) - 0.02)
    last = rings[-1]
    for i in range(6):
        m.poly([last[i], last[(i + 1) % 6], tip], G)
    m.sheet([(0.25, 0, arc(0.25) + 0.4), (-0.55, 0, arc(-0.55) + 0.3), (-0.35, 0, arc(-0.3) + 0.95)], shade(G, 0.85))
    for sy in (-1, 1):
        f = [(0.9, sy * 0.3, arc(0.9) - 0.2), (0.45, sy * 0.32, arc(0.45) - 0.25), (0.35, sy * 0.85, arc(0.4) - 0.6)]
        m.sheet(f if sy > 0 else f[::-1], shade(G, 0.9))
        t = [(-1.95, 0.0, arc(-1.95)), (-2.45, sy * 0.6, arc(-2.4) - 0.05), (-2.2, 0.0, arc(-2.2) - 0.02)]
        m.sheet(t if sy < 0 else t[::-1], shade(G, 0.85))
        m.ball(1.32, sy * 0.27, arc(1.32) + 0.08, 0.05, 'black', n=4, rings=2)
    m.meta.update(forward='+x', waterline=0.0)


def legs4(m, pts, r, h, col, z=0.0, n=8):
    for x, y in pts:
        m.cyl(x, y, z, z + h, r * 0.8, n, col, r2=r, cap=False)


def body(m, x, z, r, length, col, col1, n=10, rings=6, sq=0.92):
    """One smooth egg-shaped body lying along x."""
    with m.at(x, 0, 0, math.pi / 2):
        m.ball(0, 0, z, r, col, n=n, rings=rings, sz=sq, col1=col1, sy=length / (2 * r))


@model('sheep', 'animal', smooth=80.0, ao=1.5, seed=93)
def sheep(m):
    """A woolly sheep (about 2.2 m long: the island's animals are drawn large so they can be seen)."""
    legs4(m, [(-0.55, -0.28), (-0.55, 0.28), (0.5, -0.28), (0.5, 0.28)], 0.11, 0.7, 'fur_dark')
    body(m, 0, 1.12, 0.62, 2.0, shade('wool', 0.8), 'wool')
    m.ball(0.2, 0, 1.55, 0.45, 'wool', n=8, rings=4, sz=0.6)
    m.ball(1.02, 0, 1.38, 0.3, 'fur_dark', n=8, rings=5, sz=1.15, sy=0.8)
    m.ball(0.86, 0, 1.64, 0.26, 'wool', n=7, rings=4, sz=0.8)
    for sy in (-1, 1):
        m.sheet([(0.92, sy * 0.2, 1.5), (0.85, sy * 0.52, 1.38), (1.02, sy * 0.24, 1.38)], 'fur_dark')
        m.ball(1.2, sy * 0.13, 1.45, 0.04, 'trim', n=4, rings=2)
    m.ball(-1.0, 0, 1.2, 0.16, 'wool', n=6, rings=3)
    m.meta.update(forward='+x')


@model('deer', 'animal', smooth=80.0, ao=1.5, seed=94)
def deer(m):
    """A deer with small antlers (about 2.6 m long)."""
    F, Fd = 'fur', 'fur_dark'
    legs4(m, [(-0.75, -0.22), (-0.75, 0.22), (0.7, -0.22), (0.7, 0.22)], 0.09, 1.25, Fd)
    body(m, 0, 1.62, 0.5, 2.1, 'bark_pale', F, sq=0.9)
    m.tube([(0.7, 0, 1.75), (1.05, 0, 2.3), (1.2, 0, 2.7)], [0.3, 0.22, 0.2], 8, F, caps=False)
    m.ball(1.3, 0, 2.8, 0.27, F, n=8, rings=5, sz=0.9)
    m.tube([(1.4, 0, 2.75), (1.75, 0, 2.62)], [0.18, 0.1], 7, [F, 'bark_pale'])
    m.ball(1.78, 0, 2.62, 0.06, 'black', n=5, rings=3)
    for sy in (-1, 1):
        m.sheet([(1.15, sy * 0.18, 2.95), (1.05, sy * 0.5, 3.15), (1.28, sy * 0.2, 3.0)], Fd)
        m.tube([(1.2, sy * 0.12, 3.0), (1.1, sy * 0.3, 3.5), (1.25, sy * 0.42, 3.9)], [0.05, 0.045, 0.02], 4, 'bone', caps=False)
        m.tube([(1.1, sy * 0.3, 3.5), (0.85, sy * 0.4, 3.75)], [0.04, 0.02], 4, 'bone', caps=False)
        m.ball(1.5, sy * 0.19, 2.86, 0.04, 'black', n=4, rings=2)
    m.ball(-1.0, 0, 1.8, 0.14, 'trim', n=6, rings=3)
    m.meta.update(forward='+x')


@model('dog', 'animal', smooth=80.0, ao=1.5, seed=95)
def dog(m):
    """A friendly dog (about 1.8 m long), tail up."""
    F = (0.69, 0.35, 0.13)
    legs4(m, [(-0.45, -0.19), (-0.45, 0.19), (0.45, -0.19), (0.45, 0.19)], 0.1, 0.55, F)
    for x, y in [(-0.45, -0.19), (-0.45, 0.19), (0.45, -0.19), (0.45, 0.19)]:
        m.cbox(x + 0.04, y, 0.24, 0.2, 0, 0.1, 'paper')
    body(m, 0, 0.84, 0.35, 1.5, shade(F, 0.85), F, sq=0.9)
    m.tube([(0.5, 0, 0.95), (0.68, 0, 1.2)], [0.26, 0.22], 7, F, caps=False)
    m.ball(0.72, 0, 1.3, 0.3, F, n=8, rings=5, sz=0.95)
    m.ball(0.98, 0, 1.2, 0.17, 'paper', n=7, rings=4, sz=0.8)
    m.ball(1.13, 0, 1.25, 0.06, 'black', n=5, rings=3)
    for sy in (-1, 1):
        m.sheet([(0.62, sy * 0.24, 1.52), (0.5, sy * 0.42, 1.12), (0.74, sy * 0.3, 1.2)], 'fur_dark')
        m.ball(0.94, sy * 0.15, 1.4, 0.04, 'black', n=4, rings=2)
    m.tube([(-0.65, 0, 0.95), (-0.9, 0, 1.3), (-0.85, 0, 1.65)], [0.09, 0.07, 0.03], 5, [F, F, 'paper'], caps=False)
    m.torus(0.58, 0, 1.08, 0.25, 0.04, 8, 3, 'line', axis='x')
    m.meta.update(forward='+x')


# ================================================================== the hill tram's upper stop, and the ferry terminal
def sign_quad(m, name, x, y, z, w, h, rz=0.0):
    """A blank name board as a child node: one quad in the `sign` material with 0-1 UVs, in a slim dark frame."""
    with m.at(x, y, z, rz):
        m.box(-w / 2 - 0.1, w / 2 + 0.1, 0.03, 0.2, -h / 2 - 0.1, h / 2 + 0.1, 'iron', bottom=True)
    m.part(name, pivot=(x, y, z))
    with m.at(x, y, z, rz):
        with m.use('sign'):
            m.poly([(-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2)], 'pearl_hi')
    m.part('')
    n = (math.sin(rz), 0.0, math.cos(rz))
    return {'name': f'{m.name}_{name}', 'size': [w, h], 'facing': [round(n[0], 2), 0, round(n[2], 2)]}


@model('tram_stop', 'station', seed=96, smooth=62.0)
def tram_stop(m):
    """The hill pod's upper dock at the tower plaza: one low platform under a disc canopy. There is no track: the pod
    floats in along x through the origin and stops beside the platform, which is on the front (+z in glTF)."""
    m.rbox(0, -2.5, 14.0, 2.2, -1.5, 0.9, 'pearl_shade', r=0.6, seg=3, top='pave_light')
    for i in range(5):                         # steps up from the plaza along the front: 0.18 m risers
        m.box(-6.2, 6.2, -4.9 + 0.0, -3.6 + 0.0 - (4 - i) * 0.26 + 1.04, -1.5 if i == 0 else 0.0, 0.18 * (i + 1), 'pave_light') if False else None
    for i in range(5):
        y_hi = -3.6
        y_lo = -4.9 + i * 0.26
        m.box(-6.2, 6.2, y_lo, y_hi, 0.0, 0.18 * (i + 1) - 0.0, 'pave_light', top='kerb')
    rail_line(m, [(-6.6, -4.9), (-6.6, -1.6)], 0.0, h=1.0, glass=False)
    rail_line(m, [(6.6, -4.9), (6.6, -1.6)], 0.0, h=1.0, glass=False)
    with m.use('glow'):                     # a line of light along the docking edge, on top and down the face
        m.poly([(-6.3, -1.56, 0.92), (6.3, -1.56, 0.92), (6.3, -1.4, 0.92), (-6.3, -1.4, 0.92)], 'hover')
        m.poly([(-6.3, -1.335, 0.58), (6.3, -1.335, 0.58), (6.3, -1.335, 0.78), (-6.3, -1.335, 0.78)][::-1], 'hover')
    for px in (-3.5, 3.5):
        m.cyl(px, -3.0, 0.9, 4.2, 0.14, 6, 'pearl', cap=False)
    m.lathe(0, -3.2, [(6.2, 4.2), (7.0, 4.45), (6.4, 4.75), (0.0, 5.0)], 28, ['pearl_shade', 'pearl', 'pearl_hi', 'pearl_hi'], cap=False, bottom=True, sy=0.42)
    with m.use('glow'):
        m.lathe(0, -3.2, [(7.02, 4.38), (7.02, 4.52)], 28, 'line', cap=False, sy=0.42)
    m.bench(0, -3.0, math.pi, 2.4, z=0.9, col='pearl_shade')
    for hx in (-1.5, 1.5):                     # the sign hangs from the canopy on two rods
        m.cyl(hx, -4.5, 3.75, 4.3, 0.03, 4, 'pale_metal', cap=False)
    signs = [sign_quad(m, 'sign_1', 0, -4.55, 2.9, 3.6, 0.9, 0.0)]
    m.steps(-8.2, -4.3, 2.4, 3, rise=0.3, run=0.5, z=0.0) if False else None
    m.meta.update(track={'axis': 'x', 'centre': [0, 0], 'railTop': 0.0}, platform={'top': 0.9, 'length': 14.0, 'edge': 1.4, 'side': '+z'}, signs=signs, door=[0, 5.2])


@model('ferry_terminal', 'station', seed=97, smooth=62.0, ground=None)
def ferry_terminal(m):
    """A small sleek ferry terminal: a glazed pavilion under a wide disc canopy, and a jetty running out to sea.
    The land is at the front (+z in glTF); the jetty runs out behind (-z). The quay top is at the origin height."""
    m.rbox(0, 0, 18.0, 12.0, -8.0, 0.4, 'pearl_shade', r=2.0, seg=3, top='pave_light')
    m.lathe(0, 0, [(5.4, 0.4), (5.4, 1.1)], 28, 'pearl', cap=False)
    with m.use('glass'):
        m.lathe(0, 0, [(5.35, 1.1), (5.35, 4.0)], 28, ['glass_b', 'glass_c'], cap=False)
    m.lathe(0, 0, [(7.6, 4.0), (8.6, 4.3), (7.9, 4.7), (0.0, 5.3)], 28, ['pearl_shade', 'pearl', 'pearl_hi', 'pearl_hi'], cap=False, bottom=True)
    with m.use('glow'):
        m.lathe(0, 0, [(8.62, 4.22), (8.62, 4.38)], 28, 'line', cap=False)
    with m.at(0, -5.3, 0.4):
        m.rbox(0, 0.3, 4.2, 1.6, 0, 3.6, 'pearl', r=0.5, seg=3, bev=0.25)
        m.door(0, 2.6, 2.9, col='pearl_hi', glass=0.9, double=True, y=-0.5, fw=0.1, dep=0.05, pane='glass_b', knob=None)
    signs = [sign_quad(m, 'sign_1', 0, -6.2, 4.95, 4.6, 0.9, 0.0)]
    m.box(-2.6, 2.6, 5.5, 30.0, -0.4, 0.4, 'pearl', top='pave_light', bottom=True)
    for k in range(4):
        for sx in (-1, 1):
            m.cyl(sx * 2.0, 8.0 + k * 7.0, -8.5, -0.4, 0.4, 6, 'pearl_shade', cap=False)
    with m.use('glow'):
        for sx in (-1, 1):
            m.box(sx * 2.5 - 0.08, sx * 2.5 + 0.08, 6.0, 29.6, 0.4, 0.5, 'line')
    for k in range(3):
        m.cyl(0, 10.0 + k * 8.0, 0.4, 3.4, 0.1, 5, 'pearl', cap=False)
    m.box(-1.8, 1.8, 8.5, 27.5, 3.4, 3.6, 'pearl', bottom=True)
    rail_line(m, [(-2.45, 6.0), (-2.45, 29.5)], 0.4)                                          # a railing on the land side
    for k in range(4):
        bollard(m, 2.2, 9.0 + k * 6.5, 0.4, 0.7, col='brushed')
    m.box(-2.6, 2.6, 29.8, 30.0, -0.6, 0.6, 'rubber')
    m.meta.update(signs=signs, door=[0, 7.0], jettyEnd=[0, -30.0], deck=0.4)
