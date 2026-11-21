"""Build the island model library (raw GLBs + row lists). Run inside Blender:
   blender -b --factory-startup --python-exit-code 1 --python build_island.py -- [buildings|props|all] [only=a,b,c]
   With only=..., just those models are built and written to out/test.raw.glb (for quick looks).
"""
import sys, os, json, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
import bpy
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
what = args[0] if args else 'all'
only = None
for a in args[1:]:
    if a.startswith('only='):
        only = a[5:].split(',')

bpy.ops.wm.read_factory_settings(use_empty=True)
import ilib
mats = ilib.make_materials()


def build(makers, fname, key):
    t = time.time()
    rows, objs = [], []
    for name, make in makers:
        if only and not any(name == o or name.startswith(o + '_') for o in only):
            continue
        m = make()
        assert m.name == name, (m.name, name)
        root, kids, row = ilib.realize(m, mats)
        rows.append(row)
        objs.append(root)
        objs.extend(kids)
        print(f"  {row['name']:22s} tris {row['tris']:5d}  size {row['size']}" + (f"  kids {len(kids)}" if kids else ''))
    if not rows:
        return
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, fname), export_format='GLB', use_selection=True,
                              export_yup=True, export_apply=True, export_vertex_color='MATERIAL', export_texcoords=True,
                              export_cameras=False, export_lights=False, export_animations=False)
    for o in objs:
        bpy.data.objects.remove(o)
    print(f'{fname}: {len(rows)} models, {sum(r["tris"] for r in rows)} tris, {time.time() - t:.1f}s')
    json.dump(rows, open(os.path.join(OUT, key + '.json'), 'w'), indent=1)


if what in ('buildings', 'all'):
    import future, shared          # future.py = the 'city of tomorrow' buildings (buildings.py is the first, traditional set)
    build(future.MODELS + shared.MODELS, 'test.raw.glb' if only else 'buildings.raw.glb', 'test' if only else 'buildings')
if what in ('props', 'all'):
    import props
    build(props.MODELS, 'test.raw.glb' if only else 'props.raw.glb', 'test' if only else 'props')
