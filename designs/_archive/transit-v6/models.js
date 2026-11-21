/* Kevin Metro · the model library
   The city is built from models/kit.glb (generic buildings and props, instanced) and models/landmarks.glb
   (one headquarters per project, Kevin's tower, the station modules, the empty plot). If the library cannot be
   loaded, app.js shows the flat map instead.

   The contract (see README.md and tools/city3d/README.md):
   manifest  { version: 1, unit: 'm', files: { kit, landmarks }, kit: [{ name, class, w, d, h }],
               landmarks: [{ name, project, w, d, h, screens: [node], parts: [node] }] }
   models    every model is a top-level node named as in the manifest; origin at the footprint centre on the
             ground; Y up; metres; front faces +Z. One shared material: vertex colours (with baked shade)
             multiply the facade atlas. Screens are child quads with 0–1 UVs; parts are child nodes
             (`*_canopy` is white so it can take a line colour; `*_dome` and `*_jib` turn about the origin). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { liveScreen, PHOTO_SLOTS, PHOTO_H } from './landmarks.js';

const KEEP = ['position', 'normal', 'color', 'uv'];
const yAx = new THREE.Vector3(0, 1, 0);
// one geometry in the node's own space, with the same attributes whatever the exporter wrote
function flatten(node, skip = []) {
  node.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(node.matrixWorld).invert(); const parts = [];
  node.traverse((o) => {
    if (!o.isMesh) return;
    for (let a = o; a && a !== node; a = a.parent) if (skip.includes(a.name)) return;
    let g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    for (const k of KEEP) {
      const at = g.attributes[k]; const size = k === 'color' ? 3 : at.itemSize;
      if (at.array instanceof Float32Array && !at.normalized && at.itemSize === size) continue;
      const a = new Float32Array(at.count * size); for (let i = 0; i < at.count; i++) for (let j = 0; j < size; j++) a[i * size + j] = at.getComponent(i, j);
      g.setAttribute(k, new THREE.Float32BufferAttribute(a, size));
    }
    parts.push(g);
  });
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
}
const findNode = (root, name) => root.getObjectByName(name) || root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
const findMap = (root) => { let map = null; root.traverse((o) => { if (!map && o.isMesh && o.material && o.material.map) map = o.material.map; }); return map; };

/* Load the manifest and both files. Resolves to null if anything is missing or goes wrong. */
export async function loadLibrary(base = './models/') {
  try {
    const res = await fetch(`${base}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return null;
    const man = await res.json();
    if (man.version !== 1 || !man.files) return null;
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const [kitG, lmG] = await Promise.all([loader.loadAsync(base + man.files.kit), loader.loadAsync(base + man.files.landmarks)]);
    const lib = { manifest: man, kit: new Map(), kitDefs: [], landmarks: new Map(), material: null };
    (man.kit || []).forEach((def) => {
      const node = findNode(kitG.scene, def.name); const geometry = node && flatten(node);
      if (!geometry) { console.warn(`models: kit model "${def.name}" is in the manifest but not in ${man.files.kit}`); return; }
      lib.kit.set(def.name, { def, geometry }); lib.kitDefs.push(def);
    });
    (man.landmarks || []).forEach((def) => {
      const node = findNode(lmG.scene, def.name); if (!node) { console.warn(`models: landmark "${def.name}" is in the manifest but not in ${man.files.landmarks}`); return; }
      const kids = [...(def.screens || []), ...(def.parts || [])];
      const geometry = flatten(node, kids); if (!geometry) return;
      node.updateWorldMatrix(true, true); const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
      const child = (n) => { const c = findNode(node, n); const g = c && flatten(c); if (!g) return null; g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld)); return { name: n, geometry: g }; };
      lib.landmarks.set(def.name, { def, geometry, screens: (def.screens || []).map(child), parts: (def.parts || []).map(child).filter(Boolean) });
    });
    // one matte material for everything: the atlas (sRGB) × vertex colour (linear, with the baked shade) × light
    const map = findMap(kitG.scene) || findMap(lmG.scene);
    if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; map.needsUpdate = true; }
    lib.material = new THREE.MeshLambertMaterial({ map, vertexColors: true });
    if (!lib.kit.size || !lib.landmarks.size) return null;
    return lib;
  } catch (e) { console.warn('models: the model library could not be loaded.', e); return null; }
}

/* The kit: one InstancedMesh per model name. Only the instances near the view are sent to the GPU:
   cull() is called when the camera moves, with the ground rectangle in view and how far a tall
   building leans into it (metres of reach per metre of height).
   items: [{ name, x, y, z, yaw, s, sy, cast }] */
export function placeKit({ lib, scene, items, isPhone }) {
  const groups = new Map();
  items.forEach((it) => { if (!lib.kit.has(it.name)) return; if (!groups.has(it.name)) groups.set(it.name, []); groups.get(it.name).push(it); });
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const p = new THREE.Vector3(); const sc = new THREE.Vector3();
  const sets = [];
  groups.forEach((list, name) => {
    const k = lib.kit.get(name); const n = list.length; const all = new Float32Array(n * 16); const meta = new Float32Array(n * 4);
    list.forEach((it, i) => {
      const s = it.s || 1; const sy = it.sy || s;
      m4.compose(p.set(it.x, it.y || 0, it.z), q.setFromAxisAngle(yAx, it.yaw || 0), sc.set(s, sy, s)); m4.toArray(all, i * 16);
      meta[i * 4] = it.x; meta[i * 4 + 1] = it.z; meta[i * 4 + 2] = Math.hypot(k.def.w, k.def.d) * 0.5 * s; meta[i * 4 + 3] = k.def.h * sy;
    });
    const im = new THREE.InstancedMesh(k.geometry, lib.material, n);
    im.instanceMatrix.array.set(all); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.matrixAutoUpdate = false;
    im.castShadow = !isPhone && list[0].cast !== false && k.def.h > 24; im.receiveShadow = !isPhone && k.def.class !== 'prop';
    scene.add(im); sets.push({ im, all, meta, n, name, tall: k.def.h });
  });
  // (dx, dz) is the way the camera looks along the ground: the top of a building shows up that far beyond its foot.
  // `cut` { x, y, z, cos, sin, depth } hides whole buildings that the near plane would otherwise slice open:
  // those whose top comes nearer the camera than `depth` in front of the point (x, y, z).
  const cull = (x0, x1, z0, z1, reach, dx = 0, dz = 0, cut = null) => {
    let shown = 0;
    sets.forEach((s) => {
      const dst = s.im.instanceMatrix.array; const { all, meta } = s; let c = 0;
      for (let i = 0; i < s.n; i++) {
        const x = meta[i * 4]; const z = meta[i * 4 + 1]; const r = meta[i * 4 + 2]; const lean = meta[i * 4 + 3] * reach; const ox = dx * lean; const oz = dz * lean;
        if (x + r + (ox > 0 ? ox : 0) < x0 || x - r + (ox < 0 ? ox : 0) > x1 || z + r + (oz > 0 ? oz : 0) < z0 || z - r + (oz < 0 ? oz : 0) > z1) continue;
        if (cut && (r - (x - cut.x) * dx - (z - cut.z) * dz) * cut.cos + (meta[i * 4 + 3] - cut.y) * cut.sin > cut.depth) continue;
        const a = i * 16; const b = c * 16; for (let k = 0; k < 16; k++) dst[b + k] = all[a + k];
        c++;
      }
      s.im.count = c; s.im.visible = c > 0; s.im.instanceMatrix.needsUpdate = true; shown += c;
    });
    return shown;
  };
  const tris = () => sets.reduce((a, q) => a + (q.im.visible ? q.im.count * (q.im.geometry.attributes.position.count / 3) : 0), 0);
  return { cull, sets, tris, count: items.length };
}

/* The landmarks and stations: bodies are merged per station; canopies take their line
   colour; domes and crane jibs stay separate so they can turn; screens go onto the shared photo texture,
   a live screen, or (station name boards) the sign atlas.
   stations: [{ id, name, x, y, z, yaw, tint, board }] */
export function placeModels({ lib, scene, landmarks, stations, photos, signs, isPhone }) {
  const made = { screens: [], spin: [], meshes: [], groups: [] };
  const extras = new Map(); const extra = (key) => { if (!extras.has(key)) extras.set(key, { quads: [], live: [] }); return extras.get(key); }; // what else belongs to a group: its screens and turning parts
  // merged per station: its modules in one mesh, the project buildings beside it in another (only those cast shadows)
  const groups = new Map(); const add = (g, key) => { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(g); };
  const tintGeo = (g, hex) => { const c = new THREE.Color(hex); const a = g.attributes.color; for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * c.r, a.getY(i) * c.g, a.getZ(i) * c.b); return g; };
  const stand = (name, x, y, z, yaw, scale, tint, key) => {
    const model = lib.landmarks.get(name); if (!model) { console.warn(`models: no landmark called "${name}"`); return null; }
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(yAx, yaw), new THREE.Vector3(scale, scale, scale));
    add(model.geometry.clone().applyMatrix4(m), key);
    model.parts.forEach((pt) => {
      if (/_canopy$/.test(pt.name)) { const g = pt.geometry.clone(); if (tint != null) tintGeo(g, tint); add(g.applyMatrix4(m), key); return; }
      const mesh = new THREE.Mesh(pt.geometry, lib.material); mesh.position.set(x, y, z); mesh.rotation.y = yaw; mesh.scale.setScalar(scale); mesh.castShadow = !isPhone; scene.add(mesh); extra(key).live.push(mesh);
      made.spin.push({ mesh, yaw, kind: /_jib$/.test(pt.name) ? 'jib' : 'dome', seed: x * 0.013 + z * 0.007 });
    });
    return { model, m };
  };
  const photoQuads = [];
  landmarks.forEach((lm) => (lm.places || []).forEach((pl) => {
    const s = stand(pl.name, pl.x, 0.16, pl.z, pl.yaw, pl.scale, lm.tint, `L:${lm.station || lm.id}`); if (!s) return;
    s.model.screens.forEach((scr, i) => {
      const key = pl.keys[i]; if (!scr || !key) return; const g = scr.geometry.clone().applyMatrix4(s.m);
      { const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - uv.getY(k)); } // glTF counts v from the top; our canvases count from the bottom
      if (key === 'hirvo-cycle' || key === 'noir-video') { const live = liveScreen(key); const mesh = new THREE.Mesh(g, live.material); scene.add(mesh); made.screens.push({ mesh, near: live.near, update: live.update }); extra(`L:${lm.station || lm.id}`).live.push(mesh); return; }
      const slot = PHOTO_SLOTS[key]; if (!slot) { console.warn(`models: no photo called "${key}" for ${lm.id}`); return; }
      const uv = g.attributes.uv; const [x, y, w, h] = slot; for (let k = 0; k < uv.count; k++) uv.setXY(k, (x + 2 + uv.getX(k) * (w - 4)) / 2048, 1 - (y + 2 + (1 - uv.getY(k)) * (h - 4)) / PHOTO_H);
      extra(`L:${lm.station || lm.id}`).quads.push(photoQuads.length); photoQuads.push(g);
    });
  }));
  (stations || []).forEach((st) => {
    const s = stand(st.name, st.x, st.y, st.z, st.yaw, 1, st.tint, `S:${st.id}`); if (!s || !st.board) return;
    s.model.screens.forEach((scr) => {
      if (!scr) return; scr.geometry.computeBoundingBox(); const bb = scr.geometry.boundingBox; const c = bb.getCenter(new THREE.Vector3()); const size = bb.getSize(new THREE.Vector3());
      const nz = scr.geometry.attributes.normal.getZ(0); const face = new THREE.Matrix4().compose(c.addScaledVector(new THREE.Vector3(0, 0, Math.sign(nz) || 1), 0.06), new THREE.Quaternion().setFromAxisAngle(yAx, nz < 0 ? Math.PI : 0), new THREE.Vector3(1, 1, 1));
      signs.add(st.board, size.x, size.y, 0, 0, 0, 0, { matrix: new THREE.Matrix4().multiplyMatrices(s.m, face) });
    });
  });
  // every photo quad in one mesh; a hidden group's quads are folded away (their corners moved to one point)
  let photoPos = null; let photoHome = null; const starts = []; { let at = 0; photoQuads.forEach((g) => { starts.push([at, g.attributes.position.count]); at += g.attributes.position.count; }); }
  if (photoQuads.length) { const mesh = new THREE.Mesh(mergeGeometries(photoQuads, false), new THREE.MeshBasicMaterial({ map: photos.tex, toneMapped: false })); mesh.frustumCulled = false; scene.add(mesh); made.meshes.push(mesh); photoPos = mesh.geometry.attributes.position; photoHome = photoPos.array.slice(); }
  groups.forEach((list, key) => {
    const mesh = new THREE.Mesh(mergeGeometries(list, false), lib.material); mesh.castShadow = !isPhone && key[0] === 'L'; mesh.receiveShadow = !isPhone; scene.add(mesh); made.meshes.push(mesh);
    mesh.geometry.computeBoundingBox(); const bb = mesh.geometry.boundingBox; const ex = extras.get(key) || { quads: [], live: [] }; let shown = true;
    // show or hide the whole group (a station's modules, or the project buildings beside it) with its screens
    const show = (on) => { if (on === shown) return; shown = on; mesh.visible = on; ex.live.forEach((m) => { m.visible = on; });
      ex.quads.forEach((q) => { const [a, n] = starts[q]; for (let i = a * 3; i < (a + n) * 3; i++) photoPos.array[i] = on ? photoHome[i] : 0; }); if (ex.quads.length) photoPos.needsUpdate = true; };
    made.groups.push({ key, x: (bb.min.x + bb.max.x) / 2, z: (bb.min.z + bb.max.z) / 2, h: bb.max.y, show });
  });
  return made;
}
