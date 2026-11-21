"""Proof renders from the exported GLBs (so the round trip is tested too).
   blender -b --factory-startup --python preview.py -- <which> [names...]
   which: kit | props | landmarks | one | skyline
"""
import sys, os, math, json, random
HERE = os.path.dirname(os.path.abspath(__file__))
import bpy
from mathutils import Vector, Euler, Matrix
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['kit']
which, names = args[0], args[1:]
OUT = os.path.join(HERE, 'out')
PREV = os.path.join(HERE, 'previews')
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def load(fname):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, fname))
    new = [o for o in bpy.data.objects if o not in before]
    for m in bpy.data.materials:
        m.use_backface_culling = True
    return {o.name: o for o in new if o.parent is None}


def world(sun_el=24, sun_az=215, strength=4.0):
    w = bpy.data.worlds.new('w')
    sc.world = w
    bg = w.node_tree.nodes.get('Background') or w.node_tree.nodes.new('ShaderNodeBackground')
    bg.inputs[0].default_value = (0.62, 0.74, 0.90, 1)
    bg.inputs[1].default_value = 0.9
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = strength
    sun.color = (1.0, 0.86, 0.68)
    sun.angle = math.radians(3)
    so = bpy.data.objects.new('sun', sun)
    so.rotation_euler = Euler((math.radians(90 - sun_el), 0, math.radians(sun_az)))
    sc.collection.objects.link(so)
    sc.render.engine = 'BLENDER_EEVEE'
    try:
        sc.eevee.taa_render_samples = 32
        sc.eevee.use_shadows = True
    except Exception:
        pass
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'


def plane(size, col, z=0.0, name='ground', rough=0.9):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    ob = bpy.context.object
    ob.name = name
    m = bpy.data.materials.new(name)
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    ob.data.materials.append(m)
    return ob


def bbox(objs):
    pts = []
    for o in objs:
        for k in [o] + list(o.children_recursive):
            if k.type == 'MESH':
                pts += [k.matrix_world @ Vector(c) for c in k.bound_box]
    return pts


def ortho_cam(objs, el=32, az=40, res=(2400, 1500), margin=1.06):
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    co.rotation_euler = Euler((math.radians(90 - el), 0, math.radians(az)))
    bpy.context.view_layer.update()
    inv = co.rotation_euler.to_matrix().inverted()
    P = [inv @ p for p in bbox(objs)]
    xs, ys, zs = [p.x for p in P], [p.y for p in P], [p.z for p in P]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    cam.ortho_scale = max(w, h * res[0] / res[1]) * margin
    c = Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, max(zs) + 500))
    co.location = co.rotation_euler.to_matrix() @ c
    cam.clip_start, cam.clip_end = 1, 5000
    sc.camera = co
    sc.render.resolution_x, sc.render.resolution_y = res


def render(name):
    sc.render.filepath = os.path.join(PREV, name)
    bpy.ops.render.render(write_still=True)
    print('wrote', name)


def grid(objs, cell, cols):
    for i, o in enumerate(objs):
        o.location = ((i % cols) * cell, -(i // cols) * cell, 0)
    bpy.context.view_layer.update()


if which in ('kit', 'props'):
    world()
    k = load('kit.raw.glb')
    man = {r['name']: r for r in json.load(open(os.path.join(OUT, 'kit.json')))}
    props = [k[n] for n in man if man[n]['class'] == 'prop']
    blds = [k[n] for n in man if man[n]['class'] != 'prop']
    if which == 'kit':
        for o in props:
            o.hide_render = True
        tall = [o for o in blds if man[o.name]['class'] == 'tower']
        rest = [o for o in blds if man[o.name]['class'] != 'tower']
        for i, o in enumerate(tall):
            o.location = (i * 78, 120, 0)
        for i, o in enumerate(rest):
            o.location = ((i % 8) * 76 + 30, -(i // 8) * 72, 0)
        bpy.context.view_layer.update()
        g = plane(3000, (0.62, 0.62, 0.60))
        ortho_cam(blds, el=28, az=28, res=(3200, 2000))
        render('kit.png')
    else:
        for o in blds:
            o.hide_render = True
        grid(props, 36, 6)
        plane(600, (0.62, 0.62, 0.60), z=-0.01)
        ortho_cam(props, el=30, az=35, res=(2400, 1100))
        render('kit-props.png')
elif which == 'kitclose':
    world()
    k = load('kit.raw.glb')
    man = {r['name']: r for r in json.load(open(os.path.join(OUT, 'kit.json')))}
    want = names[0].split(',')
    objs = [k[n] for n in man if man[n]['class'] in want]
    for n, o in k.items():
        if o not in objs:
            o.hide_render = True
    grid(objs, float(names[1]) if len(names) > 1 else 64, 5)
    plane(4000, (0.36, 0.38, 0.40))
    ortho_cam(objs, el=30, az=30, res=(2400, 1500))
    render('kit-' + want[0] + '.png')
elif which in ('landmarks', 'one'):
    world()
    k = load('landmarks.raw.glb')
    objs = [k[n] for n in (names or sorted(k))]
    for n, o in k.items():
        if o not in objs:
            o.hide_render = True
            for c in o.children_recursive:
                c.hide_render = True
    if which == 'landmarks':
        big = [o for o in objs if o.name == 'k_tower']
        rest = [o for o in objs if o.name != 'k_tower']
        for i, o in enumerate(rest):
            o.location = ((i % 5) * 130, -(i // 5) * 120, 0)
        for o in big:
            o.location = (5 * 130 + 40, -160, 0)
        bpy.context.view_layer.update()
        plane(5000, (0.62, 0.62, 0.60))
        ortho_cam(objs, el=30, az=30, res=(3600, 2400))
        render('landmarks.png')
    else:
        plane(5000, (0.36, 0.38, 0.40))
        az = 30
        if len(objs) > 1:
            grid(objs, 100, 3)
        ortho_cam(objs, el=30, az=az, res=(2000, 1300) if len(objs) > 1 else (1300, 1700))
        render('one-' + '-'.join(n.replace('hq_', '') for n in (names[:3])) + '.png')
elif which == 'skyline':
    world(sun_el=20, sun_az=240, strength=3.6)
    k = load('kit.raw.glb')
    L = load('landmarks.raw.glb')
    man = {r['name']: r for r in json.load(open(os.path.join(OUT, 'kit.json')))}
    rng = random.Random(4)
    for o in list(k.values()) + list(L.values()):
        o.hide_render = True
        for c in o.children_recursive:
            c.hide_render = True

    def inst(src, x, y, rot=0.0):
        o = src.copy()
        o.hide_render = False
        o.location = (x, y, 0)
        o.rotation_euler = (0, 0, rot)
        sc.collection.objects.link(o)
        for c in src.children:
            cc = c.copy()
            cc.hide_render = False
            cc.parent = o
            sc.collection.objects.link(cc)
        return o
    by = lambda c: [n for n in man if man[n]['class'] == c]
    towers, mids, lows = by('tower'), by('midrise'), by('lowrise') + by('shop') + by('house') + by('civic')
    inst(L['k_tower'], 0, 260) if 'k_tower' in L else None
    n = 0
    for gx in range(-8, 9):
        for gy in range(0, 9):
            x, y = gx * 84, 60 + gy * 78
            if abs(x) < 80 and 200 < y < 330:
                continue
            dist = math.hypot(x, y - 260)
            r = rng.random()
            if gy == 0:
                pool = lows + mids
            elif dist < 300 and r < 0.75:
                pool = towers
            elif dist < 520 and r < 0.35:
                pool = towers
            else:
                pool = mids
            nm = rng.choice(pool)
            inst(k[nm], x + rng.uniform(-6, 6), y + rng.uniform(-6, 6), rng.choice((0, math.pi / 2, math.pi, -math.pi / 2)))
            n += 1
    for i in range(-5, 6):
        inst(k['pier_segment'], i * 110 + 30, -12) if i % 3 == 0 else None
        inst(k['tree_round'], i * 40, 22)
    inst(k['ferry'], -160, -90, 1.3)
    inst(k['boat_small'], 90, -60, 0.6)
    inst(k['ind_gantry'], 520, 40)
    inst(k['ind_containers'], 470, 90)
    print('instances', n)
    plane(6000, (0.34, 0.37, 0.36), z=0, name='land').location = (0, 3020, 0)
    plane(8000, (0.16, 0.34, 0.44), z=-1.2, name='sea', rough=0.25)
    cam = bpy.data.cameras.new('cam')
    cam.lens = 38
    co = bpy.data.objects.new('cam', cam)
    co.location = (-260, -760, 150)
    sc.collection.objects.link(co)
    tgt = Vector((0, 300, 130))
    co.rotation_euler = (tgt - co.location).to_track_quat('-Z', 'Y').to_euler()
    cam.clip_end = 8000
    sc.camera = co
    sc.render.resolution_x, sc.render.resolution_y = 2400, 1350
    render('skyline.png')
