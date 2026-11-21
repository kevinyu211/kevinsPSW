"""Procedural modelling helpers for the city kit. Runs inside Blender (bpy).

A Model collects polygons (points, per-corner colour, per-corner UV). Blender Z is up and the
front of a building faces -Y, which becomes +Z in glTF. Units are metres.
"""
import math
import random
import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from atlas import STYLE, ROWS, BAYS

EPS_V = 0.6 / 1024
WHITE_UV = (0.5 / BAYS, 1 - 0.5 / ROWS)


def srgb(h):
    h = h.lstrip('#')
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(f(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


PAL = {k: srgb(v) for k, v in {
    'stone': '#d8ccb6', 'stone_light': '#e9e2d3', 'limestone': '#cbbfa6', 'sand': '#dcc7a0',
    'concrete': '#bdbab2', 'concrete_dark': '#8e8c86', 'white': '#f3f0e9', 'cream': '#efe4cc',
    'brick': '#a9543c', 'brick_brown': '#8c5a45', 'brick_dark': '#5e4038', 'brick_grey': '#86827e',
    'brick_tan': '#c59a6e', 'navy': '#27304a', 'charcoal': '#34383f',
    'glass_blue': '#6ea4cb', 'glass_teal': '#5fb3ad', 'glass_deep': '#356a96', 'glass_green': '#86bba0',
    'glass_sky': '#a9cfe6', 'glass_bronze': '#b08a62', 'glass_dark': '#27445e',
    'mullion': '#2f3a44', 'roof': '#5a5d62', 'roof_light': '#a3a5a8', 'roof_tile': '#b4573d',
    'roof_grey': '#6f737a', 'roof_green': '#5f8f7a', 'metal': '#9ba4ac', 'metal_light': '#d3d8dc',
    'steel': '#3b4148', 'wood': '#a87e55', 'wood_dark': '#6b4a32', 'asphalt': '#55585d',
    'paving': '#c9c4b8', 'grass': '#86b66a', 'tree': '#5c9d4f', 'tree_dark': '#3f7c40', 'trunk': '#6c4b31',
    'dirt': '#a98f6c', 'water': '#5f9fb8', 'gold': '#d8a544', 'copper': '#5fa391',
    'red': '#d93a2b', 'yellow': '#f2b705', 'blue': '#1f5fd6', 'purple': '#8e44ad', 'green': '#1e9a55',
    'cobalt': '#0039a6', 'orange': '#f26a1b', 'pink': '#ee6fa0', 'teal': '#1aa6a0', 'black': '#17191c',
    'lit': '#ffd58a', 'screen': '#10151c', 'rubber': '#222428', 'taxi': '#f0c21b', 'sky': '#9ed0ee',
}.items()}


def C(c):
    return PAL[c] if isinstance(c, str) else c


def mixc(a, b, t):
    a, b = C(a), C(b)
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def shade(c, k):
    c = C(c)
    return tuple(min(1.0, x * k) for x in c)


def grad(a, b):
    """Colour that changes with height (0 at the bottom, 1 at the top)."""
    return lambda t: mixc(a, b, t)


def rect(w, d, cx=0.0, cy=0.0):
    return [(cx - w / 2, cy - d / 2), (cx + w / 2, cy - d / 2), (cx + w / 2, cy + d / 2), (cx - w / 2, cy + d / 2)]


def chamfer(w, d, c, cx=0.0, cy=0.0):
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
    return [(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c), (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c)]


def ngon(r, n, cx=0.0, cy=0.0, rot=0.0, sy=1.0):
    return [(cx + r * math.cos(rot + 2 * math.pi * i / n), cy + sy * r * math.sin(rot + 2 * math.pi * i / n)) for i in range(n)]


def xform(pts, scale=1.0, rot=0.0, cx=0.0, cy=0.0):
    c, s = math.cos(rot), math.sin(rot)
    return [(cx + scale * (x * c - y * s), cy + scale * (x * s + y * c)) for x, y in pts]


class Model:
    def __init__(self, name, cls='prop', ao=10.0, ground=True, project=None, seed=1):
        self.name = name
        self.cls = cls
        self.ao = ao
        self.ground = ground
        self.project = project
        self.parts = {'': []}
        self.cur = self.parts['']
        self.M = [Matrix.Identity(4)]
        self.rng = random.Random(seed)
        self.meta = {}

    # ---- structure -------------------------------------------------------
    def part(self, suffix):
        """Switch output to a child node named <name>_<suffix> ('' = the main mesh)."""
        self.cur = self.parts.setdefault(suffix, [])

    def push(self, x=0.0, y=0.0, z=0.0, rz=0.0, rx=0.0, ry=0.0, s=1.0):
        m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Scale(s, 4)
        self.M.append(self.M[-1] @ m)

    def pop(self):
        self.M.pop()

    def poly(self, pts, col, uv=None):
        n = len(pts)
        m = self.M[-1]
        P = [tuple(m @ Vector(p)) for p in pts]
        cols = [C(c) for c in col] if isinstance(col, list) else [C(col)] * n
        self.cur.append((P, cols, uv if uv else [WHITE_UV] * n))

    # ---- flat pieces -----------------------------------------------------
    def cap(self, pts, z, col, up=True):
        p = [(x, y, z) for x, y in pts]
        self.poly(p if up else p[::-1], col)

    def cap_ring(self, outer, inner, z, col):
        n = len(outer)
        for i in range(n):
            j = (i + 1) % n
            self.poly([(*outer[i], z), (*outer[j], z), (*inner[j], z), (*inner[i], z)], col)

    def wall(self, p0, p1, z0, z1, col, style='none', bay=3.6, col1=None, q0=None, q1=None, u0=0.0):
        """Vertical-ish facade quad from p0 to p1 (outward normal on the right of p0->p1).
        q0/q1 give different top points (taper, twist). col1 = colour at the top."""
        q0 = q0 or p0
        q1 = q1 or p1
        c1 = C(col1) if col1 is not None else C(col)
        pts = [(*p0, z0), (*p1, z0), (*q1, z1), (*q0, z1)]
        cols = [C(col), C(col), c1, c1]
        if style == 'none':
            self.poly(pts, cols)
            return
        r = STYLE[style]
        ln = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        nb = max(1, round(ln / bay))
        ua, ub = u0, u0 + nb / BAYS
        vb, vt = 1 - (r + 1) / ROWS + EPS_V, 1 - r / ROWS - EPS_V
        self.poly(pts, cols, [(ua, vb), (ub, vb), (ub, vt), (ua, vt)])

    def facade(self, pts, z0, floors, fh, style, col, bay=3.6, skip=(), ground=None, gh=None, band=None):
        """Per-floor strips round a footprint. col may be a function of height (0..1).
        ground = style of the first floor, band = {floor_index: style}."""
        n = len(pts)
        H = floors * fh if gh is None else gh + (floors - 1) * fh
        z = z0
        for f in range(floors):
            h = gh if (f == 0 and gh) else fh
            st = ground if (f == 0 and ground) else (band.get(f, style) if band else style)
            ca = col((z - z0) / H) if callable(col) else col
            cb = col((z + h - z0) / H) if callable(col) else col
            for i in range(n):
                if i in skip:
                    continue
                self.wall(pts[i], pts[(i + 1) % n], z, z + h, ca, st, bay, col1=cb, u0=self.rng.randrange(BAYS) / BAYS)
            z += h
        return z

    def stack(self, shape, z0, floors, fh, style, col, bay=3.6, band=None):
        """Facade whose footprint changes with height: shape(t) -> points, t in 0..1."""
        H = floors * fh
        prev = shape(0.0)
        n = len(prev)
        for f in range(floors):
            t0, t1 = f / floors, (f + 1) / floors
            nxt = shape(t1)
            ca = col(t0) if callable(col) else col
            cb = col(t1) if callable(col) else col
            st = band.get(f, style) if band else style
            for i in range(n):
                j = (i + 1) % n
                self.wall(prev[i], prev[j], z0 + f * fh, z0 + (f + 1) * fh, ca, st, bay, col1=cb, q0=nxt[i], q1=nxt[j], u0=self.rng.randrange(BAYS) / BAYS)
            prev = nxt
        return z0 + H, prev

    def prism(self, pts, z0, z1, col, top=None, bottom=False):
        n = len(pts)
        for i in range(n):
            self.wall(pts[i], pts[(i + 1) % n], z0, z1, col)
        if top is not False:
            self.cap(pts, z1, top if top is not None else col)
        if bottom:
            self.cap(pts, z0, col, up=False)

    def box(self, x0, x1, y0, y1, z0, z1, col, top=None, bottom=False):
        self.prism([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, col, top, bottom)

    def cbox(self, cx, cy, w, d, z0, z1, col, top=None, bottom=False):
        self.box(cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2, z0, z1, col, top, bottom)

    def beam(self, a, b, w, h, col):
        """Box beam between two 3D points (w across, h in the 'up-ish' direction)."""
        a, b = Vector(a), Vector(b)
        d = (b - a)
        ln = d.length
        if ln < 1e-6:
            return
        d.normalize()
        up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
        s = d.cross(up).normalized() * (w / 2)
        u = s.cross(d).normalized() * (h / 2)
        A = [a - s - u, a + s - u, a + s + u, a - s + u]
        B = [p + d * ln for p in A]
        for i in range(4):
            j = (i + 1) % 4
            self.poly([A[i], A[j], B[j], B[i]], col)
        self.poly([A[3], A[2], A[1], A[0]], col)
        self.poly(B, col)

    def parapet(self, pts, z, h, col, t=0.4, roof=None):
        """Raised rim on a rectangular (or convex) roof; returns nothing. Draws the roof inside."""
        n = len(pts)
        cx = sum(p[0] for p in pts) / n
        cy = sum(p[1] for p in pts) / n
        inner = []
        for x, y in pts:
            dx, dy = cx - x, cy - y
            k = t * 1.4 / max(1e-6, math.hypot(dx, dy))
            inner.append((x + dx * k, y + dy * k))
        for i in range(n):
            j = (i + 1) % n
            self.wall(pts[i], pts[j], z, z + h, col)
            self.wall(inner[j], inner[i], z, z + h, shade(col, 0.9))
        self.cap_ring(pts, inner, z + h, col)
        self.cap(inner, z, roof if roof is not None else 'roof')

    # ---- round pieces ----------------------------------------------------
    def cyl(self, cx, cy, z0, z1, r, n, col, r2=None, cap=True, bottom=False, col1=None, sy=1.0):
        r2 = r if r2 is None else r2
        a = ngon(r, n, cx, cy, sy=sy)
        b = ngon(r2, n, cx, cy, sy=sy) if r2 > 1e-6 else None
        c1 = col1 if col1 is not None else col
        for i in range(n):
            j = (i + 1) % n
            if b:
                self.poly([(*a[i], z0), (*a[j], z0), (*b[j], z1), (*b[i], z1)], [C(col), C(col), C(c1), C(c1)])
            else:
                self.poly([(*a[i], z0), (*a[j], z0), (cx, cy, z1)], [C(col), C(col), C(c1)])
        if cap and b:
            self.cap(b, z1, c1)
        if bottom:
            self.cap(a, z0, col, up=False)

    def dome(self, cx, cy, z0, r, n, rings, col, sz=1.0, a0=0.0, a1=math.pi / 2):
        for k in range(rings):
            p0 = a0 + (a1 - a0) * k / rings
            p1 = a0 + (a1 - a0) * (k + 1) / rings
            ra, rb = r * math.cos(p0), r * math.cos(p1)
            za, zb = z0 + sz * r * math.sin(p0), z0 + sz * r * math.sin(p1)
            self.cyl(cx, cy, za, zb, ra, n, col, r2=rb, cap=False)

    def sphere(self, cx, cy, cz, r, n, rings, col, sz=1.0):
        self.dome(cx, cy, cz, r, n, rings, col, sz, -math.pi / 2, math.pi / 2)

    def hcyl(self, a, b, r, n, col, cap=True):
        """Cylinder between two 3D points."""
        a, b = Vector(a), Vector(b)
        d = (b - a).normalized()
        up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
        s = d.cross(up).normalized()
        u = s.cross(d).normalized()
        ra = [a + (s * math.cos(2 * math.pi * i / n) + u * math.sin(2 * math.pi * i / n)) * r for i in range(n)]
        rb = [p + (b - a) for p in ra]
        for i in range(n):
            j = (i + 1) % n
            self.poly([ra[j], ra[i], rb[i], rb[j]], col)
        if cap:
            self.poly(ra, col)
            self.poly(rb[::-1], col)

    def torus(self, cx, cy, cz, R, r, n, m, col, axis='y'):
        """Ring; axis is the ring's normal ('z' flat, 'y' standing facing front, 'x')."""
        def pt(i, j):
            a, b = 2 * math.pi * i / n, 2 * math.pi * j / m
            x, y, z = (R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)
            if axis == 'y':
                x, y, z = x, z, y
            elif axis == 'x':
                x, y, z = z, x, y
            return (cx + x, cy + y, cz + z)
        flip = axis == 'y'
        for i in range(n):
            for j in range(m):
                q = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)]
                self.poly(q[::-1] if flip else q, col)

    # ---- roofs -----------------------------------------------------------
    def gable(self, x0, x1, y0, y1, z0, h, col, axis='x', over=0.6, end=None, style='tiles'):
        end = end if end is not None else col
        r = STYLE[style]
        vb, vt = 1 - (r + 1) / ROWS + EPS_V, 1 - r / ROWS - EPS_V
        def uvq(ln, sl):
            u = max(1, round(ln / 4)) / BAYS
            return [(0, vb), (u, vb), (u, vt), (0, vt)]
        if axis == 'x':
            ym = (y0 + y1) / 2
            a0, a1 = x0 - over, x1 + over
            self.poly([(a0, y0 - over, z0), (a1, y0 - over, z0), (a1, ym, z0 + h), (a0, ym, z0 + h)], col, uvq(a1 - a0, 0))
            self.poly([(a1, y1 + over, z0), (a0, y1 + over, z0), (a0, ym, z0 + h), (a1, ym, z0 + h)], col, uvq(a1 - a0, 0))
            self.poly([(x0, y1, z0), (x0, y0, z0), (x0, ym, z0 + h)], end)
            self.poly([(x1, y0, z0), (x1, y1, z0), (x1, ym, z0 + h)], end)
        else:
            xm = (x0 + x1) / 2
            b0, b1 = y0 - over, y1 + over
            self.poly([(x1 + over, b0, z0), (x1 + over, b1, z0), (xm, b1, z0 + h), (xm, b0, z0 + h)], col, uvq(b1 - b0, 0))
            self.poly([(x0 - over, b1, z0), (x0 - over, b0, z0), (xm, b0, z0 + h), (xm, b1, z0 + h)], col, uvq(b1 - b0, 0))
            self.poly([(x0, y0, z0), (x1, y0, z0), (xm, y0, z0 + h)], end)
            self.poly([(x1, y1, z0), (x0, y1, z0), (xm, y1, z0 + h)], end)

    def hip(self, x0, x1, y0, y1, z0, h, col, ridge=0.0, over=0.0):
        """Hip roof; ridge = share of the long side kept as a ridge (0 = pyramid)."""
        x0, x1, y0, y1 = x0 - over, x1 + over, y0 - over, y1 + over
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if (x1 - x0) >= (y1 - y0):
            rl = (x1 - x0) * ridge / 2
            a, b = (cx - rl, cy, z0 + h), (cx + rl, cy, z0 + h)
            self.poly([(x0, y0, z0), (x1, y0, z0), b, a] if ridge else [(x0, y0, z0), (x1, y0, z0), a], col)
            self.poly([(x1, y1, z0), (x0, y1, z0), a, b] if ridge else [(x1, y1, z0), (x0, y1, z0), a], col)
            self.poly([(x0, y1, z0), (x0, y0, z0), a], shade(col, 0.93))
            self.poly([(x1, y0, z0), (x1, y1, z0), b], shade(col, 0.93))
        else:
            rl = (y1 - y0) * ridge / 2
            a, b = (cx, cy - rl, z0 + h), (cx, cy + rl, z0 + h)
            self.poly([(x1, y0, z0), (x1, y1, z0), b, a] if ridge else [(x1, y0, z0), (x1, y1, z0), a], col)
            self.poly([(x0, y1, z0), (x0, y0, z0), a, b] if ridge else [(x0, y1, z0), (x0, y0, z0), a], col)
            self.poly([(x0, y0, z0), (x1, y0, z0), a], shade(col, 0.93))
            self.poly([(x1, y1, z0), (x0, y1, z0), b], shade(col, 0.93))

    # ---- details ---------------------------------------------------------
    def roof_kit(self, x0, x1, y0, y1, z, n=3, tank=False):
        """Rooftop plant: AC boxes, a stair bulkhead and (New York style) a water tank."""
        rng = self.rng
        w, d = x1 - x0, y1 - y0
        self.cbox(x0 + w * 0.28, y0 + d * 0.7, min(6, w * 0.3), min(5, d * 0.3), z, z + 3.2, 'concrete', 'roof_light')
        for _ in range(n):
            bw, bd = rng.uniform(1.8, 3.6), rng.uniform(1.6, 3.0)
            cx, cy = rng.uniform(x0 + 2 + bw / 2, x1 - 2 - bw / 2), rng.uniform(y0 + 2 + bd / 2, y1 - 2 - bd / 2)
            self.cbox(cx, cy, bw, bd, z, z + rng.uniform(1.2, 2.2), 'metal', 'metal_light')
        if tank:
            cx, cy = x0 + w * 0.72, y0 + d * 0.35
            for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                self.cbox(cx + dx * 1.2, cy + dy * 1.2, 0.3, 0.3, z, z + 2.6, 'steel', top=False)
            self.cyl(cx, cy, z + 2.6, z + 6.0, 1.9, 8, 'wood', bottom=True)
            self.cyl(cx, cy, z + 6.0, z + 7.3, 2.1, 8, 'wood_dark', r2=0)

    def awning(self, x0, x1, y, z, depth, col, drop=0.9):
        self.poly([(x0, y, z), (x0, y - depth, z - drop), (x1, y - depth, z - drop), (x1, y, z)], col)
        self.poly([(x0, y - depth, z - drop), (x0, y - depth, z - drop - 0.45), (x1, y - depth, z - drop - 0.45), (x1, y - depth, z - drop)], shade(col, 0.85))
        self.poly([(x0, y, z), (x0, y - depth, z - drop - 0.45), (x0, y - depth, z - drop)], shade(col, 0.8))
        self.poly([(x1, y, z), (x1, y - depth, z - drop), (x1, y - depth, z - drop - 0.45)], shade(col, 0.8))

    def tree(self, x, y, s=1.0, kind='round', z=0.0):
        self.cyl(x, y, z, z + 2.4 * s, 0.32 * s, 5, 'trunk', cap=False)
        if kind == 'round':
            self.cyl(x, y, z + 2.0 * s, z + 4.4 * s, 1.9 * s, 6, 'tree_dark', r2=2.6 * s, cap=False, col1='tree')
            self.cyl(x, y, z + 4.4 * s, z + 7.0 * s, 2.6 * s, 6, 'tree', r2=1.2 * s, col1=shade('tree', 1.15))
        else:
            self.cyl(x, y, z + 1.6 * s, z + 6.0 * s, 1.7 * s, 6, 'tree_dark', r2=1.0 * s, cap=False, col1='tree')
            self.cyl(x, y, z + 6.0 * s, z + 10.5 * s, 1.0 * s, 6, 'tree', r2=0, col1=shade('tree', 1.1))

    def screen(self, p0, p1, z0, z1, suffix='screen', frame=0.6, frame_col='steel', depth=0.5):
        """A flat screen quad (0..1 UVs) from p0 to p1, facing right of p0->p1, with a frame box behind."""
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        ln = math.hypot(dx, dy)
        nx, ny = dy / ln, -dx / ln
        tx, ty = dx / ln, dy / ln
        if frame:
            a = (p0[0] - tx * frame - nx * depth, p0[1] - ty * frame - ny * depth)
            b = (p1[0] + tx * frame - nx * depth, p1[1] + ty * frame - ny * depth)
            c = (b[0] + nx * (depth - 0.06), b[1] + ny * (depth - 0.06))
            d = (a[0] + nx * (depth - 0.06), a[1] + ny * (depth - 0.06))
            self.prism([d, c, b, a], z0 - frame, z1 + frame, frame_col, bottom=True)
        keep = self.cur
        self.part(suffix)
        self.poly([(*p0, z0), (*p1, z0), (*p1, z1), (*p0, z1)], 'screen', [(0, 0), (1, 0), (1, 1), (0, 1)])
        self.cur = keep

    def text(self, s, size, x, y, z, col, rz=0.0, depth=0.25, flat=False, align='CENTER'):
        """Extruded text. Upright and facing -Y by default; flat=True lays it on the ground plane."""
        cu = bpy.data.curves.new('t', 'FONT')
        cu.body = s
        cu.size = size
        cu.extrude = depth / 2
        cu.resolution_u = 1
        cu.align_x = align
        ob = bpy.data.objects.new('t', cu)
        bpy.context.scene.collection.objects.link(ob)
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, 'Z')
        if not flat:
            m = m @ Matrix.Rotation(math.pi / 2, 4, 'X')
        self.M.append(self.M[-1] @ m)
        for p in me.polygons:
            self.poly([tuple(me.vertices[i].co) for i in p.vertices], col)
        self.M.pop()
        bpy.data.objects.remove(ob)
        bpy.data.curves.remove(cu)
        bpy.data.meshes.remove(me)

    # ---- stats -----------------------------------------------------------
    def tris(self):
        return sum(len(p[0]) - 2 for part in self.parts.values() for p in part)

    def bounds(self):
        xs = [v for part in self.parts.values() for p in part for v in p[0]]
        mn = [min(v[i] for v in xs) for i in range(3)]
        mx = [max(v[i] for v in xs) for i in range(3)]
        return mn, mx


# ---------------------------------------------------------------- AO + mesh
def _hemi(n, seed=3):
    rng = random.Random(seed)
    out = []
    for _ in range(n):
        u, v = rng.random(), rng.random()
        r, th = math.sqrt(u), 2 * math.pi * v
        out.append((r * math.cos(th), r * math.sin(th), math.sqrt(max(0.0, 1 - u))))
    return out


HEMI = _hemi(20)


def bake_ao(model, strength=0.78):
    verts, faces = [], []
    for part in model.parts.values():
        for pts, _, _ in part:
            faces.append(list(range(len(verts), len(verts) + len(pts))))
            verts.extend(Vector(p) for p in pts)
    if model.ground:
        g = 4000
        faces.append(list(range(len(verts), len(verts) + 4)))
        verts.extend([Vector((-g, -g, -0.02)), Vector((g, -g, -0.02)), Vector((g, g, -0.02)), Vector((-g, g, -0.02))])
    bvh = BVHTree.FromPolygons(verts, faces, all_triangles=False)
    D = model.ao
    for part in model.parts.values():
        for pi, (pts, cols, uvs) in enumerate(part):
            P = [Vector(p) for p in pts]
            n = Vector((0, 0, 0))
            for i in range(len(P)):
                a, b = P[i], P[(i + 1) % len(P)]
                n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
            if n.length < 1e-9:
                continue
            n.normalize()
            t = n.cross(Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))).normalized()
            b = n.cross(t)
            c = sum(P, Vector((0, 0, 0))) / len(P)
            new = []
            for i, p in enumerate(P):
                o = p + n * 0.04 + (c - p) * 0.05
                occ = 0.0
                for hx, hy, hz in HEMI:
                    d = t * hx + b * hy + n * hz
                    hit = bvh.ray_cast(o, d, D)
                    if hit[0] is not None:
                        occ += 1.0 - (hit[3] / D) ** 0.7
                k = 1.0 - strength * (occ / len(HEMI))
                new.append(tuple(x * k for x in cols[i]))
            part[pi] = (pts, new, uvs)


def to_object(name, polys, mat, smooth_angle=40, colors=True):
    verts, faces = [], []
    for pts, _, _ in polys:
        faces.append(list(range(len(verts), len(verts) + len(pts))))
        verts.extend(pts)
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER') if colors else None
    uv = me.uv_layers.new(name='UVMap')
    cols, uvs = [], []
    for _, c, u in polys:
        for i in range(len(c)):
            cols.extend((c[i][0], c[i][1], c[i][2], 1.0))
            uvs.extend(u[i])
    if ca:
        ca.data.foreach_set('color', cols)
    uv.data.foreach_set('uv', uvs)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    me.set_sharp_from_angle(angle=math.radians(smooth_angle))
    if ca:
        me.color_attributes.active_color = me.color_attributes['Col']
        me.color_attributes.render_color_index = 0
    me.materials.append(mat)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def make_materials(atlas_image):
    mat = bpy.data.materials.new('city')
    mat.use_backface_culling = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = atlas_image
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    mx = nt.nodes.new('ShaderNodeMix')
    mx.data_type = 'RGBA'
    mx.blend_type = 'MULTIPLY'
    mx.inputs[0].default_value = 1.0
    nt.links.new(vc.outputs['Color'], mx.inputs[6])
    nt.links.new(tex.outputs['Color'], mx.inputs[7])
    nt.links.new(mx.outputs[2], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.78
    bsdf.inputs['Metallic'].default_value = 0.0
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    scr = bpy.data.materials.new('screen')
    scr.use_backface_culling = True
    nt = scr.node_tree
    b2 = nt.nodes.get('Principled BSDF')
    if b2 is None:
        nt.nodes.clear()
        o2 = nt.nodes.new('ShaderNodeOutputMaterial')
        b2 = nt.nodes.new('ShaderNodeBsdfPrincipled')
        nt.links.new(b2.outputs['BSDF'], o2.inputs['Surface'])
    b2.inputs['Base Color'].default_value = (*PAL['screen'], 1.0)
    b2.inputs['Roughness'].default_value = 0.35
    return mat, scr


def realize(model, mat, scr):
    """Bake AO and create the Blender objects (main mesh + child nodes). Returns manifest row."""
    bake_ao(model)
    root = to_object(model.name, model.parts[''], mat)
    kids = []
    for suf, polys in model.parts.items():
        if not suf or not polys:
            continue
        isscr = suf.startswith('screen')
        ob = to_object(f'{model.name}_{suf}', polys, scr if isscr else mat, colors=not isscr)
        ob.parent = root
        kids.append(ob.name)
    mn, mx = model.bounds()
    row = {'name': model.name, 'class': model.cls,
           'w': round(mx[0] - mn[0], 1), 'd': round(mx[1] - mn[1], 1), 'h': round(mx[2], 1), 'tris': model.tris()}
    row.update(model.meta)
    return root, kids, row


# ---------------------------------------------------------------- extra shapes
def _frustum(self, p0, p1, z0, z1, col, top=None, col1=None, style='none', bay=3.6):
    """Walls from footprint p0 (at z0) to footprint p1 (at z1), same point count."""
    n = len(p0)
    for i in range(n):
        j = (i + 1) % n
        self.wall(p0[i], p0[j], z0, z1, col, style, bay, col1=col1, q0=p1[i], q1=p1[j])
    if top is not False:
        self.cap(p1, z1, top if top is not None else (col1 if col1 is not None else col))


def _wedge(self, x0, x1, y0, y1, z0, ha, hb, col, top=None, axis='x'):
    """Box with a sloped top: height ha on the low-coordinate side, hb on the other."""
    if axis == 'x':
        h = {(x0, y0): ha, (x0, y1): ha, (x1, y0): hb, (x1, y1): hb}
    else:
        h = {(x0, y0): ha, (x1, y0): ha, (x0, y1): hb, (x1, y1): hb}
    pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    for i in range(4):
        a, b = pts[i], pts[(i + 1) % 4]
        self.poly([(*a, z0), (*b, z0), (*b, z0 + h[b]), (*a, z0 + h[a])], col)
    self.poly([(*p, z0 + h[p]) for p in pts], top if top is not None else col)


Model.frustum = _frustum
Model.wedge = _wedge
