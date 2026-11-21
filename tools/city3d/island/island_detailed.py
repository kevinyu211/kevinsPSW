"""The whole island with the real models, in two looks. Same layout and camera as ../island_blockout.py.
   blender -b --factory-startup --python island_detailed.py -- film|model out.png [el] [az] [dist]
   The models are read back from the exported raw GLBs in out/, so this also proves they load.
   Terrain, sea, roads and the track deck are plain shapes drawn here (the site draws its own).
"""
import sys, os, math, random, json
import bpy, bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, 'out')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
LOOK = args[0] if args else 'film'
OUT = args[1] if len(args) > 1 else os.path.join(HERE, 'previews', 'island-' + LOOK + '.png')
CAM_EL = float(args[2]) if len(args) > 2 else 30.0
CAM_AZ = float(args[3]) if len(args) > 3 else 8.0
CAM_D = float(args[4]) if len(args) > 4 else 1230.0
CAM_T = [float(v) for v in args[5].split(',')] if len(args) > 5 else [0, 0, 40]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
rng = random.Random(7)

RX, RY = 380.0, 235.0        # island half-sizes, metres
LX, LY = 300.0, 170.0        # metro loop half-sizes
DECK = 3.2 + 10.0            # the models put the deck top 10 m above the station's own ground
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



# the same order and levels as the rough model: (project id, district, level, site model)
STOPS = [
    ('hirvo', 'software', 4, 'site_large'), ('trade', 'software', 4, 'site_large'), ('court', 'software', 3, 'site_large'),
    ('uhome', 'software', 3, 'site_large'), ('pindou', 'software', 1, 'site_small'),
    ('books', 'books', 4, 'site_small'), ('bookflow', 'books', 4, 'site_large'), ('ipad', 'books', 2, 'site_small'),
    ('yae', 'film', 4, 'site_large'), ('noir', 'film', 4, 'site_small'), ('influencers', 'film', 2, 'site_small'),
    ('stickers', 'games', 3, 'site_small'), ('party', 'games', 3, 'site_small'),
    ('duiyao', 'health', 3, 'site_small'), ('hackathons', 'health', 3, 'site_large'),
]
STEP = 360.0 / (len(STOPS) + 2.5)

B = Builder()
occupied = []          # (x, y, r) circles that trees and houses must avoid

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


# ---- the models, read back from the exported GLBs
def load(fname):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT_DIR, fname))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        o.hide_render = True
    return {o.name: o for o in new if o.parent is None}


LIB = {}
LIB.update(load('buildings.raw.glb'))
LIB.update(load('props.raw.glb'))
for m_ in bpy.data.materials:
    m_.use_backface_culling = True
placed = {}


def put(name, x, y, z, yaw=0.0, s=1.0):
    src = LIB[name]
    o = src.copy()
    o.hide_render = False
    o.location = (x, y, z)
    o.rotation_mode = 'XYZ'
    o.rotation_euler = (0, 0, yaw)
    o.scale = (s, s, s)
    sc.collection.objects.link(o)
    for c in src.children:
        cc = c.copy()
        cc.hide_render = False
        cc.parent = o
        sc.collection.objects.link(cc)
        if c.name.endswith('_jib'):
            cc.rotation_mode = 'XYZ'
            cc.rotation_euler = (0, 0, rng.uniform(0, 6.28))
    placed[name] = placed.get(name, 0) + 1
    return o


def inward(p):
    L = math.hypot(*p)
    return (-p[0] / L, -p[1] / L)


def face_yaw(face):
    """Yaw that turns a model so its back (+y) points along `face` and its front faces the other way."""
    return math.atan2(face[1], face[0]) - math.pi / 2


# ---- metro loop: deck, red line, piers (plain shapes; the site draws its own)
ring = [LP(a) for a in range(0, 360, 2)]
B.strip('deck', [(x, y, DECK - 1.5, DECK) for x, y in ring], 7.0, closed=True)
B.strip('line', [(x, y, DECK, DECK + 0.22) for x, y in ring], 2.6, closed=True)
B.strip('line', [(x, y, DECK - 1.0, DECK - 0.35) for x, y in ring], 7.3, closed=True)
for a in range(0, 360, 8):
    x, y = LP(a + 4)
    g = hgt(x, y)
    B.cyl('deck', (x, y, (g + DECK - 1.5) / 2), 1.1, DECK - 1.5 - g + 0.4, seg=10)


def station(a, name, front):
    x, y = LP(a)
    t = tan_dir(a)
    yaw = math.atan2(t[1], t[0])
    f = (math.sin(yaw), -math.cos(yaw))             # where the model's front would point
    if f[0] * front[0] + f[1] * front[1] < 0:
        yaw += math.pi
    put(name, x, y, DECK - 10.0, yaw)
    occupied.append((x, y, 30 if name == 'station' else 46))


p90 = LP(90)
station(90, 'station_main', (-inward(p90)[0], -inward(p90)[1]))
for i, (pid, dist, lvl, site_model) in enumerate(STOPS):
    a = stop_angle(i)
    p = LP(a)
    inw = inward(p)
    sea = pid == 'trade'
    face, off = ((-inw[0], -inw[1]), 34) if sea else (inw, 58)
    station(a, 'station', face)
    bx, by = p[0] + face[0] * off, p[1] + face[1] * off
    name = 'lot' if lvl == 1 else (site_model if lvl == 2 else f'b_{pid}_L{lvl}')
    put(name, bx, by, hgt(bx, by), face_yaw(face))
    occupied.append((bx, by, 62 if sea else 40))

for a in (stop_angle(len(STOPS)) + 4, stop_angle(len(STOPS)) + 22):
    p = LP(a)
    inw = inward(p)
    bx, by = p[0] + inw[0] * 46, p[1] + inw[1] * 46
    put('lot', bx, by, hgt(bx, by), face_yaw(inw))
    occupied.append((bx, by, 26))

# train: four cars just after the main station
for k in range(4):
    a = 99 + k * 3.0
    x, y = LP(a)
    t = tan_dir(a)
    yaw = math.atan2(t[1], t[0])
    put('train_end' if k in (0, 3) else 'train_mid', x, y, DECK + 0.22, yaw + (math.pi if k == 0 else 0.0))

# ---- tower on the hill, and the hill tram
put('tower', 0, 6, hgt(0, 6), 0.0)
occupied.append((0, 6, 44))
tram = []
for i in range(41):
    y = -LY + 30 + (LY - 30 - 44) * i / 40
    g = hgt(0, y)
    tram.append((0, y, g + 0.2, g + 1.0))
B.strip('deck', tram, 4.2)
B.strip('line', [(x, y, zt, zt + 0.18) for x, y, zb, zt in tram], 1.4)
ty = -LY * 0.5
put('tram', 0, ty, hgt(0, ty) + 1.18, math.pi / 2)


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


ROAD_OFF = -21.0
road([ring_pt(a, ROAD_OFF) for a in range(0, 360, 2)], width=9.0, closed=True)
for i, (pid, dist, lvl, sm) in enumerate(STOPS):
    a = stop_angle(i)
    far = -30 if pid == 'trade' else 30
    road([ring_pt(a + 3.0, ROAD_OFF + (far - ROAD_OFF) * k / 4) for k in range(5)], width=6.0)
hill_road = [ring_pt(0, ROAD_OFF)]
for k in range(71):
    u = k / 70
    ph = math.radians(300 * u)
    rho = 2.0 - 1.52 * u
    hill_road.append((120 * rho * math.cos(ph), 6 + 62 * rho * math.sin(ph)))
road(hill_road, width=6.5, lift=1.3)

CARS = ['car_a', 'car_b', 'car_c']
for k in range(44):
    a = rng.uniform(0, 360)
    lane = rng.choice((-2.2, 2.2))
    x, y = ring_pt(a, ROAD_OFF + lane)
    t = tan_dir(a)
    name = 'bus' if rng.random() < 0.12 else rng.choice(CARS)
    put(name, x, y, hgt(x, y) + 0.35, math.atan2(t[1], t[0]) + (math.pi if lane > 0 else 0))
for k in (9, 21, 30, 44, 58):
    (x0, y0), (x1, y1) = hill_road[k], hill_road[k + 1]
    put(rng.choice(CARS), x0, y0, hgt(x0, y0) + 1.3, math.atan2(y1 - y0, x1 - x0))
for a in range(0, 360, 12):
    x, y = ring_pt(a + 2, ROAD_OFF - 6.0)
    if e_of(x, y) < 0.95:
        ix, iy = inward((x, y))
        put('streetlamp', x, y, hgt(x, y), face_yaw((-ix, -iy)))

# ---- houses near each town, then trees
HOUSES = ['house_a', 'house_b', 'house_c', 'house_d']
houses = 0
for i in range(len(STOPS) + 1):
    a = 90 if i == len(STOPS) else stop_angle(i)
    for _ in range(26):
        if houses >= 44:
            break
        aa = a + rng.uniform(-STEP * 0.48, STEP * 0.48)
        p = LP(aa)
        L = math.hypot(*p)
        side = rng.choice((-1, 1, 1))
        d = rng.uniform(34, 50) if side > 0 else rng.uniform(96, 124)
        x, y = p[0] + p[0] / L * d * side, p[1] + p[1] / L * d * side
        if e_of(x, y) > 0.925 or any(math.hypot(x - ox, y - oy) < r + 10 for ox, oy, r in occupied) or abs(x) < 12:
            continue
        if hill(x, y) > 9:
            continue
        inw = inward((x, y))
        face = inw if side > 0 else (-inw[0], -inw[1])
        put(rng.choice(HOUSES), x, y, hgt(x, y), face_yaw(face) + rng.uniform(-0.2, 0.2))
        occupied.append((x, y, 9))
        houses += 1

trees = 0
tries = 0
while trees < 430 and tries < 20000:
    tries += 1
    x, y = rng.uniform(-RX, RX), rng.uniform(-RY, RY)
    e = e_of(x, y)
    if e > 0.91:
        continue
    if abs(math.hypot(x / LX, y / LY) - 1) * min(LX, LY) < 13:
        continue
    if abs(x) < 7 and -LY < y < 0:
        continue
    if any(math.hypot(x - ox, y - oy) < r for ox, oy, r in occupied):
        continue
    dens = 0.22 + 0.78 * min(1.0, hill(x, y) / 12.0)
    if rng.random() > dens:
        continue
    put(rng.choice(('tree_a', 'tree_a', 'tree_b', 'tree_c', 'tree_pine')), x, y, hgt(x, y), rng.uniform(0, 6.28), rng.uniform(0.8, 1.15))
    trees += 1

# ---- island life: lighthouse, beach, boats, animals
def coast_pt(angle, edge):
    """angle as in city-data.js (90 = the front), edge 1 = the shoreline."""
    th = -math.radians(angle)
    r = coast_k(th) * edge
    return (RX * r * math.cos(th), RY * r * math.sin(th))


lx, ly = coast_pt(20, 0.955)
put('lighthouse', lx, ly, hgt(lx, ly) + 0.6, face_yaw(inward((lx, ly))) + math.pi)
for k in range(14):
    a = 40 + 38 * (k + rng.uniform(0.2, 0.8)) / 14
    x, y = coast_pt(a, rng.uniform(0.955, 0.985))
    put('umbrella', x, y, hgt(x, y), rng.uniform(0, 6.28), 1.5)
    put('sunbed', x + 2.6, y + rng.uniform(-1, 1), hgt(x + 2.6, y) + 0.1, face_yaw(inward((x, y))) + math.pi / 2, 1.6)
for a in range(38, 82, 6):
    x, y = coast_pt(a + 1.5, 0.925)
    put('palm', x, y, hgt(x, y), rng.uniform(0, 6.28), rng.uniform(1.0, 1.3))
for name, a, e_, yaw in (('ferry', 84, 1.2, 0.2), ('boat_sail', 60, 1.28, 0.8), ('boat_sail', 118, 1.3, 2.6), ('boat_sail', 200, 1.22, 1.2),
                         ('boat_sail', 300, 1.25, 4.0), ('boat_sail', 345, 1.33, 5.1), ('boat_fishing', 150, 1.2, 3.4), ('boat_fishing', 30, 1.22, 0.3),
                         ('boat_fishing', 250, 1.2, 2.0)):
    x, y = coast_pt(a, e_)
    put(name, x, y, 0.0, yaw, 1.0)
for a, e_ in ((74, 1.27), (76, 1.3), (108, 1.24)):
    x, y = coast_pt(a, e_)
    put('dolphin', x, y, 0.2, rng.uniform(0, 6.28), 1.6)
for k in range(14):
    base = coast_pt(rng.choice((20, 20, 131, 131, 84, 60, 200, 300)), rng.uniform(0.95, 1.2))
    put('gull', base[0] + rng.uniform(-30, 30), base[1] + rng.uniform(-30, 30), rng.uniform(18, 46), rng.uniform(0, 6.28), 2.2)
n_sheep = 0
while n_sheep < 9:
    x, y = rng.uniform(60, 200), rng.uniform(-110, -30)
    if any(math.hypot(x - ox, y - oy) < r + 2 for ox, oy, r in occupied) or hill(x, y) > 14:
        continue
    put('sheep', x, y, hgt(x, y), rng.uniform(0, 6.28), 1.8)
    n_sheep += 1
n_deer = 0
while n_deer < 4:
    x, y = rng.uniform(-150, -40), rng.uniform(20, 70)
    if any(math.hypot(x - ox, y - oy) < r + 2 for ox, oy, r in occupied):
        continue
    put('deer', x, y, hgt(x, y), rng.uniform(0, 6.28), 1.8)
    n_deer += 1
for a, e_ in ((50, 0.94), (66, 0.95), (100, 0.9)):
    x, y = coast_pt(a, e_)
    put('dog', x, y, hgt(x, y), rng.uniform(0, 6.28), 1.8)

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


# the white model look: repaint the imported models. Project buildings keep one strong colour each,
# the tower and the trains keep the line red; everything else is matte white.
if LOOK == 'model':
    def flat(name, col, rough=0.9):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes.get('Principled BSDF')
        b.inputs['Base Color'].default_value = (*col, 1)
        b.inputs['Roughness'].default_value = rough
        return m
    white = flat('m_white', WHITE)
    reds = flat('m_line', (0.80, 0.11, 0.08), 0.6)
    dmat = {d: [flat(f'm_{d}_{k}', tuple(v * f for v in c), 0.85) for k, f in enumerate((1.0, 0.62, 0.8))] for d, c in DISTRICTS.items()}
    dist_of = {pid: d for pid, d, _, _ in STOPS}
    for o in bpy.data.objects:
        if o.type != 'MESH' or not o.data.materials:
            continue
        root = o
        while root.parent is not None:
            root = root.parent
        nm = root.name.split('.')[0]
        names = [m.name.split('.')[0] if m else '' for m in o.data.materials]
        if not any(n in ('city', 'glass', 'glow') for n in names):
            continue
        for i, n in enumerate(names):
            if nm.startswith('b_'):
                d = dist_of[nm.split('_')[1]]
                o.data.materials[i] = dmat[d][{'city': 0, 'glass': 1, 'glow': 2}.get(n, 0)]
            elif nm in ('tower', 'train_end', 'train_mid', 'tram'):
                o.data.materials[i] = reds
            else:
                o.data.materials[i] = white

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
target = Vector(CAM_T)
ce, ca = math.radians(CAM_EL), math.radians(CAM_AZ)
d = CAM_D
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
print('wrote', OUT, 'houses', houses, 'trees', trees, 'placed', json.dumps(placed, sort_keys=True))
