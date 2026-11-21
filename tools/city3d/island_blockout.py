"""Rough block model of the island city (coast loop plan), rendered in two looks.
   blender -b --factory-startup --python island_blockout.py -- film|model out.png [el] [az]
   A picture for judging shape and layout only. Not used by the site.
"""
import sys, math, random
import bpy, bmesh
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
LOOK = args[0] if args else 'film'
OUT = args[1] if len(args) > 1 else '/tmp/island.png'
CAM_EL = float(args[2]) if len(args) > 2 else 30.0
CAM_AZ = float(args[3]) if len(args) > 3 else 8.0
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
rng = random.Random(7)

RX, RY = 380.0, 235.0        # island half-sizes, metres
LX, LY = 300.0, 170.0        # metro loop half-sizes
DECK = 10.0                  # height of the track deck
TOWER_H = 200.0

DISTRICTS = {
    'software': (0.84, 0.16, 0.12), 'books': (0.90, 0.66, 0.05), 'film': (0.12, 0.31, 0.78),
    'games': (0.91, 0.45, 0.10), 'health': (0.00, 0.52, 0.24),
}
WALLS = {'software': (0.90, 0.90, 0.92), 'books': (0.96, 0.88, 0.70), 'film': (0.86, 0.82, 0.78),
         'games': (0.98, 0.90, 0.80), 'health': (0.95, 0.96, 0.95)}
# stop order round the loop: (name, district, level, kind)
STOPS = [
    ('hirvo', 'software', 4, 'office'), ('export', 'software', 4, 'harbour'), ('court', 'software', 3, 'sports'),
    ('uhome', 'software', 3, 'flats'), ('pindou', 'software', 1, 'lot'),
    ('bookshop', 'books', 4, 'bookshop'), ('printworks', 'books', 4, 'works'), ('artstudio', 'books', 2, 'site'),
    ('museum', 'film', 4, 'museum'), ('jazzbar', 'film', 4, 'bar'), ('photostudio', 'film', 2, 'site'),
    ('toyshop', 'games', 3, 'toyshop'), ('partyhouse', 'games', 3, 'party'),
    ('pharmacy', 'health', 3, 'pharmacy'), ('eventhall', 'health', 3, 'hall'),
]
STEP = 360.0 / (len(STOPS) + 2.5)


def coast_k(th):
    return 1 + 0.035 * math.sin(3 * th + 1.0) + 0.025 * math.sin(5 * th + 2.0) + 0.015 * math.sin(9 * th + 0.5)


def e_of(x, y):
    return math.hypot(x / RX, y / RY) / coast_k(math.atan2(y / RY, x / RX))


def smooth(a, b, t):
    t = max(0.0, min(1.0, (t - a) / (b - a)))
    return t * t * (3 - 2 * t)


def hill(x, y):
    return 42.0 * math.exp(-((x / 120.0) ** 2 + ((y - 6) / 62.0) ** 2))


def hgt(x, y):
    e = e_of(x, y)
    if e < 1:
        return 3.2 * smooth(1.0, 0.9, e) + hill(x, y)
    return -min(8.0, (e - 1) * 55)


def LP(a):
    r = math.radians(a)
    return (LX * math.cos(r), -LY * math.sin(r))


def tan_dir(a):
    r = math.radians(a)
    dx, dy = -LX * math.sin(r), -LY * math.cos(r)
    L = math.hypot(dx, dy)
    return (dx / L, dy / L)


def stop_angle(i):
    return 90 + STEP * (i + 1)


class Builder:
    def __init__(self):
        self.bms = {}

    def bm(self, mat):
        if mat not in self.bms:
            self.bms[mat] = bmesh.new()
        return self.bms[mat]

    def box(self, mat, c, size, yaw=0.0):
        M = Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Diagonal((size[0], size[1], size[2], 1))
        bmesh.ops.create_cube(self.bm(mat), size=1.0, matrix=M)

    def cyl(self, mat, c, r, h, r2=None, seg=16):
        bmesh.ops.create_cone(self.bm(mat), cap_ends=True, segments=seg, radius1=r,
                              radius2=r if r2 is None else r2, depth=h, matrix=Matrix.Translation(c))

    def ico(self, mat, c, r, sz=1.0, sub=1):
        M = Matrix.Translation(c) @ Matrix.Diagonal((1, 1, sz, 1))
        bmesh.ops.create_icosphere(self.bm(mat), subdivisions=sub, radius=r, matrix=M)

    def gable(self, mat, c, L, W, H, yaw=0.0):
        bm = self.bm(mat)
        M = Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, 'Z')
        P = [(-L / 2, -W / 2, 0), (-L / 2, W / 2, 0), (-L / 2, 0, H), (L / 2, -W / 2, 0), (L / 2, W / 2, 0), (L / 2, 0, H)]
        v = [bm.verts.new(M @ Vector(p)) for p in P]
        for f in [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (0, 2, 5, 3)]:
            bm.faces.new([v[i] for i in f])

    def vault(self, mat, c, L, W, H, yaw=0.0):
        M = (Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Diagonal((L, W / 2, H, 1))
             @ Matrix.Rotation(math.pi / 2, 4, 'Y'))
        bmesh.ops.create_cone(self.bm(mat), cap_ends=True, segments=20, radius1=1, radius2=1, depth=1, matrix=M)

    def strip(self, mat, pts, width, closed=False):
        """pts: list of (x, y, z_bottom, z_top). A ribbon with a box cross-section."""
        bm = self.bm(mat)
        n = len(pts)
        secs = []
        for i, (x, y, zb, zt) in enumerate(pts):
            a = pts[(i - 1) % n] if (closed or i > 0) else pts[i]
            b = pts[(i + 1) % n] if (closed or i < n - 1) else pts[i]
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy) or 1
            nx, ny = -dy / L * width / 2, dx / L * width / 2
            secs.append([bm.verts.new((x - nx, y - ny, zb)), bm.verts.new((x + nx, y + ny, zb)),
                         bm.verts.new((x + nx, y + ny, zt)), bm.verts.new((x - nx, y - ny, zt))])
        for i in range(n if closed else n - 1):
            s, t = secs[i], secs[(i + 1) % n]
            for k in range(4):
                bm.faces.new([s[k], s[(k + 1) % 4], t[(k + 1) % 4], t[k]])
        if not closed:
            bm.faces.new(secs[0])
            bm.faces.new(list(reversed(secs[-1])))


B = Builder()
occupied = []          # (x, y, r) circles that trees and houses must avoid


def site(p, face):
    """Local frame at p. `face` is the unit direction from the track to the building (local +y)."""
    yaw = math.atan2(face[1], face[0]) - math.pi / 2
    g = hgt(p[0], p[1])
    c, s = math.cos(yaw), math.sin(yaw)

    def at(dx, dy, dz):
        return (p[0] + c * dx - s * dy, p[1] + s * dx + c * dy, g + dz)

    def bx(mat, dx, dy, dz, size):
        B.box(mat, at(dx, dy, dz), size, yaw)
    return at, bx, yaw


def scaffold(bx, w, d, floors, crane=True):
    for i in range(4):
        for j in range(3):
            bx('scaffold', -w / 2 + i * w / 3, -d / 2 + j * d / 2, floors * 3, (0.7, 0.7, floors * 6))
    for f in range(1, floors + 1):
        bx('scaffold', 0, 0, f * 6, (w + 1, d + 1, 0.45))
    bx('lot', 0, 0, 0.35, (w + 14, d + 12, 0.5))
    if crane:
        bx('crane', w / 2 + 6, d / 2, 19, (1.6, 1.6, 38))
        bx('crane', w / 2 - 6, d / 2, 37, (30, 1.4, 1.4))
        bx('crane', w / 2 + 6, d / 2, 38.6, (3, 3, 2))


def building(kind, dist, p, face, S=1.32):
    T = Builder()
    yaw = 0.0

    def at(dx, dy, dz):
        return (dx, dy, dz)

    def bx(mat, dx, dy, dz, size):
        T.box(mat, (dx, dy, dz), size, 0.0)
    W, R, G = dist + ':wall', dist + ':roof', dist + ':glass'
    if kind not in ('lot', 'site'):
        bx('pave', 0, 0, 0.3, (52, 40, 0.6))
    if kind == 'office':
        bx(G, -6, 2, 26, (24, 24, 52)); bx(R, -6, 2, 53, (25, 25, 1.6)); bx(R, -6, 2, 56, (8, 8, 5))
        bx(W, 16, 2, 8, (20, 24, 16)); bx(R, 16, 2, 16.5, (21, 25, 1.0)); bx(G, 16, -10.2, 7, (16, 0.6, 9))
    elif kind == 'harbour':
        bx('pave', 0, 14, 0.5, (86, 30, 1.0))
        bx(W, 0, -2, 5, (62, 28, 10)); T.vault(R, at(0, -2, 10), 62, 28, 7, yaw)
        bx('deck', -24, 44, 0.9, (10, 46, 1.8)); bx('deck', 24, 44, 0.9, (10, 46, 1.8))
        for sx in (-24, 24):
            bx('crane', sx, 34, 12, (1.8, 1.8, 24)); bx('crane', sx, 42, 23, (1.8, 22, 1.8)); bx('crane', sx, 34, 24.6, (4, 4, 2))
        cols = ['software:roof', 'books:roof', 'film:roof', 'health:roof']
        for i in range(10):
            bx(cols[i % 4], -12 + (i % 5) * 6.4, 20 + (i // 5) * 3.2, 2.3, (6, 2.6, 2.6))
    elif kind == 'sports':
        bx(W, 0, 10, 5, (44, 24, 10)); T.vault(R, at(0, 10, 10), 44, 24, 6.5, yaw)
        bx('court_a', -12, -12, 0.75, (20, 11, 0.3)); bx('court_b', 12, -12, 0.75, (20, 11, 0.3))
    elif kind == 'flats':
        bx(W, 0, 2, 8, (36, 20, 16)); bx(W, -5, 2, 20, (26, 20, 8)); bx(W, -10, 2, 28, (16, 20, 8))
        bx(R, 13, 2, 16.4, (10, 20, 0.8)); bx(R, 4, 2, 24.4, (8, 20, 0.8)); bx(R, -10, 2, 32.4, (17, 21, 0.9))
        bx(G, 0, -8.2, 8, (30, 0.6, 12))
    elif kind == 'lot':
        bx('lot', 0, 0, 0.35, (34, 26, 0.5))
        for dx, dy, s in ((0, 13, (34, 0.4, 1.8)), (0, -13, (34, 0.4, 1.8)), (17, 0, (0.4, 26, 1.8)), (-17, 0, (0.4, 26, 1.8))):
            bx('fence', dx, dy, 1.3, s)
        bx(R, -10, -13.4, 4, (6, 0.4, 3.4))
    elif kind == 'bookshop':
        bx(W, 0, 2, 7, (34, 22, 14)); T.gable(R, at(0, 2, 14), 36, 24, 8, yaw)
        bx(R, 0, -11, 5.5, (18, 5, 0.7))
        for dx in (-7, -2.4, 2.4, 7):
            T.cyl('canopy', at(dx, -12.6, 2.9), 0.7, 5.2)
        bx(G, 0, -9.2, 8, (24, 0.6, 5))
    elif kind == 'works':
        bx(W, 0, 2, 5.5, (42, 24, 11))
        for i in range(4):
            T.gable(R, at(-15.75 + i * 10.5, 2, 11), 24, 10.5, 5, yaw + math.pi / 2)
        T.cyl(W, at(17, 11, 13), 1.7, 26); T.cyl(R, at(17, 11, 25.5), 2.0, 1.6)
    elif kind == 'site':
        scaffold(bx, 26, 18, 3)
    elif kind == 'museum':
        bx(W, 0, 3, 7.5, (44, 24, 15)); bx(R, 0, 3, 15.4, (45, 25, 0.9))
        T.ico(R, at(0, 3, 15.5), 10.5, 0.95, sub=2)
        bx('pave', 0, -12, 1.2, (22, 6, 2.4))
        for dx in (-9, -5.4, -1.8, 1.8, 5.4, 9):
            T.cyl('canopy', at(dx, -10.4, 7.5), 0.8, 12)
        bx(W, 0, -10.4, 14, (22, 3, 2))
    elif kind == 'bar':
        bx(W, 0, 2, 5.5, (26, 18, 11)); bx(R, 0, 2, 11.3, (27, 19, 0.7))
        bx(R, -10, -7.6, 12, (1.4, 2.6, 16)); bx(R, 3, -8.6, 4.2, (14, 3.2, 0.6)); bx(G, 3, -7.2, 2.4, (12, 0.5, 3.2))
    elif kind == 'toyshop':
        bx(W, 0, 2, 4.5, (22, 18, 9)); T.gable(R, at(0, 2, 9), 25, 21, 10, yaw)
        bx(G, 0, -7.2, 3.6, (14, 0.5, 5))
    elif kind == 'party':
        bx(W, -3, 2, 5.5, (22, 18, 11)); T.gable(R, at(-3, 2, 11), 24, 20, 7, yaw)
        T.cyl(W, at(11, -4, 9), 5, 18); T.cyl(R, at(11, -4, 22.5), 6.2, 9, r2=0.0)
    elif kind == 'pharmacy':
        bx(W, 0, 2, 5, (22, 16, 10)); bx(R, 0, 2, 10.3, (23, 17, 0.7))
        bx(R, 0, 2, 15, (8.5, 2.2, 2.8)); bx(R, 0, 2, 15, (2.8, 2.2, 8.5)); bx(G, 0, -6.2, 3.6, (14, 0.5, 5))
    elif kind == 'hall':
        bx(W, 0, 3, 5, (40, 24, 10)); T.vault(R, at(0, 3, 10), 40, 24, 7.5, yaw); bx(G, 0, -9.2, 4.5, (26, 0.5, 6))
    wyaw = math.atan2(face[1], face[0]) - math.pi / 2
    M = Matrix.Translation((p[0], p[1], hgt(p[0], p[1]))) @ Matrix.Rotation(wyaw, 4, 'Z') @ Matrix.Diagonal((S, S, S, 1))
    for mat, tb in T.bms.items():
        bmesh.ops.transform(tb, matrix=M, verts=tb.verts)
        tmp = bpy.data.meshes.new('tmp')
        tb.to_mesh(tmp)
        B.bm(mat).from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        tb.free()
    occupied.append((p[0], p[1], (40 if kind != 'harbour' else 62) * S * 0.9))


# ---- terrain, sea
def make_terrain():
    nx, ny = 230, 150
    x0, x1, y0, y1 = -RX * 1.16, RX * 1.16, -RY * 1.2, RY * 1.2
    bm = bmesh.new()
    col = bm.loops.layers.color.new('Col')
    V = [[bm.verts.new((x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny, 0)) for i in range(nx + 1)] for j in range(ny + 1)]
    for row in V:
        for v in row:
            v.co.z = hgt(v.co.x, v.co.y)
    model = LOOK == 'model'
    grass, grass2 = ((0.76, 0.77, 0.71), (0.66, 0.72, 0.60)) if model else ((0.36, 0.60, 0.20), (0.24, 0.48, 0.16))
    sand = (0.82, 0.79, 0.72) if model else (0.88, 0.78, 0.56)
    for j in range(ny):
        for i in range(nx):
            f = bm.faces.new([V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]])
            f.smooth = True
            for lp in f.loops:
                x, y, z = lp.vert.co
                e = e_of(x, y)
                t = smooth(0.90, 0.965, e)
                h = min(1.0, hill(x, y) / 26.0)
                g = [grass[k] * (1 - h) + grass2[k] * h for k in range(3)]
                c = [g[k] * (1 - t) + sand[k] * t for k in range(3)]
                lp[col] = (*c, 1)
    me = bpy.data.meshes.new('terrain')
    bm.to_mesh(me)
    ob = bpy.data.objects.new('terrain', me)
    sc.collection.objects.link(ob)
    m = bpy.data.materials.new('terrain')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get('Principled BSDF')
    at = nt.nodes.new('ShaderNodeAttribute')
    at.attribute_name = 'Col'
    nt.links.new(at.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.95
    me.materials.append(m)


def coast_ring(mat, k, z):
    bm = B.bm(mat)
    vs = []
    for i in range(160):
        th = 2 * math.pi * i / 160
        r = coast_k(th) * k
        vs.append(bm.verts.new((RX * r * math.cos(th), RY * r * math.sin(th), z)))
    bm.faces.new(vs)


make_terrain()
B.box('sea', (0, 0, -0.05), (40000, 40000, 0.1))
coast_ring('shallow', 1.085, 0.02)
coast_ring('foam', 1.022, 0.05)

# ---- metro loop
ring = [LP(a) for a in range(0, 360, 2)]
B.strip('deck', [(x, y, DECK - 1.5, DECK) for x, y in ring], 7.0, closed=True)
B.strip('line', [(x, y, DECK, DECK + 0.22) for x, y in ring], 2.6, closed=True)
B.strip('line', [(x, y, DECK - 1.0, DECK - 0.35) for x, y in ring], 7.3, closed=True)
for a in range(0, 360, 8):
    x, y = LP(a + 4)
    g = hgt(x, y)
    B.cyl('deck', (x, y, (g + DECK - 1.5) / 2), 1.1, DECK - 1.5 - g + 0.4, seg=10)


def station(a, big=False):
    x, y = LP(a)
    t = tan_dir(a)
    yaw = math.atan2(t[1], t[0])
    L, Wd = (58, 15) if big else (34, 11)
    B.box('pave', (x, y, DECK + 0.25), (L, Wd, 0.5), yaw)
    B.box('canopy', (x, y, DECK + 6.2), (L - 4, Wd + 1.5, 0.6), yaw)
    for s in (-1, 1):
        for u in (-1, 1):
            px, py = x + t[0] * s * (L / 2 - 4) - t[1] * u * (Wd / 2 - 0.6), y + t[1] * s * (L / 2 - 4) + t[0] * u * (Wd / 2 - 0.6)
            B.cyl('canopy', (px, py, DECK + 3.2), 0.35, 6, seg=8)
    if big:
        g = hgt(x, y)
        B.box('station', (x, y, (g + DECK) / 2), (L - 8, Wd + 8, DECK - g), yaw)
        B.box('line', (x, y, DECK + 6.9), (L - 20, 3, 0.8), yaw)
    occupied.append((x, y, 26 if not big else 40))


station(90, big=True)
for i, (name, dist, lvl, kind) in enumerate(STOPS):
    a = stop_angle(i)
    station(a)
    p = LP(a)
    L = math.hypot(*p)
    inw = (-p[0] / L, -p[1] / L)
    if kind == 'harbour':
        face, off = (-inw[0], -inw[1]), 34
    else:
        face, off = inw, 58
    building(kind, dist, (p[0] + face[0] * off, p[1] + face[1] * off), face)

# empty plots for what comes next, in the gap before the main station
for a in (stop_angle(len(STOPS)) + 4, stop_angle(len(STOPS)) + 22):
    p = LP(a)
    L = math.hypot(*p)
    inw = (-p[0] / L, -p[1] / L)
    building('lot', 'software', (p[0] + inw[0] * 46, p[1] + inw[1] * 46), inw)

# train: four cars just after the main station
for k in range(4):
    a = 99 + k * 3.0
    x, y = LP(a)
    t = tan_dir(a)
    yaw = math.atan2(t[1], t[0])
    B.box('train', (x, y, DECK + 0.25 + 1.75), (14.5, 2.9, 3.1), yaw)
    B.box('line', (x, y, DECK + 0.25 + 1.2), (14.6, 3.0, 0.5), yaw)
    B.box('glass', (x, y, DECK + 0.25 + 2.3), (12.5, 3.02, 0.9), yaw)

# ---- tower on the hill, and the hill tram
tz = hgt(0, 6)
B.cyl('pave', (0, 6, tz - 5), 27, 11.0, seg=40)
bm = B.bm('tower')
rings = []
N, SEG = 46, 36
for i in range(N + 1):
    t = i / N
    r = 1.6 + 19.0 * (1 - t) ** 2.3
    row = []
    for s in range(SEG):
        ph = 2 * math.pi * s / SEG
        rr = r * (1 + 0.20 * math.cos(3 * ph) * (1 - t) ** 0.6)
        row.append(bm.verts.new((rr * math.cos(ph), 6 + rr * math.sin(ph), tz + 0.5 + TOWER_H * t)))
    rings.append(row)
for i in range(N):
    for s in range(SEG):
        f = bm.faces.new([rings[i][s], rings[i][(s + 1) % SEG], rings[i + 1][(s + 1) % SEG], rings[i + 1][s]])
        f.smooth = True
bm.faces.new(rings[-1])
B.cyl('tower', (0, 6, tz + TOWER_H + 14), 0.7, 30, r2=0.1, seg=8)
for t in (0.18, 0.36, 0.54, 0.72):
    r = 1.6 + 19.0 * (1 - t) ** 2.3
    B.cyl('tower_band', (0, 6, tz + 0.5 + TOWER_H * t), r * 1.24, 1.6, seg=36)
occupied.append((0, 6, 44))

tram = []
for i in range(41):
    y = -LY + 12 + (LY - 12 - 44) * i / 40
    g = hgt(0, y)
    tram.append((0, y, g + 0.2, g + 1.0))
B.strip('deck', tram, 4.2)
B.strip('line', [(x, y, zt, zt + 0.18) for x, y, zb, zt in tram], 1.4)
ty = -LY * 0.5
B.box('line', (0, ty, hgt(0, ty) + 2.7), (3.0, 9, 3.2))
B.box('glass', (0, ty, hgt(0, ty) + 3.3), (3.05, 7.5, 1.0))

# ---- roads and cars
def ring_pt(a, off):
    """A point `off` metres inside the metro loop (negative = towards the sea)."""
    x, y = LP(a)
    t = tan_dir(a)
    n = (-t[1], t[0])
    if n[0] * -x + n[1] * -y < 0:
        n = (t[1], -t[0])
    return (x + n[0] * off, y + n[1] * off)


def road(pts, width=7.5, lift=0.35, closed=False):
    B.strip('road', [(x, y, hgt(x, y) - 0.8, hgt(x, y) + lift) for x, y in pts], width, closed=closed)
    for x, y in pts:
        occupied.append((x, y, width * 0.75))


ROAD_OFF = -21.0          # the ring road runs on the sea side of the metro, like a coast road
road([ring_pt(a, ROAD_OFF) for a in range(0, 360, 2)], width=9.0, closed=True)
for i, (name, dist, lvl, kind) in enumerate(STOPS):
    a = stop_angle(i)
    far = -40 if kind == 'harbour' else 44
    road([ring_pt(a, ROAD_OFF + (far - ROAD_OFF) * k / 4) for k in range(5)], width=6.0)
road([ring_pt(90, ROAD_OFF + 4 * k) for k in range(4)], width=18.0)
hill_road = [ring_pt(0, ROAD_OFF)]
for k in range(71):
    u = k / 70
    ph = math.radians(300 * u)
    rho = 2.0 - 1.52 * u
    hill_road.append((120 * rho * math.cos(ph), 6 + 62 * rho * math.sin(ph)))
road(hill_road, width=6.5, lift=1.3)

CARS = ['car_a', 'car_b', 'car_c', 'car_d', 'car_e']
for k in range(44):
    a = rng.uniform(0, 360)
    lane = rng.choice((-2.2, 2.2))
    x, y = ring_pt(a, ROAD_OFF + lane)
    t = tan_dir(a)
    big = rng.random() < 0.12
    sz = (11, 3.2, 3.6) if big else (6.6, 2.9, 2.2)
    B.box('line' if big else rng.choice(CARS), (x, y, hgt(x, y) + 0.35 + sz[2] / 2), sz, math.atan2(t[1], t[0]))
for k in (9, 21, 30, 44, 58):
    (x0, y0), (x1, y1) = hill_road[k], hill_road[k + 1]
    B.box(rng.choice(CARS), (x0, y0, hgt(x0, y0) + 1.3 + 1.1), (6.6, 2.9, 2.2), math.atan2(y1 - y0, x1 - x0))

# ---- small houses near each town, then trees
houses = 0
for i in range(len(STOPS) + 1):
    a = 90 if i == len(STOPS) else stop_angle(i)
    for _ in range(26):
        if houses >= 52:
            break
        aa = a + rng.uniform(-STEP * 0.48, STEP * 0.48)
        p = LP(aa)
        L = math.hypot(*p)
        side = rng.choice((-1, 1, 1))
        d = rng.uniform(16, 44) if side > 0 else rng.uniform(88, 120)
        x, y = p[0] + p[0] / L * d * side, p[1] + p[1] / L * d * side
        if e_of(x, y) > 0.93 or any(math.hypot(x - ox, y - oy) < r + 9 for ox, oy, r in occupied) or abs(x) < 9:
            continue
        if hill(x, y) > 9:
            continue
        g = hgt(x, y)
        yaw = math.atan2(p[1], p[0]) + rng.choice((0, math.pi / 2))
        w, dp, h = rng.uniform(8, 11), rng.uniform(6.5, 8), rng.uniform(4.2, 6)
        B.box('house_wall', (x, y, g + h / 2), (w, dp, h), yaw)
        B.gable('house_roof', (x, y, g + h), w + 1, dp + 1, 3.2, yaw)
        occupied.append((x, y, 8))
        houses += 1

trees = 0
tries = 0
while trees < 430 and tries < 20000:
    tries += 1
    x, y = rng.uniform(-RX, RX), rng.uniform(-RY, RY)
    e = e_of(x, y)
    if e > 0.91:
        continue
    if abs(math.hypot(x / LX, y / LY) - 1) * min(LX, LY) < 11:
        continue
    if abs(x) < 7 and -LY < y < 0:
        continue
    if any(math.hypot(x - ox, y - oy) < r for ox, oy, r in occupied):
        continue
    dens = 0.22 + 0.78 * min(1.0, hill(x, y) / 12.0)
    if rng.random() > dens:
        continue
    g = hgt(x, y)
    r = rng.uniform(3.0, 5.4)
    th = rng.uniform(3.5, 5.5)
    B.cyl('trunk', (x, y, g + th / 2), 0.45, th, seg=6)
    B.ico('tree' if rng.random() < 0.6 else 'tree2', (x, y, g + th + r * 0.75), r, rng.uniform(1.0, 1.3))
    trees += 1

# ---- materials
FILM = {
    'sea': ((0.012, 0.15, 0.22), 0.10, 0.0), 'shallow': ((0.04, 0.42, 0.47), 0.12, 0.0), 'foam': ((0.50, 0.80, 0.76), 0.3, 0.0),
    'pave': ((0.82, 0.76, 0.66), 0.9, 0.0), 'deck': ((0.80, 0.78, 0.74), 0.8, 0.0), 'line': ((0.84, 0.10, 0.07), 0.5, 0.0),
    'canopy': ((0.96, 0.96, 0.94), 0.5, 0.0), 'station': ((0.90, 0.88, 0.84), 0.7, 0.0), 'train': ((0.96, 0.96, 0.95), 0.35, 0.0),
    'glass': ((0.22, 0.44, 0.56), 0.08, 0.7), 'tree': ((0.17, 0.42, 0.13), 0.9, 0.0), 'tree2': ((0.29, 0.54, 0.16), 0.9, 0.0),
    'trunk': ((0.28, 0.19, 0.12), 0.9, 0.0), 'house_wall': ((0.95, 0.91, 0.82), 0.9, 0.0), 'house_roof': ((0.72, 0.30, 0.18), 0.8, 0.0),
    'tower': ((0.95, 0.90, 0.80), 0.28, 0.35), 'tower_band': ((0.84, 0.10, 0.07), 0.5, 0.0),
    'scaffold': ((0.60, 0.60, 0.60), 0.7, 0.0), 'crane': ((0.96, 0.70, 0.08), 0.6, 0.0), 'lot': ((0.74, 0.64, 0.46), 0.95, 0.0),
    'road': ((0.19, 0.20, 0.22), 0.9, 0.0), 'car_a': ((0.95, 0.95, 0.95), 0.4, 0.0), 'car_b': ((0.80, 0.12, 0.10), 0.4, 0.0),
    'car_c': ((0.12, 0.30, 0.70), 0.4, 0.0), 'car_d': ((0.95, 0.74, 0.10), 0.4, 0.0), 'car_e': ((0.12, 0.13, 0.15), 0.4, 0.0),
    'fence': ((0.93, 0.93, 0.92), 0.8, 0.0), 'court_a': ((0.78, 0.30, 0.22), 0.8, 0.0), 'court_b': ((0.16, 0.42, 0.66), 0.8, 0.0),
}
WHITE = (0.80, 0.785, 0.75)


def spec(name):
    if ':' in name:
        dist, part = name.split(':')
        c = DISTRICTS[dist]
        if LOOK == 'model':
            k = {'wall': 1.0, 'roof': 0.80, 'glass': 0.62}[part]
            return (tuple(v * k for v in c), 0.85, 0.0)
        if part == 'wall':
            return (WALLS[dist], 0.85, 0.0)
        if part == 'roof':
            return (c, 0.6, 0.0)
        return FILM['glass']
    if LOOK == 'model':
        if name in ('sea', 'shallow', 'foam', 'line', 'crane'):
            return FILM[name]
        if name in ('tower', 'tower_band'):
            return ((0.80, 0.11, 0.08) if name == 'tower' else (0.60, 0.07, 0.05), 0.6, 0.0)
        if name in ('court_a', 'court_b'):
            return (tuple(v * 0.85 for v in DISTRICTS['software']), 0.85, 0.0)
        if name == 'road':
            return ((0.58, 0.57, 0.55), 0.9, 0.0)
        return (WHITE, 0.9, 0.0)
    return FILM[name]


for name, bm in B.bms.items():
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    col, rough, metal = spec(name)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    me.materials.append(m)

# ---- light, camera, render
w = bpy.data.worlds.new('w')
w.use_nodes = True
sc.world = w
bg = w.node_tree.nodes.get('Background')
film = LOOK == 'film'
bg.inputs[0].default_value = (0.50, 0.62, 0.92, 1) if film else (0.86, 0.92, 1.0, 1)
bg.inputs[1].default_value = 0.42 if film else 0.5
sun = bpy.data.lights.new('sun', 'SUN')
sun.energy = 6.2 if film else 2.7
sun.color = (1.0, 0.74, 0.46) if film else (1.0, 0.97, 0.92)
sun.angle = math.radians(2.5 if film else 6)
so = bpy.data.objects.new('sun', sun)
el, az = (19, 248) if film else (46, 225)          # where the sun is: elevation, compass bearing
sdir = Vector((math.sin(math.radians(az)) * math.cos(math.radians(el)), math.cos(math.radians(az)) * math.cos(math.radians(el)), math.sin(math.radians(el))))
so.rotation_euler = (-sdir).to_track_quat('-Z', 'Y').to_euler()
sc.collection.objects.link(so)

cam = bpy.data.cameras.new('cam')
cam.lens = 50
cam.clip_start, cam.clip_end = 5, 60000
co = bpy.data.objects.new('cam', cam)
sc.collection.objects.link(co)
target = Vector((0, 0, 40))
ce, ca = math.radians(CAM_EL), math.radians(CAM_AZ)
d = 1230
co.location = target + Vector((-math.sin(ca) * math.cos(ce), -math.cos(ca) * math.cos(ce), math.sin(ce))) * d
co.rotation_euler = (target - co.location).to_track_quat('-Z', 'Y').to_euler()
sc.camera = co

sc.render.engine = 'BLENDER_EEVEE'
for k, v in (('taa_render_samples', 64), ('use_shadows', True), ('use_raytracing', True), ('use_gtao', True)):
    try:
        setattr(sc.eevee, k, v)
    except Exception as ex:
        print('eevee setting skipped:', k, ex)
try:
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'Medium High Contrast'
except Exception as ex:
    print('view transform fallback:', ex)
sc.view_settings.exposure = 0.0
sc.render.resolution_x, sc.render.resolution_y = 2000, 1125
sc.render.image_settings.file_format = 'PNG'
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('wrote', OUT, 'houses', houses, 'trees', trees)
