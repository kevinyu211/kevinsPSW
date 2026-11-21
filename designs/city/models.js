/* Island city · the model library
   Reads models/manifest.json and the .glb files it lists, and turns every top-level node into the same shape
   the stand-ins use (see kit.js). Anything missing simply is not in the library: the city then draws its
   stand-in, so a late or broken file never stops the page.

   The contract: metres, Y up, front faces +Z, origin at the footprint centre on the ground. Top-level node
   names are model names; moving parts are child nodes called <model>_<part>. Materials by name: see KINDS below;
   every one multiplies the vertex colours (COLOR_0, with baked shade). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { WHITE, RED } from './kit.js';

/* The ten material names the model files use. A model keeps them: each becomes the city's own shared
   material of that name (world.js), with the roughness, metalness and opacity the file gives it. Opaque
   names come first; the two see-through glasses are drawn last. */
export const KINDS = ['city', 'pearl', 'stone', 'rubber', 'metal', 'dark', 'glow', 'sign', 'tint', 'glass'];
const kindOf = (mat) => {
  const n = ((mat && mat.name) || '').toLowerCase();
  if (n.includes('glass_tint')) return 'tint';
  if (n.includes('glass_dark')) return 'dark';
  if (n.includes('glass')) return mat && (mat.transparent || mat.opacity < 0.98 || mat.transmission > 0) ? 'glass' : 'dark';
  if (n.includes('sign') || n.includes('board')) return 'sign';
  if (n.includes('glow')) return 'glow';
  if (n.includes('pearl')) return 'pearl';
  if (n.includes('metal')) return 'metal';
  if (n.includes('rubber')) return 'rubber';
  if (n.includes('stone') || n.includes('paving') || n.includes('concrete')) return 'stone';
  return 'city';
};
const LINE_MODEL = /^(station|train|tram)/; // on these, strong reds are the metro line and stay red in the model look

/* The white model: every material keeps its name but takes one plain tone, and the shade baked into the
   vertex colours is kept so forms still read. The baked colour is paint × shade; within one material, all
   vertices of one paint share a hue, so the brightest vertex of each hue is taken as unshaded paint and
   every vertex keeps its own share of it. */
const MODEL_TONE = { city: 1, pearl: 1.03, stone: 0.9, rubber: 0.62, metal: 0.84, dark: 0.66, glow: 1.02, sign: 1.0, tint: 0.62, glass: 0.8 };
export function tintGeo(geo, tint = WHITE, keepRed = false) {
  for (const kind of Object.keys(geo)) {
    const g = geo[kind]; if (!g) continue; const c = g.attributes.color; const n = c.count; const m = new Float32Array(n * 3);
    const key = new Int32Array(n); const top = new Map();
    for (let i = 0; i < n; i++) { const r = c.getX(i); const gg = c.getY(i); const b = c.getZ(i); const v = Math.max(r, gg, b, 1e-4); const k = (Math.round((r / v) * 7) * 64) + (Math.round((gg / v) * 7) * 8) + Math.round((b / v) * 7); key[i] = k; if (!(top.get(k) >= v)) top.set(k, v); }
    const tone = MODEL_TONE[kind] || 1;
    for (let i = 0; i < n; i++) {
      const r = c.getX(i); const gg = c.getY(i); const b = c.getZ(i); const v = Math.max(r, gg, b);
      if (keepRed && r > 0.4 && gg < r * 0.45 && b < r * 0.45) { m.set(RED, i * 3); continue; }
      const shade = Math.min(1, v / (top.get(key[i]) || 1)); const k = tone * (0.4 + 0.6 * shade);
      m[i * 3] = tint[0] * k; m[i * 3 + 1] = tint[1] * k; m[i * 3 + 2] = tint[2] * k;
    }
    g.setAttribute('mcol', new THREE.BufferAttribute(m, 3));
  }
  return geo;
}

/* One clean indexed geometry (position, normal, color, and uv for signs) from a mesh, moved by `matrix`. */
function clean(mesh, matrix, uv) {
  const src = mesh.geometry; const n = src.attributes.position.count;
  const out = new THREE.BufferGeometry();
  const f32 = (a, size) => { const arr = new Float32Array(n * size); for (let i = 0; i < n; i++) for (let j = 0; j < size; j++) arr[i * size + j] = a.getComponent(i, j); return new THREE.BufferAttribute(arr, size); };
  out.setAttribute('position', f32(src.attributes.position, 3));
  if (src.attributes.normal) out.setAttribute('normal', f32(src.attributes.normal, 3));
  const c = src.attributes.color; const base = mesh.material && mesh.material.color ? mesh.material.color : new THREE.Color(1, 1, 1); const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = (c ? c.getX(i) : 1) * base.r; col[i * 3 + 1] = (c ? c.getY(i) : 1) * base.g; col[i * 3 + 2] = (c ? c.getZ(i) : 1) * base.b; }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (uv) { const t = src.attributes.uv ? f32(src.attributes.uv, 2) : new THREE.BufferAttribute(new Float32Array(n * 2), 2); for (let i = 0; i < n; i++) t.setY(i, 1 - t.getY(i)); out.setAttribute('uv', t); } // glTF counts v down from the top; here v runs up
  if (src.index) out.setIndex(Array.from(src.index.array)); else out.setIndex([...Array(n).keys()]);
  out.applyMatrix4(matrix); if (!src.attributes.normal) out.computeVertexNormals();
  return out;
}

/* The materials' own numbers, by name, as the files give them. */
function readMaterial(mat, into) {
  const k = kindOf(mat); if (into[k]) return;
  into[k] = { roughness: mat.roughness, metalness: mat.metalness, opacity: mat.opacity, transparent: !!mat.transparent };
}

function flatten(root, isKid, mats) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(); const parts = Object.fromEntries(KINDS.map((k) => [k, []]));
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (let a = o; a && a !== root; a = a.parent) if (isKid(a)) return; // moving parts are kept apart
    const k = kindOf(o.material); if (mats) readMaterial(o.material, mats);
    parts[k].push(clean(o, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), k === 'sign'));
  });
  const geo = {}; let any = false;
  for (const k of KINDS) { geo[k] = parts[k].length ? (parts[k].length === 1 ? parts[k][0] : mergeGeometries(parts[k], false)) : null; any = any || !!geo[k]; }
  return any ? geo : null;
}

function toModel(node, def, isNode, mats) {
  const name = node.name; const prefix = `${name}_`;
  const listed = def && Array.isArray(def.children) ? def.children.map((c) => (typeof c === 'string' ? c : c && c.name)).filter(Boolean) : null;
  const kidNodes = [];
  node.traverse((o) => { if (o === node || !isNode(o) || !o.name.startsWith(prefix)) return; if (listed && !listed.includes(o.name)) return; kidNodes.push(o); });
  const top = kidNodes.filter((k) => { for (let a = k.parent; a && a !== node; a = a.parent) if (kidNodes.includes(a)) return false; return true; });
  const geo = flatten(node, (o) => top.includes(o), mats); if (!geo) return null;
  node.updateWorldMatrix(true, true); const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
  const kids = {};
  top.forEach((k) => {
    const kg = flatten(k, () => false, mats); if (!kg) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, k.matrixWorld); const p = new THREE.Vector3(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(); rel.decompose(p, q, s);
    kids[k.name.slice(prefix.length)] = { geo: tintGeo(kg, WHITE, LINE_MODEL.test(name)), pos: [p.x, p.y, p.z], quat: [q.x, q.y, q.z, q.w], scale: [s.x, s.y, s.z] };
  });
  const box = new THREE.Box3(); Object.values(geo).forEach((g) => { if (g) { g.computeBoundingBox(); box.union(g.boundingBox); } }); const sz = box.getSize(new THREE.Vector3());
  return { name, real: true, def: def || null, size: [sz.x, box.max.y, sz.z], geo: tintGeo(geo, WHITE, LINE_MODEL.test(name)), kids };
}

/* Always resolves. `lib.get(name)` is a model or undefined. */
export async function loadLibrary(base = './models/', onProgress) {
  const lib = { manifest: null, models: new Map(), mats: {}, files: [], get: (n) => lib.models.get(n), has: (n) => lib.models.has(n) };
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
      tops.forEach((node) => { try { const m = toModel(node, defs.get(node.name), isNode, lib.mats); if (m) lib.models.set(m.name, m); } catch (e) { console.warn(`models: "${node.name}" could not be read and is skipped.`, e); } });
      lib.files.push(f);
    } catch (e) { console.warn(`models: ${f} could not be loaded; stand-ins are used instead.`, e); }
    done++; if (onProgress) onProgress(done / files.length);
  }));
  return lib;
}
