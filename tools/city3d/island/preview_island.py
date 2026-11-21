"""Proof renders from the exported raw GLBs, in film-look light (so the round trip is tested too).
   blender -b --factory-startup --python preview_island.py -- sheet <glb> <out.png> <cols> <cell> name...
   blender -b --factory-startup --python preview_island.py -- close <glb> <out.png> name [az] [el] [fill]
   A name ending in * takes every model that starts with it.
"""
import sys, os, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
import bpy
from mathutils import Vector, Euler
args = sys.argv[sys.argv.index('--') + 1:]
mode, glb, outname = args[0], args[1], args[2]
rest = args[3:]
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
        if m.name.startswith('glow'):
            b = m.node_tree.nodes.get('Principled BSDF')
            if b:
                b.inputs['Roughness'].default_value = 0.3
    return {o.name: o for o in new if o.parent is None}


def world(sun_el=36, sun_az=140, strength=5.0):
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    sc.world = w
    bg = w.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (0.50, 0.62, 0.92, 1)
    bg.inputs[1].default_value = 0.55
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = strength
    sun.color = (1.0, 0.80, 0.56)
    sun.angle = math.radians(2.5)
    so = bpy.data.objects.new('sun', sun)
    el, az = math.radians(sun_el), math.radians(sun_az)
    sdir = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    so.rotation_euler = (-sdir).to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(so)
    sc.render.engine = 'BLENDER_EEVEE'
    for k, v in (('taa_render_samples', 48), ('use_shadows', True), ('use_raytracing', True), ('use_gtao', True)):
        try:
            setattr(sc.eevee, k, v)
        except Exception as ex:
            print('eevee setting skipped:', k, ex)
    try:
        sc.view_settings.view_transform = 'Standard'
        sc.view_settings.look = 'Medium High Contrast'
    except Exception as ex:
        print('view transform fallback:', ex)
    sc.render.image_settings.file_format = 'PNG'


def plane(size, col, z=0.0, name='ground', rough=0.95):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    ob = bpy.context.object
    ob.name = name
    m = bpy.data.materials.new(name)
    m.use_nodes = True
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


def ortho_cam(objs, el=28, az=32, res=(2400, 1500), margin=1.05):
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
    c = Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, max(zs) + 800))
    co.location = co.rotation_euler.to_matrix() @ c
    cam.clip_start, cam.clip_end = 1, 8000
    sc.camera = co
    sc.render.resolution_x, sc.render.resolution_y = res


def persp_cam(objs, az=28, el=12, fill=0.86, res=(1280, 900), lens=45):
    P = bbox(objs)
    mn = Vector((min(p.x for p in P), min(p.y for p in P), min(p.z for p in P)))
    mx = Vector((max(p.x for p in P), max(p.y for p in P), max(p.z for p in P)))
    c = (mn + mx) / 2
    c.z = max(mn.z, 0) + (mx.z - max(mn.z, 0)) * 0.45
    r = (mx - mn).length / 2
    cam = bpy.data.cameras.new('cam')
    cam.lens = lens
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    fov = 2 * math.atan(18 / lens)
    vfov = 2 * math.atan(math.tan(fov / 2) * res[1] / res[0])
    d = r / math.sin(min(fov, vfov) / 2) / fill
    a, e = math.radians(az), math.radians(el)
    co.location = c + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * d
    co.rotation_euler = (c - co.location).to_track_quat('-Z', 'Y').to_euler()
    cam.clip_start, cam.clip_end = 0.5, 8000
    sc.camera = co
    sc.render.resolution_x, sc.render.resolution_y = res


def pick(k, names):
    out = []
    for n in names:
        if n.endswith('*'):
            out += [k[x] for x in sorted(k) if x.startswith(n[:-1])]
        else:
            out.append(k[n])
    return out


def hide_others(k, objs):
    for n, o in k.items():
        if o not in objs:
            o.hide_render = True
            for c in o.children_recursive:
                c.hide_render = True


GRASS = (0.30, 0.52, 0.17)
world()
k = load(glb)
if mode == 'sheet':
    cols, cell = int(rest[0]), float(rest[1])
    objs = pick(k, rest[2:])
    hide_others(k, objs)
    ca, sa = math.cos(math.radians(32)), math.sin(math.radians(32))
    for i, o in enumerate(objs):                      # rows run across the screen, not across the world
        u, v = (i % cols) * cell, -(i // cols) * cell * 1.25
        o.location = (u * ca - v * sa, u * sa + v * ca, 0)
    bpy.context.view_layer.update()
    plane(9000, GRASS)
    rows = (len(objs) + cols - 1) // cols
    ortho_cam(objs, res=(2400, max(600, min(2600, int(2400 * (rows * 0.62) / cols)))))
elif mode == 'close':
    objs = pick(k, rest[:1])
    hide_others(k, objs)
    plane(9000, GRASS)
    az = float(rest[1]) if len(rest) > 1 else 28
    el = float(rest[2]) if len(rest) > 2 else 12
    fill = float(rest[3]) if len(rest) > 3 else 0.86
    P_ = bbox(objs)
    tall = (max(p.z for p in P_) - min(p.z for p in P_)) > 1.6 * (max(p.x for p in P_) - min(p.x for p in P_))
    persp_cam(objs, az, el, fill, res=(760, 1280) if tall else (1280, 900))
sc.render.filepath = os.path.join(PREV, outname)
bpy.ops.render.render(write_still=True)
print('wrote', outname)
