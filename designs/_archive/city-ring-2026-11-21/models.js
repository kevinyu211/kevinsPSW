/* Island city · the model library
   Reads models/manifest.json and the .glb files it lists, and turns every top-level node into the same shape
   the stand-ins use (see kit.js). Anything missing simply is not in the library: the city then draws its
   stand-in, so a late or broken file never stops the page.

   The contract: metres, Y up, front faces +Z, origin at the footprint centre on the ground. Top-level node
   names are model names; moving parts are child nodes called <model>_<part>. Materials by name: `city`
   (vertex colours with baked shade), `glass`, `glow`. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { WHITE, RED } from './kit.js';

const kindOf = (mat) => { const n = ((mat && mat.name) || '').toLowerCase(); return n.includes('glass') ? 'glass' : n.includes('glow') ? 'glow' : 'city'; };
const LINE_MODEL = /^(station|train|tram)/; // on these, strong reds are the metro line and stay red in the model look

/* The white-model colour of every vertex: the tint, shaded by how light the film colour is. */
export function tintGeo(geo, tint = WHITE, keepRed = false) {
  for (const kind of Object.keys(geo)) {
    const g = geo[kind]; if (!g) continue; const c = g.attributes.color; const n = c.count; const m = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = c.getX(i); const gg = c.getY(i); const b = c.getZ(i); const v = Math.min(1, Math.max(r, gg, b));
      if (keepRed && r > 0.4 && gg < r * 0.45 && b < r * 0.45) { m.set(RED, i * 3); continue; }
      const k = kind === 'glass' ? 0.62 : 0.5 + 0.5 * v;
      m[i * 3] = tint[0] * k; m[i * 3 + 1] = tint[1] * k; m[i * 3 + 2] = tint[2] * k;
    }
    g.setAttribute('mcol', new THREE.BufferAttribute(m, 3));
  }
  return geo;
}

/* One clean geometry (position, normal, color) from a mesh, moved by `matrix`. */
function clean(mesh, matrix) {
  let g = mesh.geometry.clone(); g.applyMatrix4(matrix); if (g.index) g = g.toNonIndexed();
  const n = g.attributes.position.count; if (!g.attributes.normal) g.computeVertexNormals();
  const src = g.attributes.color; const base = mesh.material && mesh.material.color ? mesh.material.color : new THREE.Color(1, 1, 1);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = (src ? src.getX(i) : 1) * base.r; col[i * 3 + 1] = (src ? src.getY(i) : 1) * base.g; col[i * 3 + 2] = (src ? src.getZ(i) : 1) * base.b; }
  const out = new THREE.BufferGeometry();
  const f32 = (a, size) => { const arr = new Float32Array(n * size); for (let i = 0; i < n; i++) for (let j = 0; j < size; j++) arr[i * size + j] = a.getComponent(i, j); return new THREE.BufferAttribute(arr, size); };
  out.setAttribute('position', f32(g.attributes.position, 3)); out.setAttribute('normal', f32(g.attributes.normal, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

function flatten(root, isKid) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(); const parts = { city: [], glass: [], glow: [] };
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (let a = o; a && a !== root; a = a.parent) if (isKid(a)) return; // moving parts are kept apart
    parts[kindOf(o.material)].push(clean(o, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
  });
  const geo = {}; let any = false;
  for (const k of Object.keys(parts)) { geo[k] = parts[k].length ? (parts[k].length === 1 ? parts[k][0] : mergeGeometries(parts[k], false)) : null; any = any || !!geo[k]; }
  return any ? geo : null;
}

function toModel(node, def, isNode) {
  const name = node.name; const prefix = `${name}_`;
  const listed = def && Array.isArray(def.children) ? def.children.map((c) => (typeof c === 'string' ? c : c && c.name)).filter(Boolean) : null;
  const kidNodes = [];
  node.traverse((o) => { if (o === node || !isNode(o) || !o.name.startsWith(prefix)) return; if (listed && !listed.includes(o.name)) return; kidNodes.push(o); });
  const top = kidNodes.filter((k) => { for (let a = k.parent; a && a !== node; a = a.parent) if (kidNodes.includes(a)) return false; return true; });
  const geo = flatten(node, (o) => top.includes(o)); if (!geo) return null;
  node.updateWorldMatrix(true, true); const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
  const kids = {};
  top.forEach((k) => {
    const kg = flatten(k, () => false); if (!kg) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, k.matrixWorld); const p = new THREE.Vector3(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(); rel.decompose(p, q, s);
    kids[k.name.slice(prefix.length)] = { geo: tintGeo(kg, WHITE, LINE_MODEL.test(name)), pos: [p.x, p.y, p.z], quat: [q.x, q.y, q.z, q.w], scale: [s.x, s.y, s.z] };
  });
  const box = new THREE.Box3(); Object.values(geo).forEach((g) => { if (g) { g.computeBoundingBox(); box.union(g.boundingBox); } }); const sz = box.getSize(new THREE.Vector3());
  return { name, real: true, def: def || null, size: [sz.x, box.max.y, sz.z], geo: tintGeo(geo, WHITE, LINE_MODEL.test(name)), kids };
}

/* Always resolves. `lib.get(name)` is a model or undefined. */
export async function loadLibrary(base = './models/', onProgress) {
  const lib = { manifest: null, models: new Map(), files: [], get: (n) => lib.models.get(n), has: (n) => lib.models.has(n) };
  let man = null;
  try { const res = await fetch(`${base}manifest.json`, { cache: 'no-cache' }); if (res.ok) man = await res.json(); } catch (e) { man = null; }
  if (!man) return lib;
  lib.manifest = man;
  // the manifest's model entries, wherever they are listed
  const defs = new Map(); const scan = (v) => { if (Array.isArray(v)) v.forEach((d) => { if (d && typeof d === 'object' && typeof d.name === 'string') defs.set(d.name, d); }); else if (v && typeof v === 'object') Object.values(v).forEach(scan); };
  scan(man);
  let files = [];
  if (man.files) files = (Array.isArray(man.files) ? man.files : Object.values(man.files)).map((f) => (typeof f === 'string' ? f : f && (f.file || f.path || f.name))).filter((f) => typeof f === 'string' && /\.glb$/i.test(f));
  if (!files.length) files = ['buildings.glb', 'props.glb'];
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  let done = 0;
  await Promise.all(files.map(async (f) => {
    try {
      const gltf = await loader.loadAsync(base + f);
      const assoc = gltf.parser.associations; const isNode = (o) => { const a = assoc.get(o); return !!a && a.nodes !== undefined; };
      // top-level nodes are models (a single wrapper node around everything is looked through)
      let tops = gltf.scene.children; if (tops.length === 1 && !tops[0].isMesh && !defs.has(tops[0].name) && tops[0].children.some((c) => defs.has(c.name))) tops = tops[0].children;
      tops.forEach((node) => { try { const m = toModel(node, defs.get(node.name), isNode); if (m) lib.models.set(m.name, m); } catch (e) { console.warn(`models: "${node.name}" could not be read and is skipped.`, e); } });
      lib.files.push(f);
    } catch (e) { console.warn(`models: ${f} could not be loaded; stand-ins are used instead.`, e); }
    done++; if (onProgress) onProgress(done / files.length);
  }));
  return lib;
}
