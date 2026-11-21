"""Physical-sense audit: for every model in a raw GLB, find parts that touch nothing (not the ground, not another part).
   blender -b --factory-startup --python audit_parts.py -- <buildings|props> [name-prefix]
   A part = a connected piece of mesh. It is 'floating' if its box (grown by 6 cm) meets no other part's box and it
   does not reach the ground. Boxes are a coarse test, so this only lists suspects to look at."""
import sys, os, json
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[sys.argv.index('--') + 1:]
key = args[0]
pre = args[1] if len(args) > 1 else ''
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, 'out', key + '.raw.glb'))
SKIP_GROUND = ('train', 'tram', 'lane_ring', 'gull')
out = {}
for ob in sorted([o for o in bpy.data.objects if o.parent is None and o.type == 'MESH'], key=lambda o: o.name):
    if not ob.name.startswith(pre) or ob.name.startswith(('train', 'tram', 'lane_ring', 'gull', 'dolphin')):
        continue
    bm = bmesh.new()
    for o in [ob] + list(ob.children_recursive):
        if o.type != 'MESH':
            continue
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        tmp.transform(o.matrix_world)
        me = bpy.data.meshes.new('t')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.01)
    bm.verts.ensure_lookup_table()
    comp_of, comps = {}, []
    for v in bm.verts:
        if v.index in comp_of:
            continue
        stack, ci = [v], len(comps)
        comp_of[v.index] = ci
        comps.append([])
        while stack:
            u = stack.pop()
            comps[ci].append(u.index)
            for e in u.link_edges:
                w = e.other_vert(u)
                if w.index not in comp_of:
                    comp_of[w.index] = ci
                    stack.append(w)
    faces = [[] for _ in comps]
    for f in bm.faces:
        faces[comp_of[f.verts[0].index]].append([v.index for v in f.verts])
    g = 0.07
    parts = []
    for ci, idx in enumerate(comps):
        if not faces[ci]:
            continue
        cos = [bm.verts[i].co for i in idx]
        mn = Vector((min(c.x for c in cos), min(c.y for c in cos), min(c.z for c in cos)))
        mx = Vector((max(c.x for c in cos), max(c.y for c in cos), max(c.z for c in cos)))
        c = (mn + mx) / 2
        sz = mx - mn
        k = Vector(((sz[a_] + 2 * g) / max(sz[a_], 1e-3) if sz[a_] > 0.02 else 1.0 for a_ in range(3)))
        remap = {i: n for n, i in enumerate(idx)}
        vs = []
        for i in idx:
            d = bm.verts[i].co - c
            vs.append(c + Vector((d.x * k.x, d.y * k.y, d.z * k.z)) + Vector((0, 0, 0)))
        tree = BVHTree.FromPolygons(vs, [[remap[i] for i in f] for f in faces[ci]])
        parts.append((mn, mx, tree))
    zmin = min(p[0].z for p in parts)
    ground = max(0.35, zmin + 0.4) if key == 'buildings' else 0.3
    fl = []
    for i, (mn, mx, ti) in enumerate(parts):
        if mn.z <= ground:
            continue
        touch = False
        for j, (a, b, tj) in enumerate(parts):
            if i != j and all(mn[k_] - 2 * g <= b[k_] and mx[k_] + 2 * g >= a[k_] for k_ in range(3)) and ti.overlap(tj):
                touch = True
                break
        if not touch and min(mx - mn) >= 0.12:
            fl.append([round(v, 1) for v in (*((mn + mx) / 2), *(mx - mn))])
    if fl:
        out[ob.name] = fl
    bm.free()
for n, fl in out.items():
    print(f'FLOAT {n}: {len(fl)}', fl[:9])
print('models with floating parts:', len(out))
