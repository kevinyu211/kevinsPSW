"""Proof renders of models placed together (a train in a station, a pod at its dock, a ring on the lane), from the raw GLBs.
   blender -b --factory-startup --python preview_scene.py -- <out.png> <az> <el> <fill> [option=value ...] item ...
   item    = <file>:<model>@x,y,z,yaw   file = b (buildings.raw.glb), p (props.raw.glb) or t (test.raw.glb);
             x, y, z in glTF axes (y up), yaw in degrees about the up axis. '@...' may be left out.
   options = beauty=1 (sky reflections, real materials, soft sun: the beauty-*.png pictures)   gcol=r,g,b (ground colour)
             ground=<height or none>   res=<w>x<h>   lens=<mm>   night=1   focus=<model,model>   open=<0..1> (slide every door)
             look=x,y,z (glTF point to aim at, instead of the middle of the focus models)   dist=<metres>
"""
import sys, os, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
import bpy
from mathutils import Vector, Euler
args = sys.argv[sys.argv.index('--') + 1:]
outname, az, el, fill = args[0], float(args[1]), float(args[2]), float(args[3])
opts = dict(a.split('=', 1) for a in args[4:] if '=' in a and ':' not in a.split('=', 1)[0])
items = [a for a in args[4:] if not ('=' in a and ':' not in a.split('=', 1)[0])]
OUT, PREV = os.path.join(HERE, 'out'), os.path.join(HERE, 'previews')
FILES = {'b': 'buildings', 'p': 'props', 't': 'test'}
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
night = opts.get('night') == '1'
beauty = opts.get('beauty') == '1'
rows = {}
for key in FILES.values():
    f = os.path.join(OUT, key + '.json')
    if os.path.exists(f):
        for r in json.load(open(f)):
            rows[(key, r['name'])] = r

libs = {}


def lib(key):
    if key not in libs:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, FILES[key] + '.raw.glb'))
        new = [o for o in bpy.data.objects if o not in before]
        libs[key] = {o.name.split('.')[0]: o for o in new if o.parent is None}
        for o in new:
            o.hide_render = True
    return libs[key]


def copy(o, parent=None):
    c = o.copy()
    c.hide_render = False
    sc.collection.objects.link(c)
    if parent is not None:
        c.parent = parent
        c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
    for k in o.children:
        copy(k, c)
    return c


placed = []
for it in items:
    head, _, pos = it.partition('@')
    key, name = head.split(':')
    src = lib(key)[name]
    c = copy(src)
    x, y, z, yaw = ([float(v) for v in pos.split(',')] + [0, 0, 0, 0])[:4] if pos else (0, 0, 0, 0)
    c.location = (x, -z, y)
    c.rotation_mode = 'XYZ'
    c.rotation_euler = (0, 0, math.radians(yaw))
    op = float(opts.get('open', 0))
    row = rows.get((FILES[key], name), {})
    if op:
        byname = {d['name']: d for d in row.get('doors', []) + row.get('gates', [])}
        for k in c.children:
            d = byname.get(k.name.split('.')[0])
            if d:
                k.location.x += d['open'][0] * op
    placed.append((name, c))
bpy.context.view_layer.update()

for m in bpy.data.materials:
    m.use_backface_culling = True
    b = m.node_tree.nodes.get('Principled BSDF') if m.use_nodes else None
    if b and m.name.startswith('glow'):
        b.inputs['Roughness'].default_value = 0.3
        vc = next((n for n in m.node_tree.nodes if n.type in ('VERTEX_COLOR', 'ATTRIBUTE')), None)
        src_ = b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].links else None
        if src_ is not None:
            m.node_tree.links.new(src_, b.inputs['Emission Color'])
            b.inputs['Emission Strength'].default_value = 6.0 if night else (0.35 if beauty else 0.35)

w = bpy.data.worlds.new('w')
w.use_nodes = True
sc.world = w
bg = w.node_tree.nodes.get('Background')
bg.inputs[0].default_value = (0.03, 0.05, 0.12, 1) if night else (0.50, 0.62, 0.92, 1)
bg.inputs[1].default_value = 0.5 if night else 0.55
if beauty and not night:                  # a real sky to light the scene and to show in the glass and the coachwork
    nt = w.node_tree
    sky = nt.nodes.new('ShaderNodeTexSky')
    for attr, val in (('sun_disc', False), ('sun_elevation', math.radians(36)), ('sun_rotation', math.radians(float(opts.get('sun', 140)) + 180)), ('altitude', 0.0), ('air_density', 1.0), ('aerosol_density', 0.6), ('ozone_density', 1.0)):
        try:
            setattr(sky, attr, val)
        except Exception as ex:
            print('sky setting skipped:', attr, ex)
    nt.links.new(sky.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = float(opts.get('sky', 0.045))
    print('sky type:', sky.sky_type)
sun = bpy.data.lights.new('sun', 'SUN')
sun.energy = 0.35 if night else (3.4 if beauty else 5.0)
sun.color = (0.6, 0.7, 1.0) if night else (1.0, 0.80, 0.56)
sun.angle = math.radians(4.0 if beauty else 2.5)
so = bpy.data.objects.new('sun', sun)
e_, a_ = math.radians(36), math.radians(float(opts.get('sun', 140)))
sdir = Vector((math.sin(a_) * math.cos(e_), math.cos(a_) * math.cos(e_), math.sin(e_)))
so.rotation_euler = (-sdir).to_track_quat('-Z', 'Y').to_euler()
sc.collection.objects.link(so)
sc.render.engine = 'BLENDER_EEVEE'
for k, v in (('taa_render_samples', 96 if beauty else 48), ('use_shadows', True), ('use_raytracing', True), ('use_gtao', True), ('use_fast_gi', True), ('fast_gi_method', 'GLOBAL_ILLUMINATION'), ('ray_tracing_method', 'SCREEN'), ('fast_gi_distance', 12.0)):
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

g = opts.get('ground', '0')
if g != 'none':
    bpy.ops.mesh.primitive_plane_add(size=24000, location=(0, 0, float(g)))
    ob = bpy.context.object
    mt = bpy.data.materials.new('ground')
    mt.use_nodes = True
    bb = mt.node_tree.nodes.get('Principled BSDF')
    gc = [float(v) for v in opts['gcol'].split(',')] if 'gcol' in opts else (0.30, 0.52, 0.17)
    bb.inputs['Base Color'].default_value = (*gc, 1)
    bb.inputs['Roughness'].default_value = 0.6 if 'gcol' in opts else 0.95
    ob.data.materials.append(mt)

focus = opts.get('focus')
fobjs = [c for n, c in placed if (not focus or n in focus.split(','))]
P = []
for o in fobjs:
    for k in [o] + list(o.children_recursive):
        if k.type == 'MESH':
            P += [k.matrix_world @ Vector(c) for c in k.bound_box]
mn = Vector((min(p.x for p in P), min(p.y for p in P), min(p.z for p in P)))
mx = Vector((max(p.x for p in P), max(p.y for p in P), max(p.z for p in P)))
c = (mn + mx) / 2
if 'look' in opts:
    lx, ly, lz = [float(v) for v in opts['look'].split(',')]
    c = Vector((lx, -lz, ly))
r = (mx - mn).length / 2
res = tuple(int(v) for v in opts.get('res', '1400x900').split('x'))
lens = float(opts.get('lens', 45))
cam = bpy.data.cameras.new('cam')
cam.lens = lens
co = bpy.data.objects.new('cam', cam)
sc.collection.objects.link(co)
fov = 2 * math.atan(18 / lens)
vfov = 2 * math.atan(math.tan(fov / 2) * res[1] / res[0])
d = float(opts['dist']) if 'dist' in opts else r / math.sin(min(fov, vfov) / 2) / fill
a, e = math.radians(az), math.radians(el)
co.location = c + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * d
co.rotation_euler = (c - co.location).to_track_quat('-Z', 'Y').to_euler()
cam.clip_start, cam.clip_end = max(0.1, d * 0.02), max(20000.0, d * 400)
sc.camera = co
sc.render.resolution_x, sc.render.resolution_y = res
sc.render.filepath = outname if os.path.isabs(outname) else os.path.join(PREV, outname)
bpy.ops.render.render(write_still=True)
print('wrote', sc.render.filepath)
