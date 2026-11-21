"""Build kit.glb + landmarks.glb + manifest.json. Run inside Blender:
   blender -b --factory-startup --python-exit-code 1 --python build_all.py -- [kit|landmarks|all]
"""
import sys, os, json, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
what = args[0] if args else 'all'

bpy.ops.wm.read_factory_settings(use_empty=True)
import atlas, lib
im = atlas.save(os.path.join(OUT, 'atlas.png'))
mat, scr = lib.make_materials(im)


def build(makers, fname, key):
    t = time.time()
    rows, objs = [], []
    for make in makers:
        m = make()
        root, kids, row = lib.realize(m, mat, scr)
        if key == 'landmarks':
            row.pop('class', None)
            row = {'name': row['name'], 'project': m.project, **{k: v for k, v in row.items() if k != 'name'}}
            row['screens'] = [k for k in kids if '_screen' in k]
            parts = [k for k in kids if '_screen' not in k]
            if parts:
                row['parts'] = parts
        rows.append(row)
        objs.append(root)
        objs.extend(bpy.data.objects[k] for k in kids)
        print(f"  {row['name']:24s} tris {row['tris']:5d}  {row['w']}x{row['d']}x{row['h']}")
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, fname), export_format='GLB', use_selection=True,
                              export_yup=True, export_vertex_color='MATERIAL', export_cameras=False,
                              export_lights=False, export_animations=False)
    for o in objs:
        bpy.data.objects.remove(o)
    print(f'{fname}: {len(rows)} models, {sum(r["tris"] for r in rows)} tris, {time.time() - t:.1f}s')
    json.dump(rows, open(os.path.join(OUT, key + '.json'), 'w'), indent=1)


if what in ('kit', 'all'):
    import kit
    build(kit.KIT, 'kit.raw.glb', 'kit')
if what in ('landmarks', 'all'):
    import landmarks
    build(landmarks.LANDMARKS, 'landmarks.raw.glb', 'landmarks')
