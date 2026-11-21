"""Modelling helpers for the island city models. Runs inside Blender (bpy).

Builds on ../lib.py (the old city kit) and adds what the island needs:
  - three materials per model (city, glass, glow), chosen per polygon
  - child nodes with their own pivot (crane jibs, doors, wings)
  - soft shapes (rounded boxes, lathes, tubes, blobs) with weighted normals
  - street-level detail (windows, doors, awnings, lamps, planters, signs, text)
No facade atlas: every colour is a vertex colour, so the site can repaint a model in one line.

Blender Z is up and the front of a model faces -Y (which is +Z in glTF). Metres.
"""
import os
import sys
import math
import random
from contextlib import contextmanager

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
import lib
from lib import srgb, mixc, shade, rect, chamfer, ngon, xform, PAL, C

MATS = ('city', 'glass', 'glow', 'sign', 'pearl', 'metal', 'stone', 'rubber', 'glass_dark', 'glass_tint')
# What each material is (name: roughness, metallic, alpha). Every one still reads its colour from the vertex colours.
MAT_DEF = {'city': (0.82, 0.0, 1.0), 'pearl': (0.26, 0.0, 1.0), 'metal': (0.36, 0.9, 1.0), 'stone': (0.94, 0.0, 1.0), 'rubber': (0.7, 0.0, 1.0),
           'glass': (0.05, 0.0, 0.34), 'glass_dark': (0.1, 0.4, 1.0), 'glass_tint': (0.06, 0.3, 0.82), 'glow': (0.35, 0.0, 1.0), 'sign': (0.6, 0.0, 1.0)}

# ---- palette for the film look: warm neutrals, the five district colours, soft greens
PAL.update({k: srgb(v) for k, v in {
    # walls
    'w_white': '#f6f1e6', 'w_cream': '#f2e6cd', 'w_sand': '#e7d4b1', 'w_stone': '#dccfb8', 'w_peach': '#f1d8bd',
    'w_grey': '#cfc8bb', 'w_taupe': '#b8a793', 'w_brick': '#cf9070', 'w_brick_dark': '#a8664d', 'w_blush': '#ecc9b8',
    'w_noir': '#5b4a4c', 'w_noir_dark': '#3f3438', 'w_mint': '#dfe9dc', 'w_butter': '#f5e3ac',
    'trim': '#fbf8f1', 'trim_dark': '#8b7f73', 'plinth': '#b7ab9b',
    # the districts (exactly the colours in designs/city/city-data.js)
    'd_software': '#D5281E', 'd_books': '#E0A800', 'd_film': '#1F4FD8', 'd_games': '#E8731A', 'd_health': '#00843D',
    'line': '#D5281E',
    # glass, light
    'pane': '#4e6779', 'pane_light': '#7d9bb0', 'pane_dark': '#34485a', 'glass_a': '#7fb6d1', 'glass_b': '#4f8fb3',
    'glass_c': '#a9d4e6', 'lamp': '#fff0c4', 'lamp_warm': '#ffd98a', 'neon_pink': '#ff6fa8', 'neon_gold': '#ffc94d',
    # ground
    'pave': '#dccfb9', 'pave_dark': '#c2b49d', 'pave_light': '#eae1d0', 'kerb': '#efe8da', 'road': '#5b5d62',
    'soil': '#a98c66', 'sand_g': '#e6cf9f', 'grass_g': '#86b85e', 'grass_dark': '#5f9a4a', 'water_g': '#5fb0c9',
    'deck_wood': '#b98e62', 'court_red': '#c9573f', 'court_blue': '#3f79b5', 'court_green': '#4f9a6b',
    # plants
    'leaf': '#5fa348', 'leaf_dark': '#3d7f3c', 'leaf_light': '#93c95f', 'leaf_pine': '#2f6f4a', 'bark': '#7a5536',
    'bark_pale': '#b39a7c', 'flower_pink': '#f08fb0', 'flower_yel': '#ffd23f', 'flower_red': '#e8503f', 'flower_white': '#fff6e8',
    'blossom': '#f5b6c8',
    # materials
    'timber': '#b98758', 'timber_dark': '#7c5334', 'iron': '#3d4249', 'steel_light': '#aeb6bd', 'zinc': '#8f9aa3',
    'pearl': '#f4f1e8', 'pearl_hi': '#fbf9f3', 'pearl_shade': '#dfdacd', 'seam': '#bdb8aa', 'brushed': '#b4bcc0',
    'hover': '#4fd0e6', 'hover_soft': '#b5ecf5',
    'ivory': '#f4ecdb', 'ivory_shade': '#dccfb6', 'glass_warm': '#c2a274', 'glass_warm_hi': '#ead8ae', 'pale_metal': '#cdd2d2',
    'terracotta': '#c66a45', 'roof_sage': '#6fa39a', 'slate': '#56606b', 'canvas': '#f4ecd9', 'paper': '#fbf7ec', 'gold_g': '#e0ad3c',
    'brass': '#c99a3a', 'rope': '#c9b28a', 'crane_yel': '#f2b21d', 'hazard': '#f2c21b', 'bone': '#ede3cc',
    'fur': '#8a5a3a', 'fur_dark': '#5f3d28', 'wool': '#f4efe3', 'skin_grey': '#7f8a93',
    # toy colours
    't_red': '#e5483b', 't_yel': '#ffcb2e', 't_blue': '#3f86e0', 't_green': '#3faf6a', 't_pink': '#f283b0',
    't_purple': '#8f63d2', 't_teal': '#2fb5ad', 't_orange': '#f58a2c', 't_cyan': '#27b3e6', 't_magenta': '#e23d97',
}.items()})

# ---- which material a named colour belongs to (anything not listed stays `city`: matte, vertex colours)
MAT_OF = {}
for _m, _names in {'pearl': 'pearl pearl_hi pearl_shade trim ivory ivory_shade w_white paper',
                   'metal': 'steel_light brushed pale_metal zinc iron metal metal_light steel brass gold_g trim_dark slate',
                   'stone': 'pave pave_dark pave_light kerb plinth w_stone w_grey road',
                   'rubber': 'rubber black screen charcoal seam'}.items():
    for _n in _names.split():
        MAT_OF[_n] = _m


class Col(tuple):
    """A colour that remembers which material its name belongs to, through shade(), tint() and mixc()."""
    mat = None


def _col(t, mat=None):
    c = Col(t)
    c.mat = mat
    return c


def C(c):
    if isinstance(c, Col):
        return c
    if isinstance(c, str):
        return _col(PAL[c], MAT_OF.get(c))
    return _col(tuple(c))


def mixc(a, b, t):
    a, b = C(a), C(b)
    return _col(tuple(a[i] + (b[i] - a[i]) * t for i in range(3)), a.mat if t < 0.5 else b.mat)


def shade(c, k):
    c = C(c)
    return _col(tuple(min(1.0, x * k) for x in c[:3]), c.mat)


lib.C, lib.mixc, lib.shade = C, mixc, shade          # the old kit's own shapes (boxes, cylinders ...) keep the material too

DIST = {'software': 'd_software', 'books': 'd_books', 'film': 'd_film', 'games': 'd_games', 'health': 'd_health'}


def xsec(x, half, sy=1.0, sz=1.0, z0=0.0, y0=0.0):
    """A symmetric cross-section ring at x from half a profile [(y, z), ...] listed from the bottom centre
    round the +y side to the top centre. Use with IModel.loft."""
    right = [(x, y0 + y * sy, z0 + z * sz) for y, z in half]
    left = [(x, y0 - y * sy, z0 + z * sz) for y, z in reversed(half) if abs(y) > 1e-9]
    return right + left


def tint(c, t):
    """Towards white."""
    return _tint(C(c), t)


def _tint(c, t):
    out = Col(tuple(c[i] + (1 - c[i]) * t for i in range(3)))
    out.mat = getattr(c, 'mat', None)
    return out


def rrect(w, d, r=1.0, seg=2, cx=0.0, cy=0.0):
    """Rounded rectangle, counter-clockwise."""
    r = min(r, w / 2 - 1e-3, d / 2 - 1e-3)
    if r <= 1e-3 or seg < 1:
        return rect(w, d, cx, cy)
    pts = []
    for sx, sy, a0 in ((1, -1, -90), (1, 1, 0), (-1, 1, 90), (-1, -1, 180)):
        ox, oy = cx + sx * (w / 2 - r), cy + sy * (d / 2 - r)
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


# ---- 2D outlines in the (x, z) plane, counter-clockwise as seen from the front
def disc2(cx, cz, r, n=12, rot=0.0, sz=1.0):
    return [(cx + r * math.cos(rot + 2 * math.pi * i / n), cz + sz * r * math.sin(rot + 2 * math.pi * i / n)) for i in range(n)]


def star2(cx, cz, r, k=5, inner=0.45, rot=math.pi / 2):
    return [(cx + (r if i % 2 == 0 else r * inner) * math.cos(rot + math.pi * i / k),
             cz + (r if i % 2 == 0 else r * inner) * math.sin(rot + math.pi * i / k)) for i in range(2 * k)]


def rrect2(cx, cz, w, h, r=0.3, seg=2):
    return rrect(w, h, r, seg, cx, cz)


def cross2(cx, cz, s, t):
    """Plus sign: arm length s (tip to tip), arm thickness t."""
    a, b = s / 2, t / 2
    return [(cx - b, cz - a), (cx + b, cz - a), (cx + b, cz - b), (cx + a, cz - b), (cx + a, cz + b), (cx + b, cz + b),
            (cx + b, cz + a), (cx - b, cz + a), (cx - b, cz + b), (cx - a, cz + b), (cx - a, cz - b), (cx - b, cz - b)]


def capsule2(cx, cz, w, h, n=5):
    r = h / 2
    pts = []
    for k in range(n + 1):
        a = -math.pi / 2 + math.pi * k / n
        pts.append((cx + w / 2 - r + r * math.cos(a), cz + r * math.sin(a)))
    for k in range(n + 1):
        a = math.pi / 2 + math.pi * k / n
        pts.append((cx - w / 2 + r + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def heart2(cx, cz, r, n=14):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx - x * r / 17, cz + y * r / 17))
    return pts


def grow2(pts, k, c=None):
    """Scale an outline about its centre (for sticker borders)."""
    cx = sum(p[0] for p in pts) / len(pts) if c is None else c[0]
    cz = sum(p[1] for p in pts) / len(pts) if c is None else c[1]
    return [(cx + (x - cx) * k, cz + (z - cz) * k) for x, z in pts]


_TEXT = {}


SOLID_MIN = 0.6
TEXT_DISSOLVE = 12.0
ROUND_FONT = '/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf'
_FONT = []


def _font():
    if not _FONT:
        f = None
        if os.path.exists(ROUND_FONT):
            try:
                f = bpy.data.fonts.load(ROUND_FONT, check_existing=True)
            except Exception:
                f = None
        _FONT.append(f)
    return _FONT[0]


def text_polys(s, bold=0.0, solid=False):
    """Outline polygons of a string at size 1 in a rounded typeface: ([[(x, y), ...], ...], x0, x1, y0, y1). Cached.
    solid=True: moulded letters instead, extruded 0.12 deep with a rounded bevel on every edge, as 3D faces
    [(x, y, z), ...] with the front at z = +depth."""
    key = (s, bold, solid)
    if key in _TEXT:
        return _TEXT[key]
    cu = bpy.data.curves.new('t', 'FONT')
    cu.body = s
    f = _font()
    if f is not None:
        cu.font = f
    cu.size = 1.0
    cu.offset = bold * 0.5
    cu.resolution_u = 1 if solid else 2
    cu.align_x = 'LEFT'
    if solid:
        cu.extrude = 0.04
        cu.bevel_depth = 0.025
        cu.bevel_resolution = 0
    else:
        cu.extrude = 0.0
    ob = bpy.data.objects.new('t', cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    if solid:                                  # thin the outline: rounded letters keep their look with half the points
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(TEXT_DISSOLVE), verts=bm.verts, edges=bm.edges, delimit={'NORMAL'})
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4 and abs(f.normal.z) < 0.5])
        bm.to_mesh(me)
        bm.free()
    polys = []
    zmin = min((v.co.z for v in me.vertices), default=0.0)
    for p in me.polygons:
        if solid:
            pts = [(me.vertices[i].co.x, me.vertices[i].co.y, me.vertices[i].co.z - zmin) for i in p.vertices]
            if p.normal.z < -0.05:
                continue                      # the back of the letters sits on the board: not needed
        else:
            pts = [tuple(me.vertices[i].co)[:2] for i in p.vertices]
            if p.normal.z < 0:
                pts = pts[::-1]
        polys.append(pts)
    xs = [v.co.x for v in me.vertices] or [0, 0]
    ys = [v.co.y for v in me.vertices] or [0, 0]
    out = (polys, min(xs), max(xs), min(ys), max(ys))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    bpy.data.meshes.remove(me)
    _TEXT[key] = out
    return out


class IModel(lib.Model):
    def __init__(self, name, cls='prop', ao=9.0, seed=1, smooth=50.0, ground=-0.02):
        super().__init__(name, cls, ao, ground is not None, None, seed)
        self.ground_z = ground
        self.mat = 'city'
        self.glass_mat = 'glass_dark'       # what use('glass') means here: glass_dark (opaque glazing) or glass (see-through)
        self.smooth = smooth
        self.pivots = {}
        self.meta = {}

    # ---- structure
    def poly(self, pts, col, uv=None):
        n = len(pts)
        m = self.M[-1]
        P = [tuple(m @ Vector(p)) for p in pts]
        cols = [C(c) for c in col] if isinstance(col, list) else [C(col)] * n
        mat = self.mat
        if mat == 'city':                   # a named colour picks its own material (pearl, metal, stone, rubber)
            mat = next((c.mat for c in cols if c.mat), 'city')
        elif mat == 'glass':
            mat = self.glass_mat
        if mat == 'glass_tint':             # smoked blue-grey: the colour is darkened here, the material adds the reflection
            cols = [_col((c[0] * 0.22 + 0.030, c[1] * 0.22 + 0.042, c[2] * 0.22 + 0.058)) for c in cols]
        self.cur.append((P, cols, mat))

    def part(self, suffix, pivot=None):
        """Send what follows to the child node <name>_<suffix> ('' = the main mesh).
        pivot = the child's own origin (the point it turns or slides about), in model space."""
        self.cur = self.parts.setdefault(suffix, [])
        if suffix and pivot is not None:
            self.pivots[suffix] = tuple(self.M[-1] @ Vector(pivot))

    @contextmanager
    def use(self, mat):
        old, self.mat = self.mat, mat
        yield
        self.mat = old

    @contextmanager
    def at(self, x=0.0, y=0.0, z=0.0, rz=0.0, rx=0.0, ry=0.0, s=1.0):
        self.push(x, y, z, rz, rx, ry, s)
        yield
        self.pop()

    @contextmanager
    def side(self, name, x0, x1, y0, y1, z=0.0):
        """Local frame on one wall of a box: x runs along the wall (0 = its middle), -y points out.
        Yields the wall length."""
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if name == 'front':
            self.push(cx, y0, z, 0.0); L = x1 - x0
        elif name == 'back':
            self.push(cx, y1, z, math.pi); L = x1 - x0
        elif name == 'right':
            self.push(x1, cy, z, math.pi / 2); L = y1 - y0
        else:
            self.push(x0, cy, z, -math.pi / 2); L = y1 - y0
        yield L
        self.pop()

    # ---- soft solids
    def rbox(self, cx, cy, w, d, z0, z1, col, r=0.6, seg=2, top=None, bev=0.0, bottom=False, col1=None):
        """Box with rounded vertical corners and an optional soft top edge."""
        pts = rrect(w, d, r, seg, cx, cy)
        topc = top if top is not None else (col1 if col1 is not None else col)
        if bev > 0:
            inner = rrect(w - 2 * bev, d - 2 * bev, max(r - bev, 0.02), seg, cx, cy) if len(pts) > 4 else rect(w - 2 * bev, d - 2 * bev, cx, cy)
            self.frustum(pts, pts, z0, z1 - bev, col, top=False, col1=col1)
            self.frustum(pts, inner, z1 - bev, z1, col1 if col1 is not None else col, top=topc)
        else:
            self.frustum(pts, pts, z0, z1, col, top=topc, col1=col1)
        if bottom:
            self.cap(pts, z0, col, up=False)
        return pts

    def lathe(self, cx, cy, prof, n, col, cap=True, bottom=False, rot=0.0, sy=1.0):
        """Solid of revolution about the vertical axis. prof = [(radius, z), ...] going up the outside.
        col = one colour, or one per profile point."""
        cols = [C(c) for c in col] if isinstance(col, list) else [C(col)] * len(prof)
        rings = [ngon(max(r, 0.0), n, cx, cy, rot, sy) for r, _ in prof]
        for k in range(len(prof) - 1):
            (ra, za), (rb, zb) = prof[k], prof[k + 1]
            A, B = rings[k], rings[k + 1]
            ca, cb = cols[k], cols[k + 1]
            for i in range(n):
                j = (i + 1) % n
                if ra < 1e-6 and rb < 1e-6:
                    continue
                if ra < 1e-6:
                    self.poly([(cx, cy, za), (*B[j], zb), (*B[i], zb)], [ca, cb, cb])
                elif rb < 1e-6:
                    self.poly([(*A[i], za), (*A[j], za), (cx, cy, zb)], [ca, ca, cb])
                else:
                    self.poly([(*A[i], za), (*A[j], za), (*B[j], zb), (*B[i], zb)], [ca, ca, cb, cb])
        if cap and prof[-1][0] > 1e-6:
            self.cap(rings[-1], prof[-1][1], cols[-1])
        if bottom and prof[0][0] > 1e-6:
            self.cap(rings[0], prof[0][1], cols[0], up=False)

    def ball(self, cx, cy, cz, r, col, n=7, rings=4, sz=1.0, col1=None, sy=1.0, rot=0.0):
        """Low-poly sphere; col at the bottom fading to col1 at the top."""
        c0, c1 = C(col), C(col1 if col1 is not None else col)
        prof, cols = [], []
        for k in range(rings + 1):
            a = -math.pi / 2 + math.pi * k / rings
            prof.append((r * math.cos(a) if 0 < k < rings else 0.0, cz + sz * r * math.sin(a)))
            cols.append(mixc(c0, c1, k / rings))
        self.lathe(cx, cy, prof, n, cols, cap=False, rot=rot, sy=sy)

    def blob(self, cx, cy, cz, r, col='leaf', n=7, rings=3, sz=0.85, col0=None):
        """Tree-canopy blob: darker underneath, lighter on top."""
        self.ball(cx, cy, cz, r, col0 if col0 is not None else shade(col, 0.72), n, rings, sz, col1=tint(col, 0.12), rot=self.rng.random())

    def tube(self, pts, r, n, col, caps=True):
        """Tube along a 3D polyline. r = one radius or one per point. col = one colour or one per point."""
        P = [Vector(p) for p in pts]
        m = len(P)
        R = list(r) if isinstance(r, (list, tuple)) else [r] * m
        cols = [C(c) for c in col] if isinstance(col, list) else [C(col)] * m
        tans = []
        for i in range(m):
            a, b = P[max(i - 1, 0)], P[min(i + 1, m - 1)]
            tans.append((b - a).normalized())
        t = tans[0]
        up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        s = t.cross(up).normalized()
        rings = []
        for i in range(m):
            if i:
                q = tans[i - 1].rotation_difference(tans[i])
                s = (q @ s).normalized()
            u = s.cross(tans[i]).normalized()
            rings.append([P[i] + (s * math.cos(2 * math.pi * k / n) + u * math.sin(2 * math.pi * k / n)) * R[i] for k in range(n)])
        for i in range(m - 1):
            ra, rb = rings[i], rings[i + 1]
            for k in range(n):
                j = (k + 1) % n
                self.poly([ra[j], ra[k], rb[k], rb[j]], [cols[i], cols[i], cols[i + 1], cols[i + 1]])
        if caps:
            if R[0] > 1e-4:
                self.poly(rings[0], cols[0])
            if R[-1] > 1e-4:
                self.poly(rings[-1][::-1], cols[-1])

    def loft(self, rings, col, caps=(True, True)):
        """Skin between cross-sections. rings = lists of 3D points, same count each, running towards +x,
        each ring counter-clockwise as seen from +x. col = one colour, one per ring, or one per ring point."""
        m = len(rings)
        n = len(rings[0])

        def cc(k, i):
            if isinstance(col, list):
                c = col[k]
                if isinstance(c, list):
                    return C(c[i])
                return C(c)
            return C(col)
        for k in range(m - 1):
            A, B = rings[k], rings[k + 1]
            for i in range(n):
                j = (i + 1) % n
                q = [A[i], A[j], B[j], B[i]]
                c = [cc(k, i), cc(k, j), cc(k + 1, j), cc(k + 1, i)]
                # drop collapsed edges (pointed ends)
                keep = [0]
                for t in (1, 2, 3):
                    if (Vector(q[t]) - Vector(q[keep[-1]])).length > 1e-5 and (Vector(q[t]) - Vector(q[0])).length > 1e-5:
                        keep.append(t)
                if len(keep) >= 3:
                    self.poly([q[t] for t in keep], [c[t] for t in keep])
        if caps[0]:
            self.poly(list(reversed(rings[0])), [cc(0, i) for i in reversed(range(n))])
        if caps[1]:
            self.poly(list(rings[-1]), [cc(m - 1, i) for i in range(n)])

    def obox(self, cx, cy, w, d, z0, z1, col, rz=0.0, top=None, bottom=False):
        """Box turned about the vertical axis."""
        with self.at(cx, cy, 0, rz):
            self.cbox(0, 0, w, d, z0, z1, col, top, bottom)

    # ---- flat pieces that face the front of the current frame
    def fq(self, x0, x1, z0, z1, y, col):
        """Quad facing -y."""
        self.poly([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], col)

    def sheet(self, pts, col, back=None):
        """A thin two-sided surface (flag, canopy cloth, glass rail). The back sits 2 cm behind the front."""
        P = [Vector(p) for p in pts]
        n = Vector((0, 0, 0))
        for i in range(len(P)):
            a, b2 = P[i], P[(i + 1) % len(P)]
            n += Vector(((a.y - b2.y) * (a.z + b2.z), (a.z - b2.z) * (a.x + b2.x), (a.x - b2.x) * (a.y + b2.y)))
        n = n.normalized() * 0.02 if n.length > 1e-9 else Vector((0, 0, 0))
        self.poly(pts, col)
        bc = back if back is not None else col
        if isinstance(bc, list):
            bc = bc[::-1]
        self.poly([tuple(p - n) for p in reversed(P)], bc)

    def plate(self, pts, y, t, col, edge=None, back=False):
        """Flat shape from (x, z) points (counter-clockwise seen from the front), t thick, standing off the plane y."""
        yf = y - t
        self.poly([(x, yf, z) for x, z in pts], col)
        if t > 0.02:
            ec = edge if edge is not None else shade(col, 0.8)
            n = len(pts)
            for i in range(n):
                a, b = pts[i], pts[(i + 1) % n]
                self.poly([(a[0], y, a[1]), (b[0], y, b[1]), (b[0], yf, b[1]), (a[0], yf, a[1])], ec)
        if back:
            self.poly([(x, y, z) for x, z in reversed(pts)], col)

    def sticker(self, pts, y, col, border=0.35, t=0.25):
        """A die-cut sticker: white border plate with the coloured shape on it."""
        cx = sum(p[0] for p in pts) / len(pts)
        cz = sum(p[1] for p in pts) / len(pts)
        r = max(math.hypot(p[0] - cx, p[1] - cz) for p in pts)
        self.plate(grow2(pts, 1 + border / r), y, t, 'trim')
        self.poly([(x, y - t - 0.05, z) for x, z in pts], col)

    def text(self, s, size, cx, z, col, y=0.0, mat=None, align='C', flat=False, bold=0.0, rz=0.0, max_w=None, solid=True):
        """Lettering in a rounded typeface. Upright on the plane y facing -y (z = baseline): moulded letters with soft,
        bevelled edges standing on the plane (solid=True), or flat on the ground (flat=True: cx, y = centre, z = height).
        Returns the width."""
        solid = solid and not flat and size >= SOLID_MIN      # small print stays flat: nobody reads its edges
        polys, x0, x1, y0, y1 = text_polys(s, bold, solid)
        w = (x1 - x0) * size
        if max_w and w > max_w:
            size *= max_w / w
            w = max_w
        ox = {'C': cx - (x0 + x1) / 2 * size, 'L': cx - x0 * size, 'R': cx - x1 * size}[align]
        old = self.mat
        if mat:
            self.mat = mat
        if flat:
            with self.at(cx, y, z, rz):
                for p in polys:
                    self.poly([((px - (x0 + x1) / 2) * size, (py - (y0 + y1) / 2) * size, 0.0) for px, py in p], col)
        elif solid:
            dz = min(1.5, 0.63 / max(size, 0.1))      # letters about 8 cm proud whatever their size
            for p in polys:
                self.poly([(ox + px * size, y + 0.02 - pz * size * dz, z + py * size) for px, py, pz in p], col)
        else:
            for p in polys:
                self.poly([(ox + px * size, y, z + py * size) for px, py in p], col)
        self.mat = old
        return w

    def sign(self, s, cx, z, size, col='trim', board='iron', y=0.0, pad=0.35, t=0.3, mat='glow', bold=0.012, r=0.3, max_w=None):
        """A sign board with flat lettering, standing off the plane y. z = bottom of the board. Returns (w, h)."""
        polys, x0, x1, y0, y1 = text_polys(s, bold)
        w = (x1 - x0) * size
        if max_w and w + 2 * pad > max_w:
            size *= (max_w - 2 * pad) / w
            w = max_w - 2 * pad
        h = size * 0.74
        bw, bh = w + 2 * pad, h + 2 * pad
        if board is not None:
            self.plate(rrect2(cx, z + bh / 2, bw, bh, r), y, t, board)
        self.text(s, size, cx, z + pad, col, y - t - 0.04, mat=mat, bold=bold)
        return bw, bh

    # ---- openings
    def win(self, cx, z0, w, h, frame='trim', fw=0.22, dep=0.18, pane='pane', mat='glow', bars=(0, 0), sill=0.0, y=0.0,
            arch=False, shutters=None):
        """Window on the plane y of the current frame. bars = (vertical, horizontal) glazing bars."""
        x0, x1, z1 = cx - w / 2, cx + w / 2, z0 + h
        self.box(x0 - fw, x1 + fw, y - dep, y, z0 - fw, z1 + fw, frame, bottom=True)
        yy = y - dep - 0.03
        pc = C(pane)
        with self.use(mat):
            self.poly([(x0, yy, z0), (x1, yy, z0), (x1, yy, z1), (x0, yy, z1)], [shade(pc, 0.86), shade(pc, 0.86), tint(pc, 0.16), tint(pc, 0.16)])
            if arch:
                n = 6
                r = w / 2
                self.poly([(cx + r * math.cos(math.pi * k / n), yy, z1 + r * math.sin(math.pi * k / n)) for k in range(n + 1)], tint(pc, 0.16))
        if arch:
            n, r = 6, w / 2 + fw
            self.plate([(cx + r * math.cos(math.pi * k / n), z1 + r * math.sin(math.pi * k / n)) for k in range(n + 1)], y, dep, frame)
        yb = yy - 0.03
        bw = min(0.12, fw * 0.6)
        for i in range(bars[0]):
            bx = x0 + (i + 1) * w / (bars[0] + 1)
            self.fq(bx - bw / 2, bx + bw / 2, z0, z1 + (w / 2 * 0.9 if arch and bars[0] == 1 else 0), yb, frame)
        for i in range(bars[1]):
            bz = z0 + (i + 1) * h / (bars[1] + 1)
            self.fq(x0, x1, bz - bw / 2, bz + bw / 2, yb, frame)
        if sill:
            self.box(x0 - fw - 0.15, x1 + fw + 0.15, y - dep - sill, y, z0 - fw - 0.22, z0 - fw, frame, bottom=True)
        if shutters is not None:
            sw = w * 0.42
            for sx in (x0 - fw - sw, x1 + fw):
                self.box(sx, sx + sw, y - 0.12, y, z0 - fw, z1 + fw, shutters, bottom=True)

    def door(self, cx, w, h, col='timber', frame='trim', fw=0.25, dep=0.22, glass=0.5, y=0.0, z=0.0, double=False,
             mat='glow', pane='pane', step=0.0, knob='brass'):
        """Door on the plane y. glass = share of the leaf (from the top) that is glazed."""
        x0, x1 = cx - w / 2, cx + w / 2
        self.box(x0 - fw, x1 + fw, y - dep, y, z, z + h + fw, frame, bottom=False)
        yy = y - dep - 0.03
        self.fq(x0, x1, z, z + h, yy, col)
        if glass > 0:
            g0 = z + h * (1 - glass)
            pc = C(pane)
            n = 2 if double else 1
            with self.use(mat):
                for i in range(n):
                    a = x0 + i * w / n + 0.22
                    b = x0 + (i + 1) * w / n - 0.22
                    self.poly([(a, yy - 0.03, g0), (b, yy - 0.03, g0), (b, yy - 0.03, z + h - 0.25), (a, yy - 0.03, z + h - 0.25)],
                              [shade(pc, 0.9), shade(pc, 0.9), tint(pc, 0.15), tint(pc, 0.15)])
        if double:
            self.fq(cx - 0.05, cx + 0.05, z, z + h, yy - 0.04, shade(col, 0.7))
        if knob:
            kx = cx - 0.22 if double else x1 - 0.3
            self.box(kx - 0.07, kx + 0.07, yy - 0.14, yy, z + h * 0.42, z + h * 0.42 + 0.35, knob, bottom=True)
        if step > 0:
            self.box(x0 - fw - 0.4, x1 + fw + 0.4, y - dep - 1.1, y, z - step, z, 'pave_light')

    def shopfront(self, x0, x1, z0, z1, frame='trim', pane='pane', mat='glow', n=None, plinth=0.6, fw=0.25, dep=0.2, y=0.0,
                  plinth_col=None):
        """Wide display window with mullions and a low plinth."""
        self.box(x0 - fw, x1 + fw, y - dep, y, z0, z1 + fw, frame, bottom=False)
        self.box(x0 - fw, x1 + fw, y - dep - 0.08, y, z0, z0 + plinth, plinth_col or shade(frame, 0.78))
        yy = y - dep - 0.03
        pc = C(pane)
        with self.use(mat):
            self.poly([(x0, yy, z0 + plinth), (x1, yy, z0 + plinth), (x1, yy, z1), (x0, yy, z1)],
                      [shade(pc, 0.86), shade(pc, 0.86), tint(pc, 0.18), tint(pc, 0.18)])
        n = n if n is not None else max(0, round((x1 - x0) / 2.6) - 1)
        for i in range(n):
            bx = x0 + (i + 1) * (x1 - x0) / (n + 1)
            self.fq(bx - 0.07, bx + 0.07, z0 + plinth, z1, yy - 0.03, frame)

    def awning(self, x0, x1, z, depth, col, col2='trim', n=None, drop=0.9, val=0.45, y=0.0):
        """Striped shop awning hanging off the plane y."""
        n = n or max(2, round((x1 - x0) / 1.1))
        ye, ze = y - depth, z - drop
        for i in range(n):
            xa, xb = x0 + (x1 - x0) * i / n, x0 + (x1 - x0) * (i + 1) / n
            c = col if i % 2 == 0 else col2
            self.poly([(xa, y, z), (xa, ye, ze), (xb, ye, ze), (xb, y, z)], c)
            self.poly([(xb, y, z - 0.05), (xb, ye, ze - 0.05), (xa, ye, ze - 0.05), (xa, y, z - 0.05)], shade(c, 0.7))
            self.poly([(xa, ye, ze), (xa, ye, ze - val), (xb, ye, ze - val), (xb, ye, ze)], shade(c, 0.9))
        for xs, flip in ((x0, False), (x1, True)):
            tri = [(xs, y, z), (xs, y, ze - val), (xs, ye, ze - val), (xs, ye, ze)]
            self.poly(tri if not flip else tri[::-1], shade(col, 0.8))
            self.poly(tri[::-1] if not flip else tri, shade(col, 0.6))

    def canopy(self, x0, x1, y0, y1, z, col, th=0.35, posts=None, post_col='trim', r=0.4):
        """Flat entrance canopy slab; posts = list of (x, y) to stand it on."""
        self.rbox((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, z, z + th, col, r=r, seg=2, bottom=True)
        for px, py in (posts or []):
            self.cyl(px, py, 0, z, 0.16, 6, post_col, cap=False)

    # ---- roofs
    def roof_gable(self, x0, x1, y0, y1, z0, h, col, axis='x', over=0.8, th=0.35, gable=None, under=None):
        """Pitched roof with real thickness and overhanging eaves. axis = direction of the ridge.
        gable = colour of the two triangular end walls (None = leave them out)."""
        if axis == 'y':
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            with self.at(cx, cy, 0, math.pi / 2):
                self.roof_gable(y0 - cy, y1 - cy, -(x1 - cx), -(x0 - cx), z0, h, col, 'x', over, th, gable, under)
            return
        ym = (y0 + y1) / 2
        s = h / ((y1 - y0) / 2)
        a0, a1 = x0 - over, x1 + over
        yf, yb, ze, zr = y0 - over, y1 + over, z0 - over * s, z0 + h
        uc = under if under is not None else shade(col, 0.62)
        c_lo, c_hi = shade(col, 0.92), tint(col, 0.08)
        self.poly([(a0, yf, ze), (a1, yf, ze), (a1, ym, zr), (a0, ym, zr)], [c_lo, c_lo, c_hi, c_hi])
        self.poly([(a1, yb, ze), (a0, yb, ze), (a0, ym, zr), (a1, ym, zr)], [c_lo, c_lo, c_hi, c_hi])
        self.poly([(a0, ym, zr - th), (a1, ym, zr - th), (a1, yf, ze - th), (a0, yf, ze - th)], uc)
        self.poly([(a1, ym, zr - th), (a0, ym, zr - th), (a0, yb, ze - th), (a1, yb, ze - th)], uc)
        self.poly([(a0, yf, ze - th), (a1, yf, ze - th), (a1, yf, ze), (a0, yf, ze)], shade(col, 0.8))
        self.poly([(a1, yb, ze - th), (a0, yb, ze - th), (a0, yb, ze), (a1, yb, ze)], shade(col, 0.8))
        hexa = [(yf, ze), (ym, zr), (yb, ze), (yb, ze - th), (ym, zr - th), (yf, ze - th)]
        self.poly([(a0, y, z) for y, z in hexa[:3]] + [(a0, y, z) for y, z in hexa[3:]], shade(col, 0.8))
        self.poly([(a1, y, z) for y, z in reversed(hexa)], shade(col, 0.8))
        if gable is not None:
            self.poly([(x0, y1, z0), (x0, y0, z0), (x0, ym, z0 + h - th * 0.5)], gable)
            self.poly([(x1, y0, z0), (x1, y1, z0), (x1, ym, z0 + h - th * 0.5)], gable)

    def roof_hip(self, x0, x1, y0, y1, z0, h, col, over=0.6, ridge=0.35):
        """Hipped roof with a flat soffit so the overhang reads from below."""
        self.box(x0 - over, x1 + over, y0 - over, y1 + over, z0 - 0.25, z0, shade(col, 0.75), top=False, bottom=True)
        self.hip(x0, x1, y0, y1, z0, h, col, ridge=ridge, over=over)

    def vault(self, x0, x1, y0, y1, z0, h, col, axis='x', n=10, over=0.0, end=None, th=0.45, ribs=0, rib_col=None, arc=math.pi):
        """Barrel roof, ridge along `axis`. The arch is a half-ellipse h high over the span.
        end = colour of the two end walls (None = open). arc < pi gives a shallower curve."""
        if axis == 'y':
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            with self.at(cx, cy, 0, math.pi / 2):
                self.vault(y0 - cy, y1 - cy, -(x1 - cx), -(x0 - cx), z0, h, col, 'x', n, over, end, th, ribs, rib_col, arc)
            return
        cy, hw = (y0 + y1) / 2, (y1 - y0) / 2
        a_lo = (math.pi - arc) / 2
        s_lo = math.sin(a_lo)
        c_lo = math.cos(a_lo)

        def prof(k, grow=0.0):
            a = a_lo + arc * k / n
            return (cy - (hw + grow) * math.cos(a) / c_lo, z0 + (h + grow) * (math.sin(a) - s_lo) / (1 - s_lo))
        P = [prof(k) for k in range(n + 1)]
        a0, a1 = x0 - over, x1 + over
        cc = [mixc(shade(col, 0.86), tint(col, 0.1), math.sin(math.pi * k / n)) for k in range(n + 1)]
        for k in range(n):
            (ya, za), (yb, zb) = P[k], P[k + 1]
            self.poly([(a0, ya, za), (a1, ya, za), (a1, yb, zb), (a0, yb, zb)], [cc[k], cc[k], cc[k + 1], cc[k + 1]])
        Q = [prof(k, -th) for k in range(n + 1)]
        ec = shade(col, 0.78)
        if getattr(self, 'vault_soffit', None) is not None:          # the underside, so the roof is solid from below
            for k in range(n):
                self.poly([(a0, *Q[k + 1]), (a1, *Q[k + 1]), (a1, *Q[k]), (a0, *Q[k])], self.vault_soffit)
        for k in range(n):
            self.poly([(a0, *P[k]), (a0, *P[k + 1]), (a0, *Q[k + 1]), (a0, *Q[k])], ec)
            self.poly([(a1, *P[k + 1]), (a1, *P[k]), (a1, *Q[k]), (a1, *Q[k + 1])], ec)
            if over > 0.3:
                self.poly([(a0, *Q[k + 1]), (x0, *Q[k + 1]), (x0, *Q[k]), (a0, *Q[k])], shade(col, 0.6))
                self.poly([(x1, *Q[k + 1]), (a1, *Q[k + 1]), (a1, *Q[k]), (x1, *Q[k])], shade(col, 0.6))
        if end is not None:
            self.poly([(x0, y, z) for y, z in Q], end)
            self.poly([(x1, y, z) for y, z in reversed(Q)], end)
        rc = rib_col if rib_col is not None else tint(col, 0.25)
        for i in range(ribs):
            rx = x0 + (x1 - x0) * (i + 0.5) / ribs
            R = [prof(k, 0.22) for k in range(n + 1)]
            for k in range(n):
                self.poly([(rx - 0.3, *R[k]), (rx + 0.3, *R[k]), (rx + 0.3, *R[k + 1]), (rx - 0.3, *R[k + 1])], rc)
                self.poly([(rx - 0.3, *P[k]), (rx - 0.3, *R[k]), (rx - 0.3, *R[k + 1]), (rx - 0.3, *P[k + 1])], shade(rc, 0.85))
                self.poly([(rx + 0.3, *R[k]), (rx + 0.3, *P[k]), (rx + 0.3, *P[k + 1]), (rx + 0.3, *R[k + 1])], shade(rc, 0.85))
        return P

    def sawtooth(self, x0, x1, y0, y1, z0, n, h, col, wall='w_cream', glass='glass_a', face=-1, mat='glass'):
        """North-light factory roof: n teeth along x, each with one upright glazed face."""
        w = (x1 - x0) / n
        gc = C(glass)
        for i in range(n):
            xa, xb = x0 + i * w, x0 + (i + 1) * w
            xv, xl = (xa, xb) if face < 0 else (xb, xa)       # upright face at xv, slope falls to xl
            up = [(xv, y0, z0), (xv, y0, z0 + h), (xv, y1, z0 + h), (xv, y1, z0)]
            slope = [(xv, y0, z0 + h), (xl, y0, z0), (xl, y1, z0), (xv, y1, z0 + h)]
            if face < 0:
                self.poly(up, wall)
                with self.use(mat):
                    self.poly([(xv - 0.06, y0 + 0.8, z0 + 0.7), (xv - 0.06, y0 + 0.8, z0 + h - 0.5), (xv - 0.06, y1 - 0.8, z0 + h - 0.5), (xv - 0.06, y1 - 0.8, z0 + 0.7)],
                              [shade(gc, 0.85), tint(gc, 0.2), tint(gc, 0.2), shade(gc, 0.85)])
                self.poly(slope, [tint(col, 0.08), shade(col, 0.9), shade(col, 0.9), tint(col, 0.08)])
                self.poly([(xa, y0, z0), (xb, y0, z0), (xa, y0, z0 + h)], wall)
                self.poly([(xb, y1, z0), (xa, y1, z0), (xa, y1, z0 + h)], wall)
            else:
                self.poly(up[::-1], wall)
                with self.use(mat):
                    self.poly([(xv + 0.06, y0 + 0.8, z0 + 0.7), (xv + 0.06, y1 - 0.8, z0 + 0.7), (xv + 0.06, y1 - 0.8, z0 + h - 0.5), (xv + 0.06, y0 + 0.8, z0 + h - 0.5)],
                              [shade(gc, 0.85), shade(gc, 0.85), tint(gc, 0.2), tint(gc, 0.2)])
                self.poly(slope[::-1], [tint(col, 0.08), shade(col, 0.9), shade(col, 0.9), tint(col, 0.08)])
                self.poly([(xa, y0, z0), (xb, y0, z0), (xb, y0, z0 + h)], wall)
                self.poly([(xb, y1, z0), (xa, y1, z0), (xb, y1, z0 + h)], wall)

    # ---- street furniture and greenery
    def pad(self, w, d, h=0.45, col='pave', r=3.0, cy=0.0, cx=0.0, skirt=2.0, edge='kerb', seg=3):
        """The paved plot a building stands on. The skirt goes below ground so it sits on gentle slopes."""
        pts = rrect(w, d, r, seg, cx, cy)
        self.frustum(pts, pts, -skirt, h - 0.12, edge, top=False)
        inner = rrect(w - 0.24, d - 0.24, max(r - 0.12, 0.02), seg, cx, cy) if len(pts) > 4 else rect(w - 0.24, d - 0.24, cx, cy)
        self.frustum(pts, inner, h - 0.12, h, edge, top=col)
        return h

    def steps(self, cx, y0, w, n, rise=0.25, run=0.5, col='pave_light', z=0.0):
        """n steps climbing towards +y, the first tread starting at y0."""
        for i in range(n):
            self.box(cx - w / 2, cx + w / 2, y0 + i * run, y0 + n * run + 0.02, z + i * rise, z + (i + 1) * rise, col)

    def lamp(self, x, y, h=6.0, z=0.0, arm=1.3, rz=0.0, col='iron'):
        """Street lamp with an arm; the head is in the glow material. The arm points to -y before rz."""
        with self.at(x, y, z, rz):
            self.cyl(0, 0, 0, 0.6, 0.26, 5, col)
            self.cyl(0, 0, 0.6, h, 0.1, 4, col, cap=False)
            self.beam((0, 0, h - 0.05), (0, -arm, h + 0.2), 0.14, 0.14, col)
            with self.use('glow'):
                self.cbox(0, -arm, 0.55, 0.7, h - 0.2, h + 0.12, 'lamp', bottom=True)
            self.cbox(0, -arm, 0.75, 0.9, h + 0.12, h + 0.26, col)

    def globe_lamp(self, x, y, h=4.0, z=0.0, col='iron', r=0.42):
        self.cyl(x, y, z, z + h, 0.09, 4, col, cap=False)
        self.cyl(x, y, z, z + 0.35, 0.22, 5, col)
        with self.use('glow'):
            self.ball(x, y, z + h + r * 0.8, r, 'lamp', n=6, rings=3)

    def wall_lamp(self, cx, z, y=0.0, col='iron'):
        self.box(cx - 0.1, cx + 0.1, y - 0.5, y, z + 0.5, z + 0.62, col, bottom=True)
        with self.use('glow'):
            self.box(cx - 0.22, cx + 0.22, y - 0.75, y - 0.3, z, z + 0.5, 'lamp', bottom=True)

    def bush(self, x, y, r=1.0, z=0.0, col='leaf'):
        self.blob(x, y, z + r * 0.55, r, col, n=6, rings=3, sz=0.75)

    def planter(self, cx, cy, w=2.4, d=1.2, h=0.8, col='w_stone', plant='leaf', z=0.0, flowers=None):
        self.rbox(cx, cy, w, d, z, z + h, col, r=0.2, seg=1, top='soil')
        k = max(1, round(w / 1.3))
        for i in range(k):
            px = cx - w / 2 + (i + 0.5) * w / k
            self.blob(px, cy, z + h + 0.35, min(w / k, d) * 0.62, plant, n=6, rings=3)
            if flowers:
                self.ball(px + 0.1, cy - 0.15, z + h + 0.85, 0.3, flowers, n=5, rings=2)

    def tree(self, x, y, s=1.0, kind='round', z=0.0, col='leaf'):
        """Small tree with a rounded low-poly canopy (about 7 m tall at s = 1)."""
        self.cyl(x, y, z, z + 3.0 * s, 0.3 * s, 5, 'bark', r2=0.2 * s, cap=False)
        if kind == 'round':
            self.blob(x, y, z + 4.4 * s, 2.3 * s, col, n=7, rings=4)
            self.blob(x + 0.9 * s, y + 0.4 * s, z + 5.6 * s, 1.5 * s, tint(col, 0.1), n=6, rings=3)
        elif kind == 'tall':
            self.blob(x, y, z + 5.0 * s, 1.7 * s, col, n=6, rings=4, sz=1.7)
        else:
            self.lathe(x, y, [(1.9 * s, z + 2.0 * s), (1.2 * s, z + 4.6 * s), (0.0, z + 8.0 * s)], 6,
                       [shade('leaf_pine', 0.8), 'leaf_pine', tint('leaf_pine', 0.15)], bottom=True)

    def bench(self, x, y, rz=0.0, w=2.2, z=0.0, col='timber'):
        with self.at(x, y, z, rz):
            self.cbox(0, 0, w, 0.55, 0.45, 0.58, col, bottom=True)
            self.cbox(0, 0.3, w, 0.1, 0.58, 1.05, col, bottom=True)
            for sx in (-w / 2 + 0.2, w / 2 - 0.2):
                self.cbox(sx, 0.05, 0.12, 0.5, 0, 0.45, 'iron', top=False)

    def flag(self, x, y, h=9.0, col='d_software', w=2.6, fh=1.6, z=0.0, rz=0.0, pole='trim'):
        """Flag pole with a small waving flag (two-sided)."""
        with self.at(x, y, z, rz):
            self.cyl(0, 0, 0, h, 0.09, 5, pole, cap=False)
            self.ball(0, 0, h + 0.12, 0.17, 'gold_g', n=5, rings=2)
            n = 3
            for i in range(n):
                xa, xb = 0.1 + w * i / n, 0.1 + w * (i + 1) / n
                ya, yb = 0.22 * math.sin(i * 1.9), 0.22 * math.sin((i + 1) * 1.9)
                q = [(xa, ya, h - 0.2 - fh), (xb, yb, h - 0.2 - fh), (xb, yb, h - 0.2), (xa, ya, h - 0.2)]
                self.sheet(q, [shade(col, 0.9), shade(col, 0.9), tint(col, 0.06), tint(col, 0.06)])

    def banner(self, x, y, z0, z1, w, col, rz=0.0, pole='iron', h=None, emblem=None, sideways=1):
        """Tall vertical banner hung from a pole with a short arm (two-sided)."""
        top = h if h is not None else z1 + 0.6
        with self.at(x, y, 0, rz):
            self.cyl(0, 0, 0, top, 0.11, 5, pole, cap=False)
            self.cyl(0, 0, 0, 0.5, 0.26, 5, pole)
            xa, xb = (0.15, 0.15 + w) if sideways > 0 else (-0.15 - w, -0.15)
            for zz in (z0, z1):
                self.box(min(xa, xb) - 0.1, max(xa, xb) + 0.1, -0.05, 0.05, zz - 0.06, zz + 0.06, pole, bottom=True)
            q = [(xa, 0, z0), (xb, 0, z0), (xb, 0, z1), (xa, 0, z1)]
            self.sheet(q, [shade(col, 0.88), shade(col, 0.88), tint(col, 0.05), tint(col, 0.05)])
            if emblem:
                emblem((xa + xb) / 2, (z0 + z1) / 2)

    def column(self, x, y, z0, z1, r=0.6, n=8, col='trim', base=True):
        if base:
            self.cbox(x, y, r * 2.7, r * 2.7, z0, z0 + 0.4, col)
            self.cbox(x, y, r * 2.7, r * 2.7, z1 - 0.4, z1, col, bottom=True)
            self.cyl(x, y, z0 + 0.4, z1 - 0.4, r, n, shade(col, 0.96), r2=r * 0.88, cap=False, col1=col)
        else:
            self.cyl(x, y, z0, z1, r, n, col, cap=False)

    def fence(self, pts, h=1.4, col='trim', closed=False, z=0.0, post=0.16, rails=(0.45, 0.95), every=None):
        """Post-and-rail fence along a ground polyline of (x, y)."""
        n = len(pts)
        segs = n if closed else n - 1
        for i in range(segs):
            a, b = pts[i], pts[(i + 1) % n]
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            k = max(1, round(L / every)) if every else 1
            for j in range(k):
                px, py = a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k
                self.cbox(px, py, post, post, z, z + h, col)
            for r in rails:
                self.beam((a[0], a[1], z + h * r), (b[0], b[1], z + h * r), 0.07, 0.1, col)
        if not closed:
            self.cbox(pts[-1][0], pts[-1][1], post, post, z, z + h, col)

    def panel_fence(self, pts, h=2.0, col='trim', closed=False, z=0.0, t=0.12, col2=None):
        """Solid hoarding fence."""
        n = len(pts)
        for i in range(n if closed else n - 1):
            a, b = pts[i], pts[(i + 1) % n]
            self.beam((a[0], a[1], z + h / 2), (b[0], b[1], z + h / 2), t, h, col if (col2 is None or i % 2 == 0) else col2)

    def ac_unit(self, x, y, z, s=1.0, rz=0.0):
        with self.at(x, y, z, rz):
            self.rbox(0, 0, 1.8 * s, 1.2 * s, 0.15, 1.3 * s, 'steel_light', r=0.12, seg=1, top='metal_light')
            self.cyl(0, 0, 1.3 * s, 1.3 * s + 0.08, 0.42 * s, 6, 'iron')

    def vent(self, x, y, z, h=1.2, r=0.3):
        self.cyl(x, y, z, z + h, r, 6, 'zinc', cap=False)
        self.cyl(x, y, z + h, z + h + 0.25, r * 1.6, 6, 'zinc', r2=r * 0.4)

    def chimney(self, x, y, z0, z1, w=1.2, col='w_brick', capc='trim'):
        self.cbox(x, y, w, w, z0, z1, col)
        self.cbox(x, y, w + 0.3, w + 0.3, z1, z1 + 0.25, capc, bottom=True)
        self.cbox(x, y, w * 0.5, w * 0.5, z1 + 0.25, z1 + 0.7, 'terracotta')

    def roof_plant(self, x0, x1, y0, y1, z, n=2, stair=True):
        rng = self.rng
        if stair:
            self.rbox(x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * 0.68, 4.2, 3.4, z, z + 3.0, 'w_grey', r=0.3, seg=1, top='roof_light', bev=0.2)
        for _ in range(n):
            self.ac_unit(rng.uniform(x0 + 2, x1 - 2), rng.uniform(y0 + 1.5, y0 + (y1 - y0) * 0.45), z, rng.uniform(0.9, 1.3))

    def parapet_roof(self, cx, cy, w, d, z, col, h=0.8, t=0.4, r=0.6, roof='roof_light', seg=2):
        """Flat roof with a raised rim (rounded corners to match rbox)."""
        outer = rrect(w, d, r, seg, cx, cy)
        inner = rrect(w - 2 * t, d - 2 * t, max(r - t, 0.02), seg, cx, cy) if len(outer) > 4 else rect(w - 2 * t, d - 2 * t, cx, cy)
        n = len(outer)
        for i in range(n):
            j = (i + 1) % n
            self.wall(outer[i], outer[j], z, z + h, col)
            self.wall(inner[j], inner[i], z + 0.02, z + h, shade(col, 0.88))
        self.cap_ring(outer, inner, z + h, col)
        self.cap(inner, z + 0.02, roof)

    def band(self, cx, cy, w, d, z0, z1, col, r=0.6, out=0.15, seg=2, ring=False):
        """A projecting band (cornice, string course, roof edge) round a rounded box.
        ring=True leaves the middle open (a trim round a roof terrace instead of a solid roof slab)."""
        if not ring:
            self.rbox(cx, cy, w + 2 * out, d + 2 * out, z0, z1, col, r=r + out, seg=seg, bottom=True)
            return
        outer = rrect(w + 2 * out, d + 2 * out, r + out, seg, cx, cy)
        inner = rrect(w - 0.5, d - 0.5, max(r - 0.25, 0.02), seg, cx, cy) if len(outer) > 4 else rect(w - 0.5, d - 0.5, cx, cy)
        self.frustum(outer, outer, z0, z1, col, top=False)
        self.cap_ring(outer, inner, z1, col)
        self.cap_ring(inner, outer, z0, shade(col, 0.7))

    def string_lights(self, a, b, sag=1.2, n=7, col='lamp_warm', wire='iron', bulb=0.2, cols=None):
        """A sagging wire of little lamps between two 3D points."""
        a, b = Vector(a), Vector(b)
        pts = []
        for i in range(n + 1):
            t = i / n
            p = a.lerp(b, t)
            p.z -= sag * 4 * t * (1 - t)
            pts.append(p)
        for i in range(n):
            self.beam(pts[i], pts[i + 1], 0.05, 0.05, wire)
        with self.use('glow'):
            for i in range(1, n):
                p = pts[i]
                c = cols[i % len(cols)] if cols else col
                self.lathe(p.x, p.y, [(0.0, p.z - bulb * 1.7), (bulb, p.z - bulb * 0.8), (0.0, p.z)], 4, c, cap=False)

    def bunting(self, a, b, cols, sag=1.0, n=8, size=0.8):
        """A line of little triangular flags between two 3D points (two-sided)."""
        a, b = Vector(a), Vector(b)
        pts = []
        for i in range(n + 1):
            t = i / n
            p = a.lerp(b, t)
            p.z -= sag * 4 * t * (1 - t)
            pts.append(p)
        for i in range(n):
            p, q = pts[i], pts[i + 1]
            mid = (p + q) / 2
            tri = [tuple(p), tuple(q), (mid.x, mid.y, mid.z - size)]
            c = cols[i % len(cols)]
            self.sheet(tri, c, shade(c, 0.85))

    def balloon(self, x, y, z, col, r=0.9, string=3.0, anchor=None):
        self.ball(x, y, z, r, shade(col, 0.82), n=7, rings=4, sz=1.18, col1=tint(col, 0.2))
        self.lathe(x, y, [(0.0, z - r * 1.18 - 0.02), (0.16, z - r * 1.18 - 0.22)], 4, shade(col, 0.7), cap=True)
        a = anchor if anchor is not None else (x, y, z - r * 1.2 - string)
        self.beam((x, y, z - r * 1.2), a, 0.035, 0.035, 'trim')

    def person(self, x, y, z=0.0, col='t_blue', s=1.0, rz=0.0, skin='w_peach'):
        """A tiny simplified figure (about 1.9 m at s = 1) for scale and life."""
        with self.at(x, y, z, rz, s=s):
            self.lathe(0, 0, [(0.26, 0.0), (0.34, 0.95), (0.28, 1.4), (0.0, 1.45)], 5, col, bottom=True)
            self.ball(0, 0, 1.7, 0.27, skin, n=5, rings=3)

    # ---- stats
    def tris(self):
        return sum(len(p[0]) - 2 for part in self.parts.values() for p in part)

    def part_tris(self, suffix):
        return sum(len(p[0]) - 2 for p in self.parts.get(suffix, []))


# ---------------------------------------------------------------- AO, mesh, materials
def _hemi(n, seed=3):
    rng = random.Random(seed)
    out = []
    for _ in range(n):
        u, v = rng.random(), rng.random()
        r, th = math.sqrt(u), 2 * math.pi * v
        out.append((r * math.cos(th), r * math.sin(th), math.sqrt(max(0.0, 1 - u))))
    return out


HEMI = _hemi(18)


def _lerp3(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def _split_tri(P, Cc, mat, cell, out, depth=0):
    e = max((Vector(P[i]) - Vector(P[(i + 1) % 3])).length for i in range(3))
    if e <= cell * 1.5 or depth >= 3:
        out.append((P, Cc, mat))
        return
    M = [_lerp3(P[i], P[(i + 1) % 3], 0.5) for i in range(3)]
    Mc = [_lerp3(Cc[i], Cc[(i + 1) % 3], 0.5) for i in range(3)]
    for tri, col in (((P[0], M[0], M[2]), (Cc[0], Mc[0], Mc[2])), ((M[0], P[1], M[1]), (Mc[0], Cc[1], Mc[1])),
                     ((M[2], M[1], P[2]), (Mc[2], Mc[1], Cc[2])), ((M[0], M[1], M[2]), (Mc[0], Mc[1], Mc[2]))):
        _split_tri(list(tri), list(col), mat, cell, out, depth + 1)


def subdivide_big(model, cell=4.0, thin=2.0):
    """Cut big flat faces into cells so the baked shading has somewhere to live (soft gradients under
    eaves and along the ground instead of one flat tone per wall)."""
    for key, part in model.parts.items():
        out = []
        for pts, cols, mat in part:
            if mat in ('glass', 'glass_dark', 'glow', 'sign'):
                out.append((pts, cols, mat))
                continue
            if len(pts) == 4:
                P = [Vector(p) for p in pts]
                lu = max((P[1] - P[0]).length, (P[2] - P[3]).length)
                lv = max((P[3] - P[0]).length, (P[2] - P[1]).length)
                nu, nv = max(1, math.ceil(lu / cell - 0.15)), max(1, math.ceil(lv / cell - 0.15))
                if min(lu, lv) < thin:
                    nu = nv = 1
                if nu * nv > 1:
                    def at(u, v, A=pts, Cc=cols):
                        return (_lerp3(_lerp3(A[0], A[1], u), _lerp3(A[3], A[2], u), v), _lerp3(_lerp3(Cc[0], Cc[1], u), _lerp3(Cc[3], Cc[2], u), v))
                    for i in range(nu):
                        for j in range(nv):
                            q = [at(i / nu, j / nv), at((i + 1) / nu, j / nv), at((i + 1) / nu, (j + 1) / nv), at(i / nu, (j + 1) / nv)]
                            out.append(([a for a, _ in q], [c for _, c in q], mat))
                    continue
            elif len(pts) == 3:
                _split_tri(list(pts), list(cols), mat, cell, out)
                continue
            out.append((pts, cols, mat))
        part[:] = out


def bake_ao(model, strength=0.72):
    """Per-corner ambient occlusion, multiplied into the vertex colours. Returns nothing."""
    if getattr(model, 'ao_cell', 4.0):
        subdivide_big(model, getattr(model, 'ao_cell', 4.0))
    verts, faces = [], []
    for part in model.parts.values():
        for pts, _, _ in part:
            faces.append(list(range(len(verts), len(verts) + len(pts))))
            verts.extend(Vector(p) for p in pts)
    if model.ground_z is not None:
        g = 4000
        z = model.ground_z
        faces.append(list(range(len(verts), len(verts) + 4)))
        verts.extend([Vector((-g, -g, z)), Vector((g, -g, z)), Vector((g, g, z)), Vector((-g, g, z))])
    if not faces:
        return
    bvh = BVHTree.FromPolygons(verts, faces, all_triangles=False)
    D = model.ao
    # Rays start a little way off the surface, so thin things fixed to a wall (frames, lamps, signs) do not
    # blot out a whole wall cell; the ground, eaves and neighbouring masses still shade it.
    off = min(0.4, D * 0.045)
    cache = {}
    for part in model.parts.values():
        for pi, (pts, cols, mat) in enumerate(part):
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
            nk = (round(n.x, 1), round(n.y, 1), round(n.z, 1))
            new = []
            for i, p in enumerate(P):
                dc = c - p
                o = p + n * off + dc * min(0.12, 0.45 / max(dc.length, 1e-6))
                key = (round(o.x, 1), round(o.y, 1), round(o.z, 1), nk)
                k = cache.get(key)
                if k is None:
                    occ = 0.0
                    for hx, hy, hz in HEMI:
                        d = t * hx + b * hy + n * hz
                        hit = bvh.ray_cast(o, d, D)
                        if hit[0] is not None:
                            occ += 1.0 - (hit[3] / D) ** 0.7
                    k = 1.0 - strength * (occ / len(HEMI))
                    cache[key] = k
                new.append(tuple(x * k for x in cols[i]))
            part[pi] = (pts, new, mat)


BEVEL = True
SOFT_ON = [True]          # off for trees and animals: they are smooth shapes already
SOFT_SKIP = None


def soften(bm):
    """Round the hard edges the way a modeller would: a chamfer on every sharp edge (larger on big parts), which the
    smooth shading then reads as a soft, rounded edge catching a highlight. Glass and glow panes are left crisp."""
    if SOFT_SKIP is None:
        globals()['SOFT_SKIP'] = {MATS.index(n) for n in ('glass', 'glass_dark', 'glass_tint', 'glow', 'sign')}
    groups = {0.14: [], 0.06: [], 0.025: []}
    for e in bm.edges:
        if len(e.link_faces) != 2:
            continue
        f1, f2 = e.link_faces
        if f1.material_index in SOFT_SKIP or f2.material_index in SOFT_SKIP:
            continue
        try:
            ang = f1.normal.angle(f2.normal)
        except ValueError:
            continue
        if ang < math.radians(50) or ang > math.radians(150):
            continue
        L = e.calc_length()
        short = min(min(l.edge.calc_length() for l in f.loops) for f in (f1, f2))
        if L >= 4.0 and short >= 1.0:
            groups[0.14].append(e)
        elif L >= 1.2 and short >= 0.3:
            groups[0.06].append(e)
    done = set()
    for off in (0.14, 0.06, 0.025):
        es = [e for e in groups[off] if e.is_valid and e not in done]
        if not es:
            continue
        try:
            res = bmesh.ops.bevel(bm, geom=es, offset=off, offset_type='OFFSET', segments=1, profile=0.5, affect='EDGES', clamp_overlap=True)
        except Exception as ex:
            print('bevel skipped:', ex)
            continue


def to_object(name, polys, mats, smooth_angle=50.0, origin=(0.0, 0.0, 0.0)):
    verts, faces, cols, mi = [], [], [], []
    ox, oy, oz = origin
    for pts, c, mat in polys:
        faces.append(list(range(len(verts), len(verts) + len(pts))))
        verts.extend((p[0] - ox, p[1] - oy, p[2] - oz) for p in pts)
        for q in c:
            cols.extend((q[0], q[1], q[2], 1.0))
        mi.append(MATS.index(mat))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    ca.data.foreach_set('color', cols)
    for mname in MATS:
        me.materials.append(mats[mname])
    me.polygons.foreach_set('material_index', mi)
    if any(mat == 'sign' for _, _, mat in polys):          # name boards: a 0-1 UV square per quad, for the site to draw on
        uvl = me.uv_layers.new(name='UVMap')
        uvs = []
        for pts, _, mat in polys:
            sq_ = [(0, 0), (1, 0), (1, 1), (0, 1)]
            for i in range(len(pts)):
                uvs.extend(sq_[i] if (mat == 'sign' and len(pts) == 4) else (0.0, 0.0))
        uvl.data.foreach_set('uv', uvs)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0008)
    if BEVEL and SOFT_ON[0]:
        soften(bm)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    me.set_sharp_from_angle(angle=math.radians(smooth_angle))
    me.color_attributes.active_color = me.color_attributes['Col']
    me.color_attributes.render_color_index = 0
    me.update()
    ob = bpy.data.objects.new(name, me)
    ob.location = origin
    bpy.context.scene.collection.objects.link(ob)
    md = ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
    md.keep_sharp = True
    md.weight = 60
    return ob


def make_materials():
    out = {}
    for name in MATS:
        rough, metal, alpha = MAT_DEF[name]
        mat = bpy.data.materials.new(name)
        mat.use_backface_culling = True
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        o = nt.nodes.new('ShaderNodeOutputMaterial')
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        vc = nt.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        nt.links.new(vc.outputs['Color'], b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = rough
        b.inputs['Metallic'].default_value = metal
        if alpha < 1.0:
            b.inputs['Alpha'].default_value = alpha
            for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
                try:
                    setattr(mat, attr, val)
                except Exception:
                    pass
        nt.links.new(b.outputs['BSDF'], o.inputs['Surface'])
        out[name] = mat
    return out


def realize(model, mats):
    """Bake AO and create the Blender objects (main mesh + child nodes). Returns (root, kids, manifest row)."""
    bake_ao(model)
    SOFT_ON[0] = model.cls not in ('tree', 'animal')
    root = to_object(model.name, model.parts[''], mats, model.smooth)
    kids, children = [], []
    for suf, polys in model.parts.items():
        if not suf or not polys:
            continue
        piv = model.pivots.get(suf, (0.0, 0.0, 0.0))
        ob = to_object(f'{model.name}_{suf}', polys, mats, model.smooth, origin=piv)
        ob.parent = root
        kids.append(ob)
        # glTF axes: x, y up, z = -blender y
        children.append({'name': ob.name, 'pivot': [round(piv[0], 3), round(piv[2], 3), round(-piv[1], 3)], 'tris': model.part_tris(suf)})
    mn, mx = model.bounds()
    row = {'name': model.name, 'class': model.cls,
           'size': [round(mx[0] - mn[0], 1), round(mx[2], 1), round(mx[1] - mn[1], 1)],
           'min': [round(mn[0], 1), round(mn[2], 1), round(-mx[1], 1)], 'max': [round(mx[0], 1), round(mx[2], 1), round(-mn[1], 1)],
           'tris': model.tris()}
    if children:
        row['children'] = children
    row.update(model.meta)
    return root, kids, row
