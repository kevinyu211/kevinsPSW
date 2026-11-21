/* Island city · the 3D island
   Builds the whole island from city-data.js: land and sea, the metro loop and its stations, one building per
   stop, Kevin's tower and the hill tram, roads, houses, trees and island life. Real models come from the
   library (models.js); anything missing uses its stand-in (kit.js).
   The page (app.js) owns the story: it tells this file where the train is and what the camera should do. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LOOP, DISTRICTS, TOWNS, PROJECTS, LIFE, VIEW, TRAM as TRAM_DATA } from './city-data.js';
import { LAYOUT, HALF, PLATEAU, LANE_Y, TOWER_AT, placementsOf, height, shoreDistance, softShoreDistance, hillAmount, pointInPoly } from './layout.js';
import { Kit, standBuilding, standLot, standSite, standStation, standCar, standTram, standTower, standProp } from './kit.js';
import { tintGeo, KINDS } from './models.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { LOOP_LEN, PLACES, trackAt, tramAt, TRAM, laneOf, sOfPoint } from './track.js';

const D2R = Math.PI / 180; const TRAM_STOPS = TRAM_DATA.stops;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, t) => { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const backOut = (p) => { const c = 1.4; const q = p - 1; return 1 + (c + 1) * q * q * q + c * q * q; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const DCOL = Object.fromEntries(DISTRICTS.map((d) => [d.id, d.color]));

/* ---------- the four times of day, and the weather ---------- */
const TIMES = {
  dawn: { label: 'Dawn', el: 11, az: 98, sun: '#ffc39c', sunI: 3.0, zen: '#6f93d4', hor: '#f6c1a6', amb: 0.55, expo: 0.98, deep: '#124c76', shallow: '#4cc4b8', lit: 0.3, cloud: 0.5 },
  day: { label: 'Day', el: 40, az: 226, sun: '#fff0d6', sunI: 4.0, zen: '#3a7edb', hor: '#b9dcf4', amb: 0.6, expo: 0.94, deep: '#0a4f86', shallow: '#3fd0c4', lit: 0, cloud: 0.45 },
  golden: { label: 'Golden hour', el: 17, az: 250, sun: '#ffb062', sunI: 4.2, zen: '#4f7fd0', hor: '#f8c592', amb: 0.5, expo: 1.0, deep: '#0e4b78', shallow: '#48c2b4', lit: 0.12, cloud: 0.6 },
  night: { label: 'Night', el: 44, az: 150, sun: '#a9bcff', sunI: 1.25, zen: '#0a1436', hor: '#24386e', amb: 0.7, expo: 1.08, deep: '#0a2440', shallow: '#17505f', lit: 1, cloud: 0.25 },
};
const WEATHER = { clear: { label: 'Clear' }, rain: { label: 'Rain' }, fog: { label: 'Fog' } };
export const TIME_NAMES = Object.keys(TIMES); export const WEATHER_NAMES = Object.keys(WEATHER);
export const timeLabel = (t) => TIMES[t].label; export const weatherLabel = (w) => WEATHER[w].label;

/** Can this browser draw the island at all? */
export function hasWebGL() { try { const c = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')); } catch (e) { return false; } }

export function createWorld({ host, lib, levels, owner = 'Kevin', phone = false, reduce = false }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false; const canvas = renderer.domElement; canvas.className = 'city-canvas'; canvas.setAttribute('aria-hidden', 'true'); host.prepend(canvas);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0xbfd9ee, 0.00016);
  const camera = new THREE.PerspectiveCamera(VIEW.lens, 16 / 9, 4, 17000);

  /* ---------- materials ----------
     The models' own ten materials, by name (models.js KINDS): each is one shared material here with the
     roughness, metalness and opacity the model file gives it, an environment map of the sky, and two looks
     (film, and the white model, which keeps the baked shade). */
  const RISE_N = 24; // buildings that rise in the opening: one slot each (0 = never moves)
  const U = { uLook: { value: 0 }, uLit: { value: 0 }, uGlow: { value: 0.2 }, uTime: { value: 0 }, uWet: { value: 0 }, uRise: { value: Array.from({ length: RISE_N }, () => new THREE.Vector4(0, 0, 0, 1)) } };
  const RISE_GLSL = `{ vec4 R = uRise[int(grp + 0.5)]; float e = abs(R.w); float w = e < 0.001 ? 0.0 : (R.w < 0.0 ? 1.0 : 0.88 + 0.12 * min(1.0, e)); transformed = R.xyz + (transformed - R.xyz) * vec3(w, e, w); }`;
  function twoLooks(mat, kind, { sway = false, rise = false } = {}) {
    const see = kind === 'glass' || kind === 'tint';
    mat.defines = { ...(mat.defines || {}), [`IS_${kind.toUpperCase()}`]: 1, RISE_N }; if (sway) mat.defines.IS_SWAY = 1; if (rise) mat.defines.USE_RISE = 1; if (see) mat.defines.IS_SEE = 1;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 mcol;\nuniform float uTime;\nvarying vec3 vMcol;\nvarying vec3 vWp;\n#ifdef USE_RISE\nattribute float grp;\nuniform vec4 uRise[RISE_N];\n#endif')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvMcol = mcol;\n#ifdef USE_RISE\n${RISE_GLSL}\n#endif\n#if defined(IS_SWAY) && defined(USE_INSTANCING)\nfloat swayPh = instanceMatrix[3].x * 0.071 + instanceMatrix[3].z * 0.053;\nfloat swayH = max(transformed.y - 1.4, 0.0);\ntransformed.x += (sin(uTime * 1.25 + swayPh) * 0.030 + sin(uTime * 2.9 + swayPh * 1.7) * 0.010) * swayH;\ntransformed.z += (cos(uTime * 1.05 + swayPh * 1.3) * 0.020) * swayH;\n#endif\n#ifdef USE_INSTANCING\nvWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uLook;\nuniform float uLit;\nuniform float uGlow;\nuniform float uWet;\nvarying vec3 vMcol;\nvarying vec3 vWp;\nfloat hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
        .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 filmCol = diffuseColor.rgb;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vMcol, uLook);')
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n#ifndef IS_SEE\nroughnessFactor *= mix(1.0, 0.42, uWet * smoothstep(0.3, 0.9, roughnessFactor) * (1.0 - uLook)); // rain: streets and roofs turn glossy\nroughnessFactor = mix(roughnessFactor, 0.9, uLook);\n#endif`)
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, uLook);')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef IS_GLOW
{ // lamps, signs and window panes: a sign keeps its own colour; a pale pane is warm room light, and not every room is lit
  float mx = max(max(filmCol.r, filmCol.g), filmCol.b); float sat = (mx - min(min(filmCol.r, filmCol.g), filmCol.b)) / max(mx, 0.04); vec3 own = filmCol / max(mx, 0.04);
  float signish = smoothstep(0.28, 0.5, sat); float room = mix(step(0.3, hash2(floor(vWp.xz / 3.1) + floor(vWp.y / 3.4) * 7.3)), 1.0, signish);
  vec3 night = mix(vec3(1.0, 0.74, 0.44) * (0.7 + 0.3 * hash2(floor(vWp.xz / 3.1) + 3.0)), own, signish) * room;
  totalEmissiveRadiance += mix(own * 0.12 * signish, night * uGlow, uLit) * (1.0 - uLook * 0.75);
}
#endif
#ifdef IS_DARK
totalEmissiveRadiance += vec3(1.0, 0.7, 0.4) * uLit * 0.07 * (1.0 - uLook); // a soft light from deep inside
#endif`)
        .replace('#include <opaque_fragment>', `#ifdef IS_SEE
{ // glass reflects more at a glancing angle, as real glass does; smoked glass seen from inside the cabin is see-through
  float fr = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 4.0); diffuseColor.a = mix(diffuseColor.a, 1.0, fr * 0.75);
  #ifdef IS_TINT
  if (!gl_FrontFacing) diffuseColor.a *= 0.26;
  #endif
}
#endif
#include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => `island-${kind}${sway ? '-sway' : ''}${rise ? '-rise' : ''}`;
    return mat;
  }
  const LM = (lib && lib.mats) || {};
  // the manifest's numbers, kept here only for a file that has not arrived; the files' own values win
  const SPEC = {
    city: { roughness: 0.82, metalness: 0, env: 0.55 }, pearl: { roughness: 0.26, metalness: 0, env: 1.0, coat: true }, stone: { roughness: 0.94, metalness: 0, env: 0.45 },
    rubber: { roughness: 0.7, metalness: 0, env: 0.5 }, metal: { roughness: 0.36, metalness: 0.9, env: 1.0 }, dark: { roughness: 0.1, metalness: 0.4, env: 1.3 },
    glow: { roughness: 0.35, metalness: 0, env: 0.6 }, sign: { roughness: 0.6, metalness: 0, env: 0.4 },
    tint: { roughness: 0.06, metalness: 0.3, env: 1.5, opacity: 0.82, see: true }, glass: { roughness: 0.05, metalness: 0, env: 1.6, opacity: 0.34, see: true },
  };
  function makeMat(kind, opt = {}) {
    const sp = { ...SPEC[kind] }; const f = LM[kind]; if (f) { if (f.roughness != null) sp.roughness = f.roughness; if (f.metalness != null) sp.metalness = f.metalness; if (sp.see && f.opacity != null && f.opacity < 1) sp.opacity = f.opacity; }
    const o = { vertexColors: true, roughness: sp.roughness, metalness: sp.metalness, envMapIntensity: sp.env };
    if (sp.see) Object.assign(o, { transparent: true, opacity: sp.opacity, depthWrite: false, side: THREE.DoubleSide });
    const m = sp.coat && !phone ? new THREE.MeshPhysicalMaterial({ ...o, clearcoat: 0.45, clearcoatRoughness: 0.1 }) : new THREE.MeshStandardMaterial(o);
    return twoLooks(m, kind, opt);
  }
  const MAT = Object.fromEntries(KINDS.map((k) => [k, makeMat(k)]));
  // land and roads: matte; trees: matte, and they sway
  MAT.matte = twoLooks(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.5 }), 'city');
  MAT.tree = twoLooks(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.5 }), 'city', { sway: true });
  const SEE = { tint: 5, glass: 6 }; // drawn after everything solid: the smoked glass, then the clear
  const castsOf = (k) => k !== 'glass' && k !== 'sign';
  const recvOf = (k) => k !== 'glass' && k !== 'tint' && k !== 'glow';

  /* ---------- models: the real one if it has arrived, or the stand-in ---------- */
  const used = { real: [], stand: [] }; const cache = new Map();
  function getModel(name, make) {
    if (cache.has(name)) return cache.get(name);
    let m = lib && lib.get(name); if (m) used.real.push(name); else { m = make ? make() : null; if (m) used.stand.push(name); }
    cache.set(name, m); return m;
  }
  const prop = (name) => getModel(name, () => standProp(name));
  function meshesOf(geo, cast, body = null) { const out = []; for (const k of KINDS) if (geo[k]) { const m = new THREE.Mesh(geo[k], k === 'city' && body ? body : MAT[k]); m.castShadow = cast && castsOf(k); m.receiveShadow = recvOf(k); if (SEE[k]) m.renderOrder = SEE[k]; out.push(m); } return out; }
  const localOf = (kid) => new THREE.Matrix4().compose(new THREE.Vector3().fromArray(kid.pos), kid.quat ? new THREE.Quaternion().fromArray(kid.quat) : new THREE.Quaternion(), kid.scale ? new THREE.Vector3().fromArray(kid.scale) : new THREE.Vector3(1, 1, 1));
  /** One copy of a model, with its moving parts as named groups in userData.kids. */
  function spawn(model, { cast = true, only = null } = {}) {
    const g = new THREE.Group(); g.userData.kids = {}; meshesOf(model.geo, cast).forEach((m) => g.add(m));
    for (const [name, kid] of Object.entries(model.kids || {})) { if (only && !only.includes(name)) continue; const kg = new THREE.Group(); kg.position.fromArray(kid.pos); if (kid.quat) kg.quaternion.fromArray(kid.quat); if (kid.scale) kg.scale.fromArray(kid.scale); meshesOf(kid.geo, cast).forEach((m) => kg.add(m)); g.add(kg); g.userData.kids[name] = kg; }
    return g;
  }
  /** Many copies of a model in a few draw calls. set(i, matrix); kid(name, i, matrix, turn) for moving parts. */
  function inst(model, n, { cast = true, parent = scene, skin = null } = {}) {
    const mk = (geo, c2 = cast) => KINDS.filter((k) => geo[k]).map((k) => { const im = new THREE.InstancedMesh(geo[k], k === 'city' && skin ? skin : MAT[k], n); im.castShadow = c2 && castsOf(k); im.receiveShadow = recvOf(k); if (SEE[k]) im.renderOrder = SEE[k]; im.frustumCulled = false; im.userData.kind = k; parent.add(im); return im; });
    const body = mk(model.geo); const kids = {}; const tmp = new THREE.Matrix4();
    for (const [name, kid] of Object.entries(model.kids || {})) kids[name] = { meshes: mk(kid.geo, false), local: localOf(kid) }; // small moving parts (doors, gates, wings) cast no shadow
    const all = [...body, ...Object.values(kids).flatMap((k) => k.meshes)];
    return {
      n, body, all,
      set(i, m) { body.forEach((im) => im.setMatrixAt(i, m)); for (const k of Object.values(kids)) { tmp.multiplyMatrices(m, k.local); k.meshes.forEach((im) => im.setMatrixAt(i, tmp)); } },
      kid(name, i, m, turn) { const k = kids[name]; if (!k) return; tmp.multiplyMatrices(m, k.local); if (turn) tmp.multiply(turn); k.meshes.forEach((im) => im.setMatrixAt(i, tmp)); },
      color(i, c) { body.forEach((im) => { if (im.userData.kind === 'city') im.setColorAt(i, c); }); },
      done() { all.forEach((im) => { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }); },
      show(on) { all.forEach((im) => { im.visible = on; }); },
    };
  }
  /* Geometry the same shape for merging: position, normal, color, mcol (and uv for signs), always indexed. */
  function same(g, kind, mtx) {
    const o = new THREE.BufferGeometry(); for (const a of ['position', 'normal', 'color', 'mcol']) o.setAttribute(a, g.attributes[a].clone());
    if (kind === 'sign') o.setAttribute('uv', g.attributes.uv ? g.attributes.uv.clone() : new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    o.setIndex(g.index ? Array.from(g.index.array) : [...Array(g.attributes.position.count).keys()]); if (mtx) o.applyMatrix4(mtx); return o;
  }
  const mergeKinds = (list) => { const out = {}; for (const k of KINDS) { const l = list.map((x) => x[k]).filter(Boolean); out[k] = l.length ? mergeGeometries(l, false) : null; } return out; };
  /** A model whose moving parts that always move together are merged into one part each (doors that slide
      the same way, the gates on one platform). parts: [{ name, key, open }]. Other parts stay where they are. */
  function grouped(model, parts) {
    const keys = {}; const rest = { ...(model.kids || {}) }; const body = [Object.fromEntries(KINDS.map((k) => [k, model.geo[k] ? same(model.geo[k], k) : null]))];
    for (const p of parts) { const kid = rest[p.name]; if (!kid) continue; delete rest[p.name]; const L = localOf(kid); (keys[p.key] = keys[p.key] || { open: p.open, list: [] }).list.push(Object.fromEntries(KINDS.map((k) => [k, kid.geo[k] ? same(kid.geo[k], k, L) : null]))); }
    const kids = {}; for (const [k, v] of Object.entries(keys)) kids[k] = { geo: mergeKinds(v.list), pos: [0, 0, 0], open: v.open };
    for (const [name, kid] of Object.entries(rest)) kids[name] = kid;
    return { ...model, geo: mergeKinds(body), kids };
  }
  /* ---------- everything that never moves: one mesh per material for the whole island ----------
     Each piece carries the number of the building it belongs to (grp), so the opening can still raise every
     building on its own (uRise), in the shader, and its shadow with it. */
  const statics = []; // [{ kind: geometry }]
  function toStatic(geo, mtx, grp = 0) {
    const part = {}; for (const k of KINDS) { const g = geo[k]; if (!g) continue; const o = same(g, k, mtx); o.setAttribute('grp', new THREE.BufferAttribute(new Float32Array(o.attributes.position.count).fill(grp), 1)); part[k] = o; } statics.push(part);
  }
  /** Put a model on the island for good: its body and every part not listed in `keep` (those move, or are drawn apart). */
  function putModel(model, mtx, grp = 0, keep = []) {
    toStatic(model.geo, mtx, grp); const L = new THREE.Matrix4();
    for (const [name, kid] of Object.entries(model.kids || {})) { if (keep.some((r) => (r instanceof RegExp ? r.test(name) : r === name))) continue; L.multiplyMatrices(mtx, localOf(kid)); toStatic(kid.geo, L, grp); }
  }
  const riseDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); riseDepth.defines = { RISE_N };
  riseDepth.onBeforeCompile = (sh) => { sh.uniforms.uRise = U.uRise; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float grp;\nuniform vec4 uRise[RISE_N];').replace('#include <begin_vertex>', `#include <begin_vertex>\n${RISE_GLSL}`); };
  riseDepth.customProgramCacheKey = () => 'island-rise-depth';
  const staticMeshes = [];
  function buildStatics() {
    const merged = mergeKinds(statics);
    for (const k of KINDS) { const g = merged[k]; if (!g || k === 'sign') continue; const m = new THREE.Mesh(g, makeMat(k, { rise: true })); m.castShadow = castsOf(k); m.receiveShadow = recvOf(k); if (castsOf(k)) m.customDepthMaterial = riseDepth; if (SEE[k]) m.renderOrder = SEE[k]; m.userData.kind = k; scene.add(m); staticMeshes.push(m); }
    statics.length = 0; return merged;
  }
  const M4 = new THREE.Matrix4(); const Q = new THREE.Quaternion(); const V = new THREE.Vector3(); const SC = new THREE.Vector3(); const E = new THREE.Euler(); const YAX = new THREE.Vector3(0, 1, 0);
  const mat4 = (x, y, z, yaw = 0, s = 1, pitch = 0, roll = 0) => M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(pitch, yaw, roll, 'YXZ')), SC.set(s, s, s));
  const yawTo = (dx, dz) => Math.atan2(dx, dz); // turn a model so its front (+Z) points along (dx, dz)
  // Things that move lie along X in the model files (and along Z in the stand-ins): alongX() tells which.
  const alongX = (m) => !!m && (m.def && m.def.forward ? /x/i.test(m.def.forward) : m.real && m.size[0] > m.size[2] * 1.3);
  /** A matrix for a thing heading along (fx, fz): nose `up` radians above level, leaning `bank` radians. */
  const heading = (m, x, y, z, fx, fz, s = 1, up = 0, bank = 0) => (alongX(m) ? mat4(x, y, z, yawTo(fx, fz) - Math.PI / 2, s, bank, up) : mat4(x, y, z, yawTo(fx, fz), s, -up, bank));
  const doorOf = (m, fallback) => (m.def && Array.isArray(m.def.door) ? m.def.door : fallback);
  const local = (o, dx, dz) => { const c = Math.cos(o.rotation.y); const sn = Math.sin(o.rotation.y); return { x: o.position.x + dx * c + dz * sn, z: o.position.z - dx * sn + dz * c }; };

  /* ---------- land ----------
     The ground is the plan's: its height everywhere, the shore, and the zones (beach, parks, the orchard, the
     meadow kept for a sixth town, the hill park) tinted into the grass. Squares, quays and plots are drawn on
     top as crisp shapes below. */
  const ZONES = LAYOUT.zones.map((z) => { let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity; for (const [x, zz] of z.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, zz); z1 = Math.max(z1, zz); } return { ...z, box: [x0, z0, x1, z1] }; });
  const ZRANK = { square: 9, port: 8, beach: 7, farm: 6, park: 5, future: 4, residential: 3, reserved: 2, project: 1, hill: 0 };
  function zoneAt(x, z) { let best = null; for (const q of ZONES) { if (x < q.box[0] || x > q.box[2] || z < q.box[1] || z > q.box[3]) continue; if ((ZRANK[q.use] ?? -1) <= (best ? ZRANK[best.use] ?? -1 : -2)) continue; if (pointInPoly([x, z], q.poly)) best = q; } return best; }
  {
    const step = phone ? 3.6 : 2.5; const x0 = HALF.cx - HALF.x - 70; const x1 = HALF.cx + HALF.x + 70; const z0 = HALF.cz - HALF.z - 70; const z1 = HALF.cz + HALF.z + 70;
    const nx = Math.ceil((x1 - x0) / step); const nz = Math.ceil((z1 - z0) / step); const pos = new Float32Array((nx + 1) * (nz + 1) * 3); const col = new Float32Array(pos.length); const mcol = new Float32Array(pos.length); const idx = []; const r = rng(3);
    const GRASS = [0.26, 0.49, 0.15]; const MOWN = [0.31, 0.55, 0.18]; const PARK = [0.29, 0.53, 0.17]; const WOOD = [0.18, 0.38, 0.12]; const MEADOW = [0.43, 0.53, 0.2]; const ORCH = [0.33, 0.47, 0.16]; const SAND = [0.86, 0.76, 0.53]; const WET = [0.66, 0.6, 0.45]; const STONE = [0.6, 0.59, 0.56]; const SEABED = [0.24, 0.52, 0.5];
    const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    let v = 0;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + i * step; const z = z0 + j * step; const y = height(x, z); pos.set([x, y, z], v * 3);
      const sd = shoreDistance(x, z); const soft = softShoreDistance(x, z); const hill = hillAmount(x, z); const n = 0.93 + r() * 0.14;
      let c; let m;
      if (y < 0.05) { const deep = smooth(0, 6, -y); c = mixc(WET, SEABED, deep); m = [0.78, 0.8, 0.8]; } // under the water: sand, then the sea bed
      else {
        const zq = zoneAt(x, z); const use = zq && zq.use;
        c = use === 'park' ? PARK : use === 'residential' ? MOWN : use === 'future' ? MEADOW : use === 'farm' ? (Math.sin((x * 0.7 + z * 0.7) * 0.9) > 0.2 ? ORCH : MOWN) : GRASS;
        c = mixc(c, WOOD, smooth(0.15, 0.8, hill) * 0.8);
        c = c.map((k) => k * n); m = [0.8, 0.8, 0.76];
        const quayside = sd < 6 && soft - sd > 4; // a built quay edge, not a natural shore
        if (use === 'port' || quayside) { c = STONE; m = [0.84, 0.83, 0.8]; }
        else if (use === 'beach' || soft < 14) { const t = use === 'beach' ? 1 : smooth(14, 7, soft); c = mixc(c, mixc(SAND, WET, smooth(2.2, 0, sd)), t); m = mixc(m, [0.85, 0.83, 0.77], t); }
      }
      col.set(c, v * 3); mcol.set(m, v * 3); v++;
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; const b = a + 1; const c = a + nx + 1; const d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('mcol', new THREE.BufferAttribute(mcol, 3)); g.setIndex(idx); g.computeVertexNormals();
    const land = new THREE.Mesh(g, MAT.matte); land.receiveShadow = true; scene.add(land);
  }
  /* metres to the shore for the sea's shader: a small picture of the plan's shore distance */
  const shoreTex = (() => { const step = 3; const x0 = HALF.cx - HALF.x - 120; const z0 = HALF.cz - HALF.z - 120; const w = Math.ceil((HALF.x * 2 + 240) / step); const h = Math.ceil((HALF.z * 2 + 240) / step); const a = new Uint16Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) a[j * w + i] = THREE.DataUtils.toHalfFloat(shoreDistance(x0 + i * step, z0 + j * step));
    const t = new THREE.DataTexture(a, w, h, THREE.RedFormat, THREE.HalfFloatType); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return { t, box: new THREE.Vector4(x0, z0, w * step, h * step) }; })();

  /* ---------- sea and sky ---------- */
  const NOISE = `float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5; float s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }`;
  const SU = { uT: { value: 0 }, uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() }, uSky: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uFogD: { value: 0.00016 }, uRough: { value: 1 }, uShore: { value: shoreTex.t }, uShoreBox: { value: shoreTex.box }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uNight: { value: 0 }, uCloud: { value: 0.5 } };
  const sea = new THREE.Mesh(new THREE.CircleGeometry(15500, 96).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: SU, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uT; uniform float uFogD; uniform float uRough; uniform float uNight; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSunCol; uniform vec3 uFog; uniform vec3 uSunDir; uniform vec4 uShoreBox; varying vec3 vW;
${NOISE}
uniform sampler2D uShore;
// the slope of one long swell: a sine wave travelling along dir
vec2 swell(vec2 p, vec2 dir, float len, float amp, float speed){ float k = 6.2832 / len; return dir * (k * amp * cos(dot(p, dir) * k + uT * speed)); }
float chop(vec2 p){ return vnoise(p * 0.11 + uT * vec2(0.42, 0.26)) * 0.55 + vnoise(p * 0.31 - uT * vec2(0.34, 0.5)) * 0.3 + vnoise(p * 0.83 + uT * vec2(0.7, -0.6)) * 0.15; }
void main(){
  vec2 p = vW.xz; vec2 st = (p - uShoreBox.xy) / uShoreBox.zw; vec2 out2 = max(max(-st, st - 1.0), 0.0) * uShoreBox.zw;
  float d = (-texture2D(uShore, clamp(st, 0.0, 1.0)).r + length(out2)) / 280.0;      // 0 at the shoreline, growing out to sea (in 280 m)
  float dist = length(cameraPosition - vW); vec3 V = (cameraPosition - vW) / dist;
  float calm = 1.0 / (1.0 + dist * 0.0016);                              // far away the waves blur together
  vec2 g = swell(p, vec2(0.86, 0.5), 58.0, 0.55, 0.8) + swell(p, vec2(-0.35, 0.94), 31.0, 0.3, 1.15) + swell(p, vec2(0.6, -0.8), 17.0, 0.16, 1.7);
  float c0 = chop(p); float e = 0.9; g += vec2(chop(p + vec2(e, 0.0)) - c0, chop(p + vec2(0.0, e)) - c0) * (2.6 / e);
  g *= uRough * calm * smoothstep(-0.01, 0.07, d) * 1.15 + 0.05;
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  // depth: pale turquoise over the sand, teal, then deep blue
  vec3 mid = mix(uShallow, uDeep, 0.6) * vec3(0.92, 1.06, 1.04);
  vec3 col = mix(uShallow, mid, smoothstep(0.0, 0.085, d)); col = mix(col, uDeep, smoothstep(0.06, 0.42, d)); col = mix(col, uDeep * 0.8, smoothstep(0.5, 3.5, d));
  float shallow = 1.0 - smoothstep(0.0, 0.12, d);
  col += uSunCol * shallow * pow(vnoise(p * 0.33 + uT * 0.45) * vnoise(p * 0.47 - uT * 0.33 + 9.0), 1.6) * 0.5 * (1.0 - uNight);   // light dancing on the sand
  // the sky in the water, stronger at a glancing angle
  vec3 R = reflect(-V, N); float up = clamp(R.y, 0.0, 1.0);
  vec3 skyCol = mix(uHor, uZen, pow(up, 0.55));
  float fres = 0.025 + 0.975 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  col = mix(col, skyCol, clamp(fres, 0.0, 1.0) * 0.88);
  float sd = max(dot(R, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 700.0) * 5.0 + pow(sd, 60.0) * 0.32 + pow(sd, 9.0) * 0.045);                                           // sun glitter
  // foam: a soft edge that laps in and out, and thin lines of surf further out
  float lap = sin(d * 190.0 - uT * 1.05 + vnoise(p * 0.035) * 6.0) * 0.5 + 0.5; float grain = 0.55 + 0.45 * vnoise(p * 0.9 + uT * 0.2);
  float foam = smoothstep(0.02, 0.002, d) * (0.4 + 0.6 * lap) * grain + smoothstep(0.075, 0.03, d) * smoothstep(0.84, 1.0, lap) * 0.38 * grain;
  col = mix(col, uFoam, clamp(foam, 0.0, 1.0));
  col = mix(col, uFog, 1.0 - exp(-uFogD * uFogD * dist * dist));
  gl_FragColor = vec4(col, mix(0.7, 1.0, smoothstep(0.0, 0.05, d)));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  }));
  sea.renderOrder = 1; scene.add(sea);
  /* The sky: a deep zenith fading to a pale hazy horizon, the sun's disc with its glow, clouds lit from the
     sun's side, stars at night. The same sky, with the island's ground below the horizon instead of the sea,
     lights and is reflected by everything (the environment map). */
  SU.uGround = { value: new THREE.Color('#5d6a4a') };
  const skyShader = (env) => new THREE.ShaderMaterial({
    uniforms: SU, side: THREE.BackSide, depthWrite: false, fog: false, defines: env ? { IS_ENV: 1 } : {},
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; uniform float uNight; uniform float uCloud; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSunCol; uniform vec3 uSunDir; uniform vec3 uFog; uniform vec3 uDeep; uniform vec3 uGround; varying vec3 vDir;
${NOISE}
void main(){
  vec3 d = normalize(vDir); float h = d.y; float sd = max(dot(d, uSunDir), 0.0);
  float up = clamp(h, 0.0, 1.0);
  vec3 col = mix(uHor, uZen, pow(up, 0.45));                                   // zenith to horizon
  col = mix(col, uFog * 1.04, exp(-up * 14.0) * 0.75);                          // the haze that sits on the horizon
  col += uSunCol * pow(sd, 6.0) * 0.18 * (1.0 - uNight) * (1.0 - up * 0.5);      // the sky brightens towards the sun
#ifdef IS_ENV
  col = mix(col, uGround * (0.55 + 0.45 * smoothstep(-0.6, 0.0, h)), smoothstep(0.0, -0.08, h)); // the island below
#else
  col = mix(col, uDeep * 1.3 + uFog * 0.12, smoothstep(-0.02, -0.3, h));
#endif
  col += uSunCol * (smoothstep(0.9993, 0.9997, sd) * 6.0 + pow(sd, 380.0) * 1.6 + pow(sd, 28.0) * 0.16) * (1.0 - uNight * 0.6) * step(-0.02, h);
  if (h > 0.01) {
    vec2 q = d.xz / (h + 0.12) * 1.3 + uT * vec2(0.004, 0.0015); float c = fbm(q) * 0.75 + fbm(q * 2.7 + 5.0) * 0.25;
    float m = smoothstep(0.48, 0.76, c) * uCloud * smoothstep(0.01, 0.2, h);
    float lit = 0.72 + 0.28 * smoothstep(0.55, 0.8, c - fbm(q + uSunDir.xz * 0.05) + 0.6) + pow(sd, 4.0) * 0.4;      // brighter on the side facing the sun
    vec3 cloud = mix(uHor * 0.9, vec3(1.0), 0.62) * lit * (1.0 - uNight * 0.86) + uSunCol * pow(sd, 8.0) * 0.3 * (1.0 - uNight);
    col = mix(col, cloud, m * 0.92);
#ifndef IS_ENV
    if (uNight > 0.5) { vec2 g = floor(d.xz / (h + 0.3) * 260.0); float s = hash(g); col += vec3(0.9, 0.95, 1.0) * step(0.9975, s) * (0.5 + 0.5 * hash(g + 3.0)) * (1.0 - m) * smoothstep(0.02, 0.3, h); }
#endif
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  const skyMat = skyShader(false);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(16000, 32, 16), skyMat); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 24, 12), skyShader(true)));
  const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null;

  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
  { const s = sun.shadow; s.mapSize.set(phone ? 2048 : 4096, phone ? 2048 : 4096); const c = s.camera; c.left = -470; c.right = 470; c.top = 470; c.bottom = -470; c.near = 100; c.far = 2400; c.updateProjectionMatrix(); s.bias = -0.0004; s.normalBias = 0.5; s.radius = 2.2; }
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 0.5); scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); scene.add(fill); // soft light from the far side, so shaded fronts are not flat

  /* ---------- ribbons: roads, the deck, rails ---------- */
  function ribbon(pts, width, top, bottom, { closed = false, caps = false } = {}) {
    const n = pts.length; const P = [];
    const yT = (p, sx, sz) => (typeof top === 'function' ? top(p.x + sx, p.z + sz) : top); const yB = (p, sx, sz) => (typeof bottom === 'function' ? bottom(p.x + sx, p.z + sz) : bottom);
    const sec = pts.map((p, i) => {
      const a = closed || i > 0 ? pts[(i - 1 + n) % n] : p; const b = closed || i < n - 1 ? pts[(i + 1) % n] : p;
      let dx = b.x - a.x; let dz = b.z - a.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; const sx = (-dz * width) / 2; const sz = (dx * width) / 2;
      return [[p.x - sx, yB(p, -sx, -sz), p.z - sz], [p.x + sx, yB(p, sx, sz), p.z + sz], [p.x + sx, yT(p, sx, sz), p.z + sz], [p.x - sx, yT(p, -sx, -sz), p.z - sz]];
    });
    const quad = (a, b, c, d) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); };
    for (let i = 0; i < (closed ? n : n - 1); i++) { const s = sec[i]; const t = sec[(i + 1) % n]; quad(s[3], s[2], t[2], t[3]); quad(s[2], s[1], t[1], t[2]); quad(s[0], s[3], t[3], t[0]); quad(s[1], s[0], t[0], t[1]); }
    if (caps && !closed) { const s = sec[0]; const t = sec[n - 1]; quad(s[0], s[1], s[2], s[3]); quad(t[1], t[0], t[3], t[2]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); return g;
  }
  const gy = (lift) => (x, z) => Math.max(0.2, height(x, z)) + lift;
  const fixed = new Kit(); // small fixed things made here (plots, kerbs): merged with everything else that never moves
  const P2 = (a) => ({ x: a[0], z: a[1] });

  /* ---------- roads and paths: the plan's, by rank ----------
     Each rank sits a few centimetres above the one below it, so where a street meets the coast road the street
     is drawn over it; every junction gets a round apron so corners are filled. The coast road and the main
     streets carry a dashed centre line. */
  const roadKit = new Kit();
  const RANK = { coast: 0.30, hill: 0.30, main: 0.33, street: 0.36, lane: 0.39 };
  {
    const ends = new Map(); const keyOf = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    LAYOUT.roads.forEach((r) => r.points.forEach((p, i) => { const k = keyOf(p); const e = ends.get(k) || { x: p[0], z: p[1], n: 0, w: 0, lift: 0, end: false }; e.n++; e.w = Math.max(e.w, r.width); e.lift = Math.max(e.lift, RANK[r.kind] || 0.3); if (!r.closed && (i === 0 || i === r.points.length - 1)) e.end = true; ends.set(k, e); }));
    for (const r of LAYOUT.roads) {
      const pts = r.points.map(P2); if (r.closed && pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].z - pts[pts.length - 1].z) < 0.05) pts.pop();
      const lift = RANK[r.kind] || 0.3; roadKit.add(ribbon(pts, r.width, gy(lift), gy(-1.2), { closed: !!r.closed }), 'road');
      if (r.kind === 'coast' || r.kind === 'main' || r.kind === 'hill') { // a dashed centre line, 3 m on, 5 m off
        let acc = 0; const N = r.closed ? pts.length : pts.length - 1;
        for (let i = 0; i < N; i++) { const a = pts[i]; const b = pts[(i + 1) % pts.length]; const L = Math.hypot(b.x - a.x, b.z - a.z); let t = 0; while (t < L) { const ph = acc % 8; const run = ph < 3 ? Math.min(3 - ph, L - t) : Math.min(8 - ph, L - t); if (ph < 3 && run > 0.4) { const p0 = { x: a.x + ((b.x - a.x) * t) / L, z: a.z + ((b.z - a.z) * t) / L }; const p1 = { x: a.x + ((b.x - a.x) * (t + run)) / L, z: a.z + ((b.z - a.z) * (t + run)) / L }; roadKit.add(ribbon([p0, p1], 0.2, gy(lift + 0.035), gy(lift)), 'white'); } t += run; acc += run; } }
      }
    }
    // aprons at junctions and rounded ends
    for (const e of ends.values()) if (e.n > 1 || e.end) { const g = new THREE.CylinderGeometry(e.w / 2, e.w / 2, 1.6, 28); g.translate(e.x, gy(e.lift)(e.x, e.z) - 0.8, e.z); roadKit.add(g, 'road', true); }
    // paths: footpaths and the promenade in pale paving, the boardwalk in timber, steps in stone
    const PATHC = { footpath: 'pave', promenade: 'pave', boardwalk: 'wood', steps: 'pave' };
    for (const pth of LAYOUT.paths) { const pts = pth.points.map(P2); if (pts.length < 2) continue; roadKit.add(ribbon(pts, pth.width, gy(0.22), gy(-0.8)), PATHC[pth.kind] || 'pave'); }
  }
  /* squares, the port's quays, the plots kept for the next projects, and the meadow kept for a sixth town */
  function flatPoly(poly, y, mat) { const c = poly.map(([x, z]) => new THREE.Vector2(x, z)); if (THREE.ShapeUtils.isClockWise(c)) c.reverse(); const tri = THREE.ShapeUtils.triangulateShape(c, []); const pos = []; tri.forEach((t) => t.forEach((i) => pos.push(c[i].x, y, c[i].y))); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const u = g.index ? g : g; const a = g.attributes.position; for (let i = 0; i < a.count; i += 3) { const ay = a.getZ(i); a.setZ(i, a.getZ(i + 2)); a.setZ(i + 2, ay); const ax = a.getX(i); a.setX(i, a.getX(i + 2)); a.setX(i + 2, ax); } roadKit.add(u, mat); }
  const centroid = (poly) => { let x = 0; let z = 0; poly.forEach((p) => { x += p[0]; z += p[1]; }); return { x: x / poly.length, z: z / poly.length }; };
  function kerbs(poly, y, mat = 'white', w = 0.5) { const pts = poly.map(P2); roadKit.add(ribbon(pts, w, y + 0.12, y - 0.3, { closed: true }), mat); }
  for (const z of LAYOUT.zones) {
    if (z.use === 'square') { const c = centroid(z.poly); const y = height(c.x, c.z) + 0.26; flatPoly(z.poly, y, 'pave'); kerbs(z.poly, y, 'pave', 0.6); }
    else if (z.use === 'port') { const c = centroid(z.poly); flatPoly(z.poly, height(c.x, c.z) + 0.12, 'ballast'); }
  }
  for (const lot of LAYOUT.lots) if (lot.use === 'reserved') { const c = centroid(lot.poly); const y = height(c.x, c.z) + 0.1; flatPoly(lot.poly, y, 'plot'); kerbs(lot.poly, y, 'white', 0.35); /* a plot kept for the town's next project: mown, edged in white */ }
  if (LAYOUT.nextTown && LAYOUT.nextTown.site) { const c = centroid(LAYOUT.nextTown.site); kerbs(LAYOUT.nextTown.site, height(c.x, c.z) + 0.05, 'fence', 0.3); }
  // the quay walls: straight stone faces down into the water
  if (LAYOUT.island.quay && LAYOUT.island.quay.length > 1) roadKit.add(ribbon(LAYOUT.island.quay.map(P2), 1.4, PLATEAU + 0.12, -3), 'pave');

  /* ---------- the lane ----------
     There is no track. The trains fly along an invisible lane marked by small soft lights, one line for each
     direction, with floating ring gates along it. THIS is the one piece of code that draws what the trains
     run on, from the route in track.js: swap it to change how the line looks. The lane is faint by day and
     glows at night; it brightens ahead of each train, and all of it brightens when the visitor points at the
     line (laneGlow). The hill tram's lane is drawn the same way. */
  const DECK = LANE_Y; const TRAIN_Y = DECK; /* a docked train's origin sits exactly on the stations' rail level */ const laneU = { uLit: U.uLit, uAll: { value: 0 }, uPx: { value: 1 }, uTex: { value: glowTex() } };
  const laneMat = () => new THREE.ShaderMaterial({ uniforms: laneU, transparent: true, depthWrite: false,
    vertexShader: 'attribute float boost; attribute float size; uniform float uPx; uniform float uLit; uniform float uAll; varying float vB; void main(){ vB = max(boost, uAll); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(size * uPx * (1.0 + vB * 0.9 + uLit * 0.5) * 420.0 / -mv.z, 1.5, 22.0); }',
    fragmentShader: 'uniform sampler2D uTex; uniform float uLit; varying float vB; void main(){ float a = texture2D(uTex, gl_PointCoord).a; vec3 c = mix(vec3(0.16, 0.78, 1.0), vec3(0.82, 0.97, 1.0), a * a) * (1.0 + uLit * 2.2 + vB * (1.2 + uLit)); gl_FragColor = vec4(c, a * (0.34 + 0.5 * uLit + 0.5 * vB)); }' });
  const lanes = []; // { s: Float32Array of distances, dir, boost attribute }
  function dots(pts, dirOf) { const n = pts.length; const pos = new Float32Array(n * 3); const size = new Float32Array(n).fill(1); pts.forEach((q, i) => pos.set([q.x, q.y, q.z], i * 3)); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('boost', new THREE.BufferAttribute(new Float32Array(n), 1)); g.setAttribute('size', new THREE.BufferAttribute(size, 1)); const m = new THREE.Points(g, laneMat()); m.frustumCulled = false; m.renderOrder = 2; scene.add(m); return { g, dir: dirOf, s: pts.map((q) => q.s) }; }
  function drawGuideway() {
    for (const dir of [1, -1]) { const pts = []; for (let s = 0; s < LOOP_LEN; s += 3.2) { const q = trackAt(s, laneOf(dir)); pts.push({ x: q.x, y: TRAIN_Y - 0.5, z: q.z, s }); } lanes.push(dots(pts, dir)); }
    // the floating ring gates: where the plan puts them
    const at = placementsOf('gate'); if (!at.length) return;
    const groupsBy = {}; at.forEach((g) => { (groupsBy[g.model] = groupsBy[g.model] || []).push(g); });
    for (const [name, list] of Object.entries(groupsBy)) { const rm = getModel(name, () => null); if (!rm) continue; const rings = inst(rm, list.length, { cast: false }); list.forEach((g, i) => rings.set(i, M4.compose(V.set(g.x, g.y != null ? g.y : TRAIN_Y + ((rm.def && rm.def.aboveDatum) || 1.97), g.z), Q.setFromAxisAngle(YAX, g.rot), SC.set(g.scale || 1, g.scale || 1, g.scale || 1)))); rings.done(); }
  }
  function drawTramway() {
    for (const side of [1, -1]) { const pts = []; for (let i = 0; i <= 64; i++) { const q = tramAt(i / 64, side); pts.push({ x: q.x, y: q.y - 0.4, z: q.z, s: i / 64 }); } tramLanes.push(dots(pts, side)); }
  }
  const tramLanes = [];
  /** Brighten the lane ahead of every train (and the tram's lane ahead of each pod). */
  function lightLanes(sim) {
    for (const L of lanes) { const b = L.g.attributes.boost; for (let i = 0; i < L.s.length; i++) { let v = 0; for (const t of sim.trains) { if (t.dir !== L.dir) continue; const d = ((L.s[i] - t.s) * t.dir % LOOP_LEN + LOOP_LEN) % LOOP_LEN; if (d < 110) v = Math.max(v, 1 - d / 110); } b.array[i] = v; } b.needsUpdate = true; }
    for (const L of tramLanes) { const b = L.g.attributes.boost; const u = sim.tramU(L.dir); const up = (L.dir > 0 ? sim.tram.dir : -sim.tram.dir) >= 0 ? 1 : -1; for (let i = 0; i < L.s.length; i++) { const d = (L.s[i] - u) * up; b.array[i] = sim.tram.move && d > 0 && d < 0.5 ? 1 - d / 0.5 : 0; } b.needsUpdate = true; }
  }

  /* ---------- the towns: a station, its square, and the town's buildings, where the plan puts them ---------- */
  const stops = []; const towns = []; const byId = {}; const riseGroups = []; const spinners = []; const proxies = []; const boards = [];
  /* things the hero camera must see past: boxes (buildings, stations, houses) and balls (tree crowns) */
  const occluders = [];
  const addBox = (id, x, y, z, w, h, d, yaw) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)); occluders.push({ id, box: true, inv: m.clone().invert(), half: [w / 2, h / 2, d / 2], x, z }); };
  /* the soft dark where things meet the ground (contact shade): one instanced decal for all of it */
  const contact = [];
  // the moving bits of a building (a crane's jib) rise with it; everything else of it rises in the shader
  const riser = (order) => { const g = new THREE.Group(); g.userData.order = order; scene.add(g); riseGroups.push(g); return g; };
  const slotOf = (order) => (order < 0 ? 1 : 2 + order); // uRise: 1 = the stations and what stands with them, 2 + i = project i
  const slotPivot = { 1: [0, 0, 0, true] };
  function addProxy(target, x, y, z, w, h, d, yaw) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y + h / 2, z); m.rotation.y = yaw; m.updateMatrixWorld(true); m.userData.target = target; proxies.push(m); }
  const levelName = (n) => ['', 'Lot', 'Site', 'Open', 'Live', 'Thriving'][n];
  const SCALE = LAYOUT.scale; const dummy = new THREE.Object3D();
  const matOf = (x, y, z, yaw, s = 1) => { dummy.position.set(x, y, z); dummy.rotation.set(0, yaw, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); return dummy.matrix.clone(); };
  const strip = (model, name) => name.replace(`${model.name}_`, '');
  const boxOf = (model, s = 1) => { const mn = (model.def && model.def.min) || [-model.size[0] / 2, 0, -model.size[2] / 2]; const mx = (model.def && model.def.max) || [model.size[0] / 2, model.size[1], model.size[2] / 2]; return { cx: ((mn[0] + mx[0]) / 2) * s, cz: ((mn[2] + mx[2]) / 2) * s, w: (mx[0] - mn[0]) * s, d: (mx[2] - mn[2]) * s, h: mx[1] * s }; };
  /* the box of a building's mass: what stands above its paving and lawn (the hero camera frames this, not the plot) */
  const massCache = new Map();
  function massOf(model) { // the middle 90% of everything above 1.3 m, so a lamp post or a flag at the plot's corner does not count
    if (massCache.has(model.name)) return massCache.get(model.name); const xs = []; const zs = []; let y1 = 0;
    const scan = (geo, L) => { for (const k of KINDS) { const g = geo[k]; if (!g) continue; const a = g.attributes.position; for (let i = 0; i < a.count; i++) { V.fromBufferAttribute(a, i); if (L) V.applyMatrix4(L); if (V.y < 1.3) continue; xs.push(V.x); zs.push(V.z); y1 = Math.max(y1, V.y); } } };
    scan(model.geo); Object.values(model.kids || {}).forEach((k) => scan(k.geo, localOf(k)));
    let out = null; if (xs.length > 8) { xs.sort((a, b) => a - b); zs.sort((a, b) => a - b); const q = (arr, f) => arr[Math.floor(f * (arr.length - 1))]; const x0 = q(xs, 0.05); const x1 = q(xs, 0.95); const z0 = q(zs, 0.05); const z1 = q(zs, 0.95); out = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: y1 }; }
    massCache.set(model.name, out); return out; }
  const atLocal = (x, z, rot, lx, lz) => ({ x: x + lx * Math.cos(rot) + lz * Math.sin(rot), z: z - lx * Math.sin(rot) + lz * Math.cos(rot) });

  /* Station name boards and next-train boards. The station models carry blank panels (child nodes
     <station>_sign_n and _board_n, one quad each with 0-1 UVs); every panel on the island is drawn from one
     picture (an atlas), so all the signs are one draw call and all the boards another. */
  const signJobs = []; const boardJobs = []; const signGeos = []; const boardGeos = [];
  function panelOf(model, kidName, mtx, list, job) { const kid = model.kids && model.kids[strip(model, kidName)]; if (!kid || !kid.geo.sign) return false; const L = new THREE.Matrix4().multiplyMatrices(mtx, localOf(kid)); toStatic({ ...kid.geo, sign: null }, L, 1); const g = same(kid.geo.sign, 'sign', L); unmirror(g); list.push({ g, job }); return true; }
  /* A panel must read left to right from its front: if its u runs the wrong way round its face, turn it. */
  function unmirror(g) { const Pp = g.attributes.position; const T = g.attributes.uv; const I = g.index.array; if (I.length < 3) return; const [a, b, c] = [I[0], I[1], I[2]]; const p0 = new THREE.Vector3().fromBufferAttribute(Pp, a); const e1 = new THREE.Vector3().fromBufferAttribute(Pp, b).sub(p0); const e2 = new THREE.Vector3().fromBufferAttribute(Pp, c).sub(p0); const du1 = T.getX(b) - T.getX(a); const dv1 = T.getY(b) - T.getY(a); const du2 = T.getX(c) - T.getX(a); const dv2 = T.getY(c) - T.getY(a); const det = du1 * dv2 - du2 * dv1; if (Math.abs(det) < 1e-9) return; const uDir = e1.clone().multiplyScalar(dv2).sub(e2.clone().multiplyScalar(dv1)).divideScalar(det); const vDir = e2.clone().multiplyScalar(du1).sub(e1.clone().multiplyScalar(du2)).divideScalar(det); const n = e1.clone().cross(e2); if (uDir.cross(vDir).dot(n) < 0) for (let i = 0; i < T.count; i++) T.setX(i, 1 - T.getX(i)); }

  const stationPlaces = [];
  PLACES.forEach((place, pi) => {
    const town = TOWNS.find((t) => t.id === place.id) || { code: place.code, name: place.id }; const pt = LAYOUT.towns.find((t) => t.id === place.id); const st0 = pt.station;
    const color = DCOL[town.district] || '#16171A'; const t = trackAt(place.s); const g0 = Math.max(0.2, height(st0.x, st0.z)); const rise = DECK - g0;
    let model = getModel(st0.model || (town.main ? 'station_main' : 'station'), null); if (!model) { const key = `standin_station${town.main ? '_main' : ''}`; if (!cache.has(key)) { cache.set(key, standStation(!!town.main, rise)); used.stand.push(st0.model); } model = cache.get(key); }
    const deckTop = model.def && model.def.track && model.def.track.deckTop; const yaw = st0.rot; const sy = deckTop ? DECK - deckTop : g0;
    const st = { position: new THREE.Vector3(st0.x, sy, st0.z), rotation: { y: yaw } }; const mtx = matOf(st0.x, sy, st0.z, yaw);
    putModel(model, mtx, 1, [/^gate_/, /^sign_/, /^board_/]);
    // which of the model's platforms the clockwise trains use: its +z side when +z faces inland
    const cwPlus = Math.sin(yaw) * t.nx + Math.cos(yaw) * t.nz > 0; const sx = Math.cos(yaw) * t.tx - Math.sin(yaw) * t.tz > 0 ? 1 : -1;
    const bx = boxOf(model); const c0 = atLocal(st0.x, st0.z, yaw, bx.cx, bx.cz);
    addProxy(place.id, c0.x, g0, c0.z, bx.w, rise + 9, Math.min(bx.d, 40), yaw); addBox(place.id, c0.x, g0, c0.z, bx.w + 2, (model.def && model.def.max ? model.def.max[1] : 18) + sy - g0, bx.d, yaw); contact.push({ x: c0.x, z: c0.z, y: g0, w: bx.w, d: bx.d, yaw, k: 0.5 });
    const sq = pt.square && pt.square.length ? centroid(pt.square) : { x: t.x + t.nx * 40, z: t.z + t.nz * 40 }; const cy = Math.max(0.2, height(sq.x, sq.z));
    const ex = (pt.station.exits || []).find((e) => e.side === 'town') || (pt.station.exits || [])[0];
    const info = { id: place.id, town: true, code: town.code, name: town.name, s: place.s, x: t.x, z: t.z, y: DECK, g0, nx: t.nx, nz: t.nz, tx: t.tx, tz: t.tz, cx: sq.x, cz: sq.z, cy, bx: sq.x, bz: sq.z, by: cy, size: [bx.w, rise + 9, bx.d], color, kids: [], fx: -t.nx, fz: -t.nz, yaw, mtx, cwPlus, square: pt.square };
    info.st = st; info.entrance = ex ? { x: ex.at[0], z: ex.at[1] } : null;
    towns.push(info); byId[place.id] = info; stationPlaces.push({ model, mtx, info });
    // the panels: name boards on each platform, the entrance sign, the hill pod's sign; next-train boards
    const prev = TOWNS.find((q) => q.id === PLACES[(pi - 1 + PLACES.length) % PLACES.length].id); const next = TOWNS.find((q) => q.id === PLACES[(pi + 1) % PLACES.length].id);
    const pivots = (model.def && model.def.pivots) || {};
    ((model.def && model.def.signs) || []).forEach((sg) => {
      const pv = pivots[sg.name] || [0, 12, 0]; const f = (sg.facing || [0, 0, 1])[2] >= 0 ? 1 : -1; const high = pv[1] > 9;
      const kind = high ? 'platform' : f > 0 ? 'entrance' : 'pod'; const rightIsNext = f * sx > 0; // seen from its front, is clockwise on the right?
      panelOf(model, sg.name, mtx, signGeos, { kind, code: town.code, name: town.name, color, left: rightIsNext ? prev : next, right: rightIsNext ? next : prev, aspect: sg.size[0] / sg.size[1] });
    });
    ((model.def && model.def.boards) || []).forEach((bd) => { const pv = pivots[bd.name] || [0, 0, 1]; const lane = (pv[2] >= 0) === cwPlus ? 1 : -1; panelOf(model, bd.name, mtx, boardGeos, { id: place.id, lane, to: lane > 0 ? next : prev, aspect: bd.size[0] / bd.size[1] }); });
  });
  /* The platform gates: the six on one platform slide together, so each platform's gates are one part, and
     every station of a kind shares them in a few instanced draw calls. */
  const gateSets = {};
  stationPlaces.forEach((sp) => { const m = sp.model; if (!m.def || !m.def.gates) return; if (!gateSets[m.name]) { const parts = m.def.gates.map((g) => ({ name: strip(m, g.name), key: /\+/.test(g.side) ? 'plus' : 'minus', open: g.open })); gateSets[m.name] = { model: grouped({ ...m, geo: {}, kids: Object.fromEntries(parts.map((p) => [p.name, m.kids[p.name]]).filter((x) => x[1])) }, parts), list: [] }; } sp.gate = { set: gateSets[m.name], i: gateSets[m.name].list.length }; gateSets[m.name].list.push(sp); });
  Object.values(gateSets).forEach((gs) => { gs.im = inst(gs.model, gs.list.length, { cast: false }); gs.list.forEach((sp, i) => gs.im.set(i, sp.mtx)); gs.im.done(); });

  /* every project's building, on its plot, facing where the plan turns it */
  const rowOf = Object.fromEntries(PROJECTS.map((r, i) => [r.id, { ...r, i }]));
  placementsOf('building').forEach((pl) => {
    const row = rowOf[pl.project]; if (!row) return; const T = byId[pl.town] || towns[0]; const level = (levels && levels[row.id]) || pl.level || 3;
    const district = (TOWNS.find((t) => t.id === pl.town) || {}).district;
    let model = lib && lib.get(pl.model); if (model) { if (!cache.has(model.name)) { cache.set(model.name, model); used.real.push(model.name); if (level >= 3) tintGeo(model.geo, lin(DCOL[district] || '#D5281E')); } } else model = getModel(pl.model, () => (level <= 1 ? standLot(district) : level === 2 ? standSite(/large/.test(pl.model)) : standBuilding({ ...row, district }, level)));
    const group = riser(row.i); const sc = pl.scale || SCALE; const by = Math.max(0.2, height(pl.x, pl.z)); const yaw = pl.rot; const mtx = matOf(pl.x, by, pl.z, yaw, sc);
    const slot = slotOf(row.i); slotPivot[slot] = [pl.x, by, pl.z, false];
    putModel(model, mtx, slot, ['jib']);
    if (model.kids && model.kids.jib) { const j = spawn({ geo: {}, kids: { jib: model.kids.jib } }); j.position.set(pl.x, by, pl.z); j.rotation.y = yaw; j.scale.setScalar(sc); group.add(j); spinners.push({ o: j.userData.kids.jib, kind: 'jib', seed: row.i * 1.7 }); }
    const size = [model.size[0] * sc, model.size[1] * sc, model.size[2] * sc]; const bx = boxOf(model, sc); const ctr = atLocal(pl.x, pl.z, yaw, bx.cx, bx.cz);
    const door = pl.door ? { x: pl.door[0], z: pl.door[1] } : atLocal(pl.x, pl.z, yaw, 0, bx.d / 2);
    addProxy(row.id, ctr.x, by, ctr.z, bx.w, Math.max(8, size[1]), Math.min(bx.d, 70), yaw); addBox(row.id, ctr.x, by, ctr.z, bx.w, size[1], bx.d, yaw); contact.push({ x: ctr.x, z: ctr.z, y: by, w: bx.w, d: bx.d, yaw, k: 0.55 });
    const ms = massOf(model); const mc = ms ? atLocal(pl.x, pl.z, yaw, ms.cx * sc, ms.cz * sc) : ctr; const mass = ms ? { x: mc.x, z: mc.z, w: ms.w * sc, d: ms.d * sc, h: ms.h * sc } : { x: ctr.x, z: ctr.z, w: bx.w, d: bx.d, h: size[1] };
    const info = { id: row.id, i: row.i, town: false, townId: T.id, x: T.x, z: T.z, bx: pl.x, bz: pl.z, by, size, fx: Math.sin(yaw), fz: Math.cos(yaw), yaw, cx: ctr.x, cz: ctr.z, W: bx.w, D: bx.d, mass, level, color: DCOL[district] || '#16171A', group, real: model.real, door };
    stops.push(info); byId[row.id] = info; T.kids.push(info);
  });
  stops.sort((a, b) => a.i - b.i);
  drawGuideway();

  /* ---------- the panels, drawn ---------- */
  function atlas(jobs, slotW, slotH, cols) { const rows = Math.max(1, Math.ceil(jobs.length / cols)); const c = document.createElement('canvas'); c.width = slotW * cols; c.height = slotH * rows; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; return { c, tex, slotW, slotH, cols, rows }; }
  function slotRect(A, i) { const col = i % A.cols; const row = Math.floor(i / A.cols); const x = col * A.slotW; const y = row * A.slotH; return { x, y, u0: x / A.c.width, u1: (x + A.slotW) / A.c.width, v0: 1 - (y + A.slotH) / A.c.height, v1: 1 - y / A.c.height }; }
  function panelMesh(list, A, mat) { if (!list.length) return null; list.forEach((it, i) => { const r = slotRect(A, i); it.r = r; const uv = it.g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, r.u0 + uv.getX(k) * (r.u1 - r.u0), r.v0 + uv.getY(k) * (r.v1 - r.v0)); }); const m = new THREE.Mesh(mergeGeometries(list.map((x) => x.g), false), mat); m.renderOrder = 1; m.userData.panels = list; scene.add(m); return m; }
  const FONT = '"Public Sans", "Helvetica Neue", Arial, sans-serif';
  /** Draw in a slot as if it had the panel's own shape, so the letters are not stretched. */
  function inSlot(A, it, draw) { const x = A.c.getContext('2d'); const r = it.r; x.save(); x.beginPath(); x.rect(r.x, r.y, A.slotW, A.slotH); x.clip(); x.translate(r.x, r.y); const k = (A.slotW / A.slotH) / (it.job.aspect || A.slotW / A.slotH); x.scale(k, 1); draw(x, A.slotW / k, A.slotH); x.restore(); }
  function roundel(x, cx, cy, r, code, color, ink = '#16171a') { x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.fillStyle = '#fff'; x.fill(); x.lineWidth = r * 0.2; x.strokeStyle = color; x.stroke(); x.fillStyle = ink; x.font = `800 ${Math.round(r * 0.92)}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(code, cx, cy + r * 0.04); }
  function fitText(x, text, max, size, weight) { let s = size; do { x.font = `${weight} ${Math.round(s)}px ${FONT}`; s *= 0.94; } while (x.measureText(text).width > max && s > 8); }
  let signAtlas = null; let boardAtlas = null; let signMat = null; let signMesh = null; let boardMesh = null;
  function buildPanels() { // after everything with a panel is placed
    signAtlas = atlas(signGeos, phone ? 512 : 1024, phone ? 96 : 192, 2); boardAtlas = atlas(boardGeos, phone ? 256 : 512, phone ? 64 : 128, 2);
    signMat = new THREE.MeshBasicMaterial({ map: signAtlas.tex }); const boardMat = new THREE.MeshBasicMaterial({ map: boardAtlas.tex, toneMapped: false });
    signMesh = panelMesh(signGeos, signAtlas, signMat); boardMesh = panelMesh(boardGeos, boardAtlas, boardMat); drawSigns();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawSigns(); boardGeos.forEach((it) => { it.text = ''; }); boardClock = -9; });
  }
  function drawSigns() {
    signGeos.forEach((it) => inSlot(signAtlas, it, (x, w, h) => {
      const j = it.job; x.fillStyle = '#fbfaf7'; x.fillRect(0, 0, w, h); x.fillStyle = j.kind === 'pod' ? '#D5281E' : j.color; x.fillRect(0, h * 0.86, w, h * 0.14); x.lineWidth = 2; x.strokeStyle = '#d9d7d0'; x.strokeRect(1, 1, w - 2, h - 2);
      const pad = h * 0.12; const R = h * 0.33; roundel(x, pad + R, h * 0.43, R, j.kind === 'pod' && /^K/.test(j.code) ? TRAM_STOPS[0].code : j.code, j.kind === 'pod' ? '#D5281E' : j.color);
      const tx = pad * 2 + R * 2; x.fillStyle = '#16171a'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      if (j.kind === 'platform') {
        fitText(x, j.name, w - tx - pad, h * 0.4, 800); x.fillText(j.name, tx, h * 0.5);
        x.fillStyle = '#55564f'; fitText(x, 'x', w, h * 0.19, 600); x.fillText(`← ${j.left.code} ${j.left.name}`, tx, h * 0.76); x.textAlign = 'right'; x.fillText(`${j.right.name} ${j.right.code} →`, w - pad, h * 0.76);
      } else if (j.kind === 'entrance') {
        fitText(x, j.name, w - tx - pad, h * 0.44, 800); x.fillText(j.name, tx, h * 0.52); x.fillStyle = '#55564f'; fitText(x, 'x', w, h * 0.19, 600); x.fillText(`Metro · ${j.code} · trains both ways`, tx, h * 0.77);
      } else {
        const top = j.kind === 'ferry' ? 'Ferry' : j.code === TRAM_STOPS[1].code ? `${owner}’s tower` : `Hill pod to ${owner}’s tower`;
        const sub = j.kind === 'ferry' ? 'Boarding on the jetty' : j.code === TRAM_STOPS[1].code ? `Hill pod · ${TRAM_STOPS[1].code} → ${TRAM_STOPS[0].code} ${TRAM_STOPS[0].name}` : `${TRAM_STOPS[0].code} ${TRAM_STOPS[0].name} → ${TRAM_STOPS[1].code} ${TRAM_STOPS[1].name}`;
        x.fillStyle = '#16171a'; fitText(x, top, w - tx - pad, h * 0.4, 800); x.fillText(top, tx, h * 0.5); x.fillStyle = '#55564f'; fitText(x, sub, w - tx - pad, h * 0.19, 600); x.fillText(sub, tx, h * 0.77);
      }
    }));
    signAtlas.tex.needsUpdate = true;
  }
  const fmtEta = (sec) => (sec < 8 ? 'now' : sec < 50 ? `${Math.round(sec / 5) * 5} s` : `${Math.round(sec / 60)} min`); let boardClock = -9;
  function drawBoards(sim) {
    let changed = false;
    boardGeos.forEach((it) => {
      const n = sim.nextAt(it.job.id); const list = (it.job.lane > 0 ? n.cwAll : n.acwAll) || [it.job.lane > 0 ? n.cw : n.acw]; const text = `${it.job.to.name}|${list.map(fmtEta).join('|')}`; if (text === it.text) return; it.text = text; changed = true;
      inSlot(boardAtlas, it, (x, w, h) => {
        x.fillStyle = '#121316'; x.fillRect(0, 0, w, h); const pad = h * 0.1; x.textBaseline = 'middle';
        x.fillStyle = '#f5f4f0'; x.textAlign = 'left'; fitText(x, `For ${it.job.to.code} ${it.job.to.name}`, w * 0.66, h * 0.3, 700); x.fillText(`For ${it.job.to.code} ${it.job.to.name}`, pad, h * 0.3);
        x.fillStyle = '#ffd58a'; x.textAlign = 'right'; x.font = `700 ${Math.round(h * 0.3)}px ${FONT}`; x.fillText(fmtEta(list[0]), w - pad, h * 0.3);
        x.fillStyle = '#9a9b96'; x.textAlign = 'left'; x.font = `600 ${Math.round(h * 0.22)}px ${FONT}`; x.fillText(list[1] != null ? 'Then' : 'Every train calls here', pad, h * 0.72); if (list[1] != null) { x.textAlign = 'right'; x.fillText(fmtEta(list[1]), w - pad, h * 0.72); }
      });
    });
    if (changed) boardAtlas.tex.needsUpdate = true;
  }
  const gateK = new THREE.Matrix4();
  function setStations(sim) {
    stationPlaces.forEach((sp) => { if (!sp.gate) return; for (const lane of [1, -1]) { let k = 0; for (const t of sim.trains) if (t.at === sp.info.id && !t.move && laneOf(t.dir) === lane) k = Math.max(k, t.doors); const key = (lane > 0) === sp.info.cwPlus ? 'plus' : 'minus'; const o = (sp.gate.set.model.kids[key] || {}).open || [0, 0, 0]; sp.gate.set.im.kid(key, sp.gate.i, sp.mtx, gateK.makeTranslation(o[0] * k, o[1] * k, o[2] * k)); } }); // the platform gates open with the train's doors
    Object.values(gateSets).forEach((gs) => gs.im.done());
    if (clock - boardClock < 1) return; boardClock = clock; drawBoards(sim);
  }

  /* ---------- Kevin's tower and the hill pod ---------- */
  const towerGroup = riser(PROJECTS.length + 1);
  const towerModel = getModel('tower', () => standTower(200)); if (towerModel.real) { tintGeo(towerModel.geo, [0.80, 0.11, 0.08]); Object.values(towerModel.kids).forEach((k) => tintGeo(k.geo, [0.80, 0.11, 0.08])); }
  // the tower's shell is lit from below at night: its own copy of the city and pearl materials, with an emissive warmth
  const towerMat = twoLooks(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: (LM.city || SPEC.city).roughness, metalness: 0, envMapIntensity: 0.55, emissive: 0xffa24d, emissiveIntensity: 0 }), 'city');
  const towerPearl = twoLooks(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: (LM.pearl || SPEC.pearl).roughness, metalness: 0, envMapIntensity: 1, emissive: 0xffa24d, emissiveIntensity: 0 }), 'pearl');
  const TW = TOWER_AT; const towerY = height(TW.x, TW.z); const tower = spawn(towerModel); tower.traverse((o) => { if (o.isMesh && (o.material === MAT.city || o.material === MAT.pearl)) o.material = o.material === MAT.pearl ? towerPearl : towerMat; }); tower.position.set(TW.x, towerY, TW.z); tower.rotation.y = TW.rot; towerGroup.add(tower);
  const towerH = towerModel.size[1]; const towerTop = towerY + (towerModel.real ? towerH - 28 : towerH);
  addProxy('tower', TW.x, towerY, TW.z, 30, towerH * 0.8, 30, 0); addProxy('tower', TW.x, towerY, TW.z, 12, towerH + 20, 12, 0); addBox('tower', TW.x, towerY, TW.z, 26, towerTop - towerY, 26, 0); addBox('tower', TW.x, towerY, TW.z, 58, 12, 58, 0); contact.push({ x: TW.x, z: TW.z, y: towerY, w: 40, d: 40, yaw: 0, k: 0.45, round: true });
  byId.tower = { id: 'tower', x: TW.x, z: TW.z, y: towerY, bx: TW.x, bz: TW.z, by: towerY, size: [44, towerH, 44], color: '#D5281E', fx: Math.sin(TW.rot), fz: Math.cos(TW.rot) };
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff3b24, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.position.set(TW.x, towerTop + 28, TW.z); halo.scale.setScalar(70); scene.add(halo);
  const uplight = new THREE.PointLight(0xffb060, 0, 300, 1.6); uplight.position.set(TW.x + 20, towerY + 26, TW.z + 30); scene.add(uplight);
  drawTramway();
  /* the stops along the pod line and the other small stations the plan places: the pod's dock at the tower, the ferry terminal */
  placementsOf('station').filter((pl) => !pl.town || !LAYOUT.towns.some((t) => t.station.model === pl.model && t.id === pl.town)).forEach((pl) => {
    const m = lib && lib.get(pl.model); if (!m) return; used.real.push(pl.model); const y = Math.max(0, height(pl.x, pl.z)); const pod = pl.model === 'tram_stop'; const stop = pod ? LAYOUT.pod.stops.reduce((b, q) => (!b || Math.hypot(q.x - pl.x, q.z - pl.z) < Math.hypot(b.x - pl.x, b.z - pl.z) ? q : b), null) : null;
    const mtx = matOf(pl.x, pod && stop ? stop.y : y, pl.z, pl.rot); putModel(m, mtx, pod ? slotOf(PROJECTS.length + 1) : 1, [/^sign_/]);
    ((m.def && m.def.signs) || []).forEach((sg) => panelOf(m, sg.name, mtx, signGeos, pod ? { kind: 'pod', code: (stop && stop.code) || TRAM_STOPS[1].code, name: TRAM_STOPS[1].name, color: '#D5281E', aspect: sg.size[0] / sg.size[1] } : { kind: 'ferry', code: 'F', name: 'Ferry', color: '#16171A', aspect: sg.size[0] / sg.size[1] }));
    const b = boxOf(m); const c = atLocal(pl.x, pl.z, pl.rot, b.cx, b.cz); addBox(pl.model, c.x, y, c.z, b.w, 6, b.d, pl.rot);
  });
  if (pl0Ok('tram_stop')) slotPivot[slotOf(PROJECTS.length + 1)] = [TW.x, towerY, TW.z, false];
  function pl0Ok(name) { return placementsOf('station').some((p) => p.model === name); }
  { // the pod's lane is single except where the two pods pass: single floating rings mark it there
    const rm = lib && lib.get('lane_ring');
    if (rm) { used.real.push('lane_ring'); const at = [0.08, 0.18, 0.82, 0.92]; const im = inst(rm, at.length, { cast: false }); at.forEach((u, i) => { const p = tramAt(u); im.set(i, M4.compose(V.set(p.x, p.y + ((rm.def && rm.def.aboveDatum) || 1.97), p.z), Q.setFromEuler(E.set(0, yawTo(p.ux, p.uz) - Math.PI / 2, p.slope, 'YXZ')), SC.set(1, 1, 1))); }); im.done(); }
  }
  /* Doors: the leaves on one side that slide the same way are one part (models.js keeps them apart). */
  const doorParts = (m) => ((m.def && m.def.doors) || []).map((d) => ({ name: strip(m, d.name), key: `${/\+/.test(d.side) ? 'p' : 'm'}${d.open[0] + d.open[1] + d.open[2] > 0 ? '+' : '-'}`, open: d.open }));
  const tramModel = getModel('tram', standTram); const tramLong = alongX(tramModel); const tramG = grouped(tramModel, doorParts(tramModel));
  const tramI = inst(tramG, 2); const doorT = new THREE.Matrix4();
  const tramCars = [1, -1].map((side) => { const c = new THREE.Object3D(); c.userData.side = side; return c; });
  function openDoors(im, i, model, m, k, flip = false) { for (const [key, kid] of Object.entries(model.kids)) { if (!kid.open) continue; const right = key[0] === 'p' ? !flip : flip; const kk = right ? k : 0; im.kid(key, i, m, doorT.makeTranslation(kid.open[0] * kk, kid.open[1] * kk, kid.open[2] * kk)); } }
  function setTram(sim, time = 0) {
    tramCars.forEach((c, i) => {
      const u = sim.tramU(c.userData.side); const p = tramAt(u, c.userData.side); c.position.set(p.x, p.y + (tramModel.real ? 0 : 1.4) + Math.sin(time * 1.5 + c.userData.side) * 0.07 * (sim.tram.move ? 1 : 0.3), p.z); c.rotation.set(0, 0, 0); c.rotation.order = 'YXZ';
      c.rotation.y = yawTo(p.ux, p.uz) + (tramLong ? -Math.PI / 2 : 0); if (tramLong) c.rotation.z = p.slope * 0.85; else c.rotation.x = -p.slope * 0.85;
      c.updateMatrix(); c.matrixWorld.copy(c.matrix); tramI.set(i, c.matrix); openDoors(tramI, i, tramG, c.matrix, sim.tram.doors || 0); // both sides open at the stops
      for (const [key, kid] of Object.entries(tramG.kids)) if (kid.open && key[0] === 'm') tramI.kid(key, i, c.matrix, doorT.makeTranslation(kid.open[0] * (sim.tram.doors || 0), kid.open[1] * (sim.tram.doors || 0), kid.open[2] * (sim.tram.doors || 0)));
    });
    tramI.done();
  }

  /* ---------- the trains: three cars each, two sets each way, all drawn instanced ---------- */
  const carEnd = getModel('train_end', () => standCar(true)); const carMid = getModel('train_mid', () => standCar(false));
  const carLong = alongX(carEnd); const CAR_LEN = (carEnd.def && carEnd.def.pitch) || ((carEnd.def && carEnd.def.length) || LOOP.car) + 0.5; const NCAR = LOOP.cars; const NT = LOOP.trainsEachWay * 2;
  const gEnd = grouped(carEnd, doorParts(carEnd)); const gMid = grouped(carMid, doorParts(carMid));
  const endI = inst(gEnd, NT * Math.min(2, NCAR)); const midI = NCAR > 2 ? inst(gMid, NT * (NCAR - 2)) : null;
  const trainSets = []; // one set of cars per train in the sim, made on the first frame
  function makeTrain(i, dir) {
    let e = 0; let mi = 0;
    const cars = Array.from({ length: NCAR }, (_, k) => { const end = k === 0 || k === NCAR - 1; const o = new THREE.Object3D(); o.rotation.order = 'YXZ'; o.userData = { off: ((NCAR - 1) / 2 - k) * CAR_LEN * dir, flip: k === NCAR - 1 && NCAR > 1 ? Math.PI : 0, im: end ? endI : midI, model: end ? gEnd : gMid, idx: end ? i * 2 + e++ : i * (NCAR - 2) + mi++ }; return o; });
    return { cars, dir, mid: cars[Math.floor(NCAR / 2)] };
  }
  const under = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0x58d8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), NT * NCAR + 2); under.frustumCulled = false; under.renderOrder = 2; scene.add(under);
  function setTrains(sim, time = 0) {
    let n = 0;
    sim.trains.forEach((t, i) => {
      if (!trainSets[i]) trainSets[i] = makeTrain(i, t.dir); const set = trainSets[i]; const lane = laneOf(t.dir); const sp = Math.min(1, Math.abs(t.v) / 6);
      set.cars.forEach((c, k) => {
        const q = trackAt(t.s + c.userData.off, lane); const q2 = trackAt(t.s + c.userData.off + 6 * t.dir, lane); const turn = (q.tx * q2.tz - q.tz * q2.tx) * t.dir; // how hard the lane bends here
        const y = TRAIN_Y + 0.28 * sp + Math.sin(time * 1.7 + i * 2.1 + k * 0.9) * 0.06 * sp; // floats, and settles a little at a platform
        c.position.set(q.x, y, q.z); c.rotation.set(0, 0, 0); c.rotation.y = yawTo(q.tx * t.dir, q.tz * t.dir) + c.userData.flip + (carLong ? -Math.PI / 2 : 0);
        const lean = clamp(turn * Math.abs(t.v) * 0.035, -0.12, 0.12) * (c.userData.flip ? -1 : 1); if (carLong) c.rotation.x = lean; else c.rotation.z = lean; // leans into the curve
        c.updateMatrix(); c.matrixWorld.copy(c.matrix); c.userData.im.set(c.userData.idx, c.matrix);
        openDoors(c.userData.im, c.userData.idx, c.userData.model, c.matrix, t.doors, !!c.userData.flip); // only the platform side opens
        under.setMatrixAt(n++, M4.compose(V.set(q.x, y - 0.25, q.z), Q.setFromAxisAngle(YAX, yawTo(q.tx, q.tz)), SC.set(4.6, 1, CAR_LEN + 2)));
      });
    });
    endI.done(); if (midI) midI.done();
    tramCars.forEach((c) => under.setMatrixAt(n++, M4.compose(V.set(c.position.x, c.position.y - 0.3, c.position.z), Q.identity(), SC.set(5, 1, 5))));
    under.count = n; under.instanceMatrix.needsUpdate = true; under.material.opacity = 0.22 + 0.5 * U.uLit.value;
  }

  /* ---------- houses, trees, lamps, benches, the beach, the lighthouse: every one where the plan puts it ---------- */
  const R = rng(7); const pick = (a) => a[Math.floor(R() * a.length)];
  function instAll(kind, { cast = true, skin = null, each = null } = {}) {
    const by = {}; placementsOf(kind).forEach((p) => { (by[p.model] = by[p.model] || []).push(p); }); const out = [];
    for (const [name, list] of Object.entries(by)) { const m = prop(name); if (!m) continue; const im = inst(m, list.length, { cast, skin }); list.forEach((p, i) => { const y = p.y != null ? p.y : Math.max(0, height(p.x, p.z)); im.set(i, mat4(p.x, y, p.z, p.rot, p.scale || 1)); if (each) each(im, i, p, m, y); }); im.done(); out.push({ name, list, im, m }); }
    return out;
  }
  const houseSets = instAll('house', { each: (im, i, p, m, y) => { addBox('house', p.x, y, p.z, m.size[0] * (p.scale || 1), m.size[1] * (p.scale || 1), m.size[2] * (p.scale || 1), p.rot); contact.push({ x: p.x, z: p.z, y, w: m.size[0], d: m.size[2], yaw: p.rot, k: 0.45 }); } });
  const houseOrder = houseSets.flatMap((s) => s.list.map((p, i) => ({ s, p, i, at: sOfPoint(p.x, p.z) }))).sort((a, b) => a.at - b.at);
  function setHouses(k) { // k: 0 none … 1 all, in order round the loop
    const n = houseOrder.length; houseOrder.forEach((h, o) => { const g = clamp(k * (n + 5) - o, 0, 1); const sc = (g <= 0 ? 0.0001 : backOut(Math.min(1, g))) * (h.p.scale || 1); h.s.im.set(h.i, M4.compose(V.set(h.p.x, Math.max(0, height(h.p.x, h.p.z)), h.p.z), Q.setFromAxisAngle(YAX, h.p.rot), SC.set(sc, sc, sc))); }); houseSets.forEach((s) => s.im.done());
  }
  const treeSpots = []; const tc = new THREE.Color();
  instAll('tree', { skin: MAT.tree, each: (im, i, p, m, y) => { const s = p.scale || 1; occluders.push({ id: 'tree', ball: true, x: p.x, y: y + m.size[1] * s * 0.62, z: p.z, r: Math.max(m.size[0], m.size[2]) * 0.5 * s * 0.8 }); treeSpots.push({ x: p.x, z: p.z, y, r: Math.max(m.size[0], m.size[2]) * 0.5 * s }); const tone = 0.84 + R() * 0.28; im.color(i, tc.setRGB(tone, tone * (0.96 + R() * 0.08), tone * 0.92)); } });
  const lampSpots = []; instAll('lamp', { cast: false, each: (im, i, p, m, y) => lampSpots.push({ x: p.x, z: p.z, y, yaw: p.rot }) });
  instAll('bench', { cast: false });
  { const cols = ['#D5281E', '#E0A800', '#1F4FD8', '#F4F4F2', '#E8731A']; const c = new THREE.Color(); instAll('beach', { cast: true, each: (im, i, p, m) => { if (!m.real && p.model === 'umbrella') im.color(i, c.set(cols[i % cols.length])); } }); }
  const pools = new THREE.InstancedMesh(new THREE.CircleGeometry(11, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xffc27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), Math.max(1, lampSpots.length));
  lampSpots.forEach((l, i) => pools.setMatrixAt(i, mat4(l.x + Math.sin(l.yaw) * 2, l.y + 0.5, l.z + Math.cos(l.yaw) * 2))); pools.frustumCulled = false; pools.visible = false; pools.renderOrder = 2; scene.add(pools);
  const LH = placementsOf('landmark').find((p) => p.model === 'lighthouse') || { x: HALF.cx + HALF.x, z: 0, rot: 0 };
  const lightPos = { x: LH.x, z: LH.z }; const lightY = Math.max(0, height(LH.x, LH.z));
  const lhM = getModel('lighthouse', () => standProp('lighthouse')); putModel(lhM, matOf(LH.x, lightY, LH.z, LH.rot), 0, ['lamp']); addBox('lighthouse', LH.x, lightY, LH.z, 8, 32, 8, 0);
  const lighthouse = spawn({ geo: {}, kids: lhM.kids && lhM.kids.lamp ? { lamp: lhM.kids.lamp } : {} }); lighthouse.position.set(LH.x, lightY, LH.z); lighthouse.rotation.y = LH.rot; scene.add(lighthouse);
  const lampKid = lighthouse.userData.kids.lamp; const lampY = lampKid ? lampKid.position.y : 29;
  const beam = new THREE.Group(); beam.position.set(lightPos.x, lightY + lampY, lightPos.z); scene.add(beam);
  { const g = new THREE.CylinderGeometry(0.4, 7, 150, 20, 1, true).rotateZ(Math.PI / 2).translate(75, 0, 0); /* a slim beam that fades out over the sea */ const m = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }); const a = new THREE.Mesh(g, m); const b = new THREE.Mesh(g, m); b.rotation.y = Math.PI; beam.add(a, b); beam.userData.mat = m; beam.visible = false; }

  /* contact shade: a soft dark footprint under every building, station, house and tree, where it meets the ground */
  {
    const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.filter = 'blur(14px)'; x.fillStyle = '#000'; x.beginPath(); x.roundRect(26, 26, 76, 76, 18); x.fill(); const t = new THREE.CanvasTexture(c); return t; })();
    const round = glowTex(); treeSpots.forEach((t) => contact.push({ x: t.x, z: t.z, y: t.y, w: t.r * 1.1, d: t.r * 1.1, yaw: 0, k: 0.2, round: true }));
    for (const [list, map] of [[contact.filter((c) => !c.round), tex], [contact.filter((c) => c.round), round]]) {
      if (!list.length) continue; const m = new THREE.MeshBasicMaterial({ color: 0x0b1206, alphaMap: map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float shade; varying float vShade;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvShade = shade;'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vShade;').replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= vShade;'); };
      const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); g.setAttribute('shade', new THREE.InstancedBufferAttribute(new Float32Array(list.map((c) => c.k)), 1));
      const im = new THREE.InstancedMesh(g, m, list.length); list.forEach((c, i) => { const pad = c.round ? 1 : 1.5; im.setMatrixAt(i, M4.compose(V.set(c.x, Math.max(0.05, c.y) + 0.09, c.z), Q.setFromAxisAngle(YAX, c.yaw), SC.set(c.w * pad + 3, 1, c.d * pad + 3))); }); im.frustumCulled = false; im.renderOrder = 1; scene.add(im);
    }
  }

  // everything that never moves, all at once: one mesh per material
  toStatic(fixed.geo(), new THREE.Matrix4(), 0);
  buildStatics(); buildPanels();
  { const r = roadKit.geo(); for (const k of KINDS) if (r[k]) { const rm = new THREE.Mesh(r[k], MAT.matte); rm.receiveShadow = true; scene.add(rm); } }

  /* ---------- island life ---------- */
  let wakeMat = null; const life = []; const extras = [{ id: 'x:lighthouse', name: 'Lighthouse', r: 13, d: 120, at: () => [lightPos.x, lightY + 14, lightPos.z] }];
  /* Cars and buses drive the plan's road network and keep to the right. At every junction a car may turn
     into another road; at a dead end it turns round. Buses run the coast road and wait at each town's stop. */
  {
    const SP = LAYOUT.spawns || {}; const allowed = new Set((SP.cars && SP.cars.roads) || LAYOUT.roads.filter((r) => r.kind !== 'lane').map((r) => r.id));
    const RD = LAYOUT.roads.map((r) => { const pts = r.points.map(P2); if (r.closed && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].z - pts[pts.length - 1].z) < 0.05) pts.pop(); return { ...r, pts }; });
    const kk = (p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`; const at = new Map(); RD.forEach((r) => r.pts.forEach((p, i) => { const k = kk(p); if (!at.has(k)) at.set(k, []); at.get(k).push({ r, i }); }));
    const names = ['car_a', 'car_b', 'car_c'].filter((n) => prop(n)); const tints = ['#F4F4F2', '#CC1F1A', '#1F4DB3', '#F2BC1A', '#33363C', '#2E8B6B', '#F4F4F2']; const c = new THREE.Color();
    const pool = RD.filter((r) => allowed.has(r.id) && r.pts.length > 1); const lenOf = (r) => r.pts.reduce((a, p, i) => (i ? a + Math.hypot(p.x - r.pts[i - 1].x, p.z - r.pts[i - 1].z) : 0), 0);
    const weight = pool.map(lenOf); const wsum = weight.reduce((a, b) => a + b, 0); const pickRoad = () => { let v = R() * wsum; for (let i = 0; i < pool.length; i++) { v -= weight[i]; if (v <= 0) return pool[i]; } return pool[0]; };
    const coastR = RD.find((r) => r.kind === 'coast') || pool[0];
    const list = []; const nCars = (SP.cars && SP.cars.count) || LIFE.cars || 30; const nBus = (SP.buses && SP.buses.count) || 2;
    for (let k = 0; k < nCars; k++) { const r = pickRoad(); list.push({ r, i: Math.floor(R() * (r.pts.length - 1)), f: R(), dir: R() < 0.5 ? 1 : -1, v: 8 + R() * 5, name: pick(names), tint: pick(tints) }); }
    const stopsAt = ((SP.buses && SP.buses.stops) || []).map((s) => ({ x: s.at[0], z: s.at[1] }));
    for (let k = 0; k < nBus; k++) list.push({ r: coastR, i: Math.floor((coastR.pts.length * k) / nBus), f: 0, dir: k % 2 ? -1 : 1, v: 9, name: 'bus', bus: true, wait: 0, last: -1 });
    const sets = {}; ['car_a', 'car_b', 'car_c', 'bus'].forEach((n) => { const mine = list.filter((x) => x.name === n); if (!mine.length) return; const m = prop(n); const im = inst(m, mine.length); mine.forEach((x, i) => { x.i2 = i; x.im = im; x.m = m; if (!m.real && n !== 'bus') im.color(i, c.set(x.tint)); }); sets[n] = im; });
    const nextIdx = (x) => { const n = x.r.pts.length; let j = x.i + x.dir; if (x.r.closed) j = (j + n) % n; else if (j < 0 || j >= n) { x.dir = -x.dir; j = x.i + x.dir; } return j; };
    life.push((dt) => {
      list.forEach((x) => {
        if (x.wait > 0) { x.wait -= dt; } else {
          let j = nextIdx(x); let a = x.r.pts[x.i]; let b = x.r.pts[j]; let L = Math.hypot(b.x - a.x, b.z - a.z) || 0.01; x.f += (x.v * dt) / L;
          let guard = 0;
          while (x.f >= 1 && guard++ < 8) {
            x.f = (x.f - 1) * L; x.i = j; const n = x.r.pts.length; const endHere = !x.r.closed && (x.i === 0 || x.i === n - 1);
            const turns = x.bus ? [] : (at.get(kk(x.r.pts[x.i])) || []).filter((o) => o.r !== x.r && allowed.has(o.r.id) && o.r.pts.length > 1);
            if (turns.length && (endHere || R() < 0.45)) { const o = turns[Math.floor(R() * turns.length)]; x.r = o.r; x.i = o.i; const m2 = o.r.pts.length; x.dir = o.r.closed ? (R() < 0.5 ? 1 : -1) : o.i === 0 ? 1 : o.i === m2 - 1 ? -1 : (R() < 0.5 ? 1 : -1); }
            else if (endHere) x.dir = -x.dir; // a dead end: turn round
            if (x.bus) { const p = x.r.pts[x.i]; const si = stopsAt.findIndex((s) => Math.hypot(s.x - p.x, s.z - p.z) < 14); if (si >= 0 && si !== x.last) { x.last = si; x.wait = 4; } }
            j = nextIdx(x); a = x.r.pts[x.i]; b = x.r.pts[j]; L = Math.hypot(b.x - a.x, b.z - a.z) || 0.01; x.f /= L;
          }
        }
        const j = nextIdx(x); const a = x.r.pts[x.i]; const b = x.r.pts[j]; const L = Math.hypot(b.x - a.x, b.z - a.z) || 0.01; const fx = (b.x - a.x) / L; const fz = (b.z - a.z) / L; const f = clamp(x.f, 0, 1);
        const off = x.r.width * 0.25; const px = a.x + (b.x - a.x) * f - fz * off; const pz = a.z + (b.z - a.z) * f + fx * off; // keep right: the right of heading (fx, fz) is (-fz, fx)
        const lift = (RANK[x.r.kind] || 0.3) + 0.02; const y = Math.max(0.2, height(px, pz)) + lift; const y2 = Math.max(0.2, height(px + fx * 3, pz + fz * 3)) + lift;
        x.im.set(x.i2, heading(x.m, px, y, pz, fx, fz, 1, Math.atan2(y2 - y, 3)));
      });
      Object.values(sets).forEach((im) => im.done());
    });
  }
  // boats: moored in the harbour where the plan puts them, a few more sailing out at sea, and the ferry on its run
  { const SB = (LAYOUT.spawns && LAYOUT.spawns.boats) || {};
    const wakeTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(32, 0); x.lineTo(64, 256); x.lineTo(46, 256); x.lineTo(32, 40); x.lineTo(18, 256); x.lineTo(0, 256); x.closePath(); x.fill(); x.globalAlpha = 0.35; x.beginPath(); x.moveTo(32, 0); x.lineTo(46, 256); x.lineTo(18, 256); x.closePath(); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const moored = placementsOf('boat').filter((p) => p.model !== 'ferry'); const sailing = [];
    if (SB.sail && SB.sail.area) for (let i = 0; i < 3; i++) sailing.push({ model: 'boat_sail', c: SB.sail.area.centre, r: SB.sail.area.radius * (0.45 + R() * 0.5), w: (0.05 + R() * 0.04) * (R() < 0.5 ? -1 : 1), a: R() * 6.28 });
    if (SB.fishing && SB.fishing.area) sailing.push({ model: 'boat_fishing', c: SB.fishing.area.centre, r: SB.fishing.area.radius * 0.6, w: 0.03, a: R() * 6.28 });
    const all = [...moored.map((p) => ({ ...p, moored: true, ph: R() * 6 })), ...sailing.map((b) => ({ ...b, ph: R() * 6 }))];
    const byM = {}; all.forEach((b) => { (byM[b.model] = byM[b.model] || []).push(b); }); Object.entries(byM).forEach(([n, l]) => { const m = prop(n); const im = inst(m, l.length, { cast: false }); l.forEach((b, i) => { b.im = im; b.i = i; b.m = m; }); });
    const NW = all.length + 1; wakeMat = new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, opacity: 0.55, depthWrite: false }); const wakes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), wakeMat, NW); wakes.frustumCulled = false; wakes.renderOrder = 2; scene.add(wakes);
    const wake = (k, x, z, fx, fz, wide, long) => wakes.setMatrixAt(k, M4.compose(V.set(x, 0.07, z), Q.setFromAxisAngle(YAX, yawTo(-fx, -fz)), SC.set(Math.max(0.01, wide), 1, Math.max(0.01, long))));
    const FP = placementsOf('boat').find((p) => p.model === 'ferry'); const ferryM = prop('ferry'); const ferry = spawn(ferryM, { cast: false }); scene.add(ferry);
    const route = (() => { const r = (SB.ferry && SB.ferry.route) || (FP ? [[FP.x, FP.z], [FP.x - 150, FP.z + 60]] : [[0, 260], [0, 400]]); const out = []; for (const p of r) { if (out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1)) break; out.push(p); } return out.map(P2); })();
    const rl = [0]; for (let i = 1; i < route.length; i++) rl.push(rl[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z)); const RL = rl[rl.length - 1] || 1;
    const onRoute = (d) => { d = clamp(d, 0, RL); let i = 1; while (i < rl.length - 1 && rl[i] < d) i++; const a = route[i - 1]; const b = route[i] || a; const f = (d - rl[i - 1]) / (rl[i] - rl[i - 1] || 1); return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, fx: (b.x - a.x) / ((rl[i] - rl[i - 1]) || 1), fz: (b.z - a.z) / ((rl[i] - rl[i - 1]) || 1) }; };
    const FERRY = { dwell: 12, turn: 6, v: 7 }; const run = RL / FERRY.v; const cycle = 2 * (FERRY.dwell + run + FERRY.turn); let fyaw = FP ? FP.rot : 0;
    all.forEach((b, k) => { if (!b.moored) extras.push({ id: `x:boat${k}`, name: b.model === 'boat_sail' ? 'Sailing boat' : 'Fishing boat', r: 8, d: 75, at: () => [b.x || 0, 3, b.z || 0] }); });
    extras.push({ id: 'x:ferry', name: 'Ferry', r: 16, d: 150, at: () => [ferry.position.x, 5, ferry.position.z] });
    life.push((dt, t) => {
      all.forEach((b, k) => {
        let x; let z; let fx; let fz; let sp = 0;
        if (b.moored) { x = b.x; z = b.z; fx = Math.sin(b.rot); fz = Math.cos(b.rot); if (alongX(b.m)) { fx = Math.cos(b.rot); fz = -Math.sin(b.rot); } }
        else { b.a += b.w * dt; x = b.c[0] + Math.cos(b.a) * b.r; z = b.c[1] + Math.sin(b.a) * b.r; fx = -Math.sin(b.a) * Math.sign(b.w); fz = Math.cos(b.a) * Math.sign(b.w); b.x = x; b.z = z; sp = Math.abs(b.w) * b.r; }
        wake(k, x - fx * 3, z - fz * 3, fx, fz, sp ? 5 + sp * 0.6 : 0.01, sp ? 10 + sp * 3 : 0.01);
        b.im.set(b.i, heading(b.m, x, Math.sin(t * 1.1 + b.ph) * 0.2 - (b.m.real ? 0 : 0.15), z, fx, fz, b.m.real ? 1 : 1.4, Math.sin(t * 0.9 + b.ph) * 0.03, Math.sin(t * 0.7 + b.ph) * (b.moored ? 0.03 : 0.06)));
      });
      Object.values(byM).forEach((l) => l[0].im.done());
      // the ferry: waits at the pier, sails out along its route, turns, waits, sails back, turns
      const u = t % cycle; let d = 0; let want = null; let sp = 0;
      if (u < FERRY.dwell) { d = 0; } else if (u < FERRY.dwell + run) { d = (u - FERRY.dwell) * FERRY.v; sp = FERRY.v; } else if (u < FERRY.dwell + run + FERRY.turn) { d = RL; } else if (u < 2 * FERRY.dwell + run + FERRY.turn) { d = RL; } else if (u < 2 * FERRY.dwell + 2 * run + FERRY.turn) { d = RL - (u - 2 * FERRY.dwell - run - FERRY.turn) * FERRY.v; sp = -FERRY.v; } else d = 0;
      const q = onRoute(d); if (sp > 0) want = Math.atan2(q.fx, q.fz); else if (sp < 0) want = Math.atan2(-q.fx, -q.fz); else if (u >= FERRY.dwell + run && u < FERRY.dwell + run + FERRY.turn) want = Math.atan2(-q.fx, -q.fz); else if (u >= 2 * FERRY.dwell + 2 * run + FERRY.turn) want = Math.atan2(q.fx, q.fz);
      if (want != null) { let dd = want - fyaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); fyaw += dd * Math.min(1, dt * 0.9); }
      ferry.position.set(q.x, Math.sin(t * 0.8) * 0.2 - (ferryM.real ? 0 : 0.3), q.z); ferry.rotation.y = fyaw + (alongX(ferryM) ? -Math.PI / 2 : 0);
      { const hx = Math.sin(fyaw); const hz = Math.cos(fyaw); const k = Math.min(1, Math.abs(sp) / FERRY.v); wake(NW - 1, q.x - hx * 14, q.z - hz * 14, hx, hz, 16 * k, 90 * k); wakes.instanceMatrix.needsUpdate = true; }
    });
  }
  // gulls circling, dolphins jumping, sheep and deer in their fields, dogs running: in the plan's areas
  { const AN = Object.fromEntries(((LAYOUT.spawns && LAYOUT.spawns.animals) || []).map((a) => [a.model, a])); const areas = (n) => (AN[n] && AN[n].areas && AN[n].areas.length ? AN[n].areas : [{ centre: [0, 0], radius: 30 }]); const count = (n, d) => (AN[n] ? AN[n].count : d);
    const gm = prop('gull'); const gullX = alongX(gm); const NG = count('gull', 14); const gulls = inst(gm, NG, { cast: false }); const turn = new THREE.Matrix4(); const body = new THREE.Matrix4();
    const G = []; for (let i = 0; i < NG; i++) { const a = areas('gull')[i % areas('gull').length]; const yr = a.y || [20, 40]; G.push({ x: a.centre[0], z: a.centre[1], r: a.radius * (0.3 + R() * 0.6), y: yr[0] + R() * (yr[1] - yr[0]), w: (0.22 + R() * 0.2) * (R() < 0.5 ? -1 : 1), ph: R() * 6.28, fl: 5 + R() * 3 }); }
    const dm = prop('dolphin'); const ND = count('dolphin', 3); const dol = inst(dm, ND, { cast: false }); const Dn = []; for (let i = 0; i < ND; i++) { const a = areas('dolphin')[i % areas('dolphin').length]; Dn.push({ c: a.centre, r: a.radius, t0: R() * 5, per: 4.6 + R() * 2.4, a0: R() * 6.28 }); }
    const walkers = [];
    const herd = (name, skin, v, s, small) => { const m = prop(name); const n = count(name, 3); const im = inst(m, n, { skin }); for (let i = 0; i < n; i++) { const a = areas(name)[i % areas(name).length]; const ang = R() * 6.28; const rr = a.radius * Math.sqrt(R()) * 0.6; walkers.push({ im, m, i, x: a.centre[0] + Math.cos(ang) * rr, z: a.centre[1] + Math.sin(ang) * rr, r: small ? 4 + R() * 4 : Math.min(a.radius * 0.35, 2.5 + R() * 4), v, ph: R() * 6.28, s, eight: small }); } return im; };
    const sheep = herd('sheep', MAT.matte, 0.35, 1.7); const de = herd('deer', MAT.matte, 0.5, 1.7); const dg = herd('dog', MAT.matte, 3.4, 1.6, true);
    life.push((dt, t) => {
      G.forEach((g, i) => { const a = g.ph + t * g.w; const x = g.x + Math.cos(a) * g.r; const z = g.z + Math.sin(a) * g.r; const dir = Math.sign(g.w); body.copy(heading(gm, x, g.y + Math.sin(t * 0.5 + g.ph) * 3, z, -Math.sin(a) * dir, Math.cos(a) * dir, 2.2, 0, -0.35 * dir)); gulls.set(i, body); const f = Math.sin(t * g.fl + g.ph) * 0.55; if (gullX) { gulls.kid('wing_l', i, body, turn.makeRotationX(f)); gulls.kid('wing_r', i, body, turn.makeRotationX(-f)); } else { gulls.kid('wing_l', i, body, turn.makeRotationZ(-f)); gulls.kid('wing_r', i, body, turn.makeRotationZ(f)); } });
      gulls.done();
      Dn.forEach((d, i) => { const k = ((t + d.t0) % d.per) / 1.5; const lap = Math.floor((t + d.t0) / d.per); const a = d.a0 + lap * 1.3; const px = d.c[0] + Math.cos(a) * d.r * 0.6; const pz = d.c[1] + Math.sin(a) * d.r * 0.6; const fx = -Math.sin(a); const fz = Math.cos(a); if (k >= 1) dol.set(i, mat4(px, -9, pz, 0, 0.001)); else dol.set(i, heading(dm, px + fx * k * 6, Math.sin(Math.PI * k) * 3.6 - 1.4, pz + fz * k * 6, fx, fz, 1.7, Math.cos(Math.PI * k) * 0.95)); });
      dol.done();
      walkers.forEach((w) => { const a = w.ph + (t * w.v) / w.r; const x = w.x + Math.cos(a) * w.r; const z = w.z + (w.eight ? Math.sin(a * 2) * w.r * 0.5 : Math.sin(a) * w.r); const dx = -Math.sin(a); const dz = w.eight ? Math.cos(a * 2) : Math.cos(a); w.im.set(w.i, heading(w.m, x, Math.max(0, height(x, z)), z, dx, dz, w.s)); });
      sheep.done(); de.done(); dg.done();
    });
  }

  /* ---------- rain ---------- */
  const rainU = { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uA: { value: 0.5 } };
  const rain = (() => {
    const n = 5200; const seed = new Float32Array(n * 2 * 3); const tip = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const a = Math.random(); const b = Math.random(); const c = Math.random(); for (let k = 0; k < 2; k++) { seed.set([a, b, c], (i * 2 + k) * 3); tip[i * 2 + k] = k; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(seed, 3)); g.setAttribute('tip', new THREE.BufferAttribute(tip, 1));
    const m = new THREE.ShaderMaterial({ uniforms: rainU, transparent: true, depthWrite: false,
      vertexShader: 'attribute float tip; uniform float uT; uniform vec3 uC; varying float vA; void main(){ vec3 p = position * vec3(640.0, 300.0, 640.0); p.y = mod(p.y - uT * 210.0 * (0.8 + position.x * 0.4), 300.0); p.xz = mod(p.xz - uC.xz + 320.0, 640.0) - 320.0 + uC.xz; p.y += uC.y - 120.0 + tip * 6.0; p.x += tip * 0.9; vA = 1.0 - tip * 0.7; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform float uA; varying float vA; void main(){ gl_FragColor = vec4(0.86, 0.9, 0.96, uA * vA); }' });
    const l = new THREE.LineSegments(g, m); l.frustumCulled = false; l.visible = false; l.renderOrder = 3; scene.add(l); return l;
  })();

  function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.42)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

  /* ---------- hover ring ---------- */
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, fog: false }));
  ring.visible = false; ring.renderOrder = 5; scene.add(ring);
  let hovered = null;
  function hover(id) { if (id === hovered) return; hovered = id; const p = id && byId[id]; ring.visible = !!p; if (!p) return; ring.position.set(p.bx, p.by + 1.2, p.bz); ring.scale.setScalar(Math.max(p.size[0], p.size[2]) * 0.62 + 8); ring.material.color.set(state.look === 'model' ? '#16171A' : '#ffffff'); }

  /* ---------- look, time of day, weather ---------- */
  const state = { look: 'film', time: 'day', weather: 'clear' };
  const cA = new THREE.Color(); const cB = new THREE.Color();
  function applySky() {
    const T = TIMES[state.time]; const rainy = state.weather === 'rain'; const foggy = state.weather === 'fog'; const grey = rainy ? 0.62 : foggy ? 0.5 : 0; const night = state.time === 'night';
    const zen = cA.set(T.zen).clone(); const hor = cB.set(T.hor).clone(); const g = new THREE.Color(night ? '#1b2233' : '#aab4bd');
    zen.lerp(g, grey * 0.9); hor.lerp(g.clone().multiplyScalar(night ? 1 : 1.12), grey);
    const dir = new THREE.Vector3(Math.sin(T.az * D2R) * Math.cos(T.el * D2R), Math.sin(T.el * D2R), -Math.cos(T.az * D2R) * Math.cos(T.el * D2R));
    const sunI = T.sunI * (rainy ? 0.28 : foggy ? 0.5 : 1);
    sun.color.set(T.sun).lerp(new THREE.Color('#dfe6ee'), grey * 0.8); sun.intensity = sunI; sunDir.copy(dir); if (typeof fitShadow === 'function') { try { fitShadow(true); } catch (e) { sun.position.copy(dir).multiplyScalar(1300); } }
    hemi.color.copy(zen).lerp(new THREE.Color(night ? '#6f8fe0' : '#fff6ea'), night ? 0.5 : 0.78); fill.color.copy(sun.color).lerp(new THREE.Color('#ffffff'), 0.5); fill.intensity = sunI * (night ? 0.3 : 0.2); fill.position.set(-dir.x, 0.45, -dir.z).multiplyScalar(1000); hemi.groundColor.set(night ? '#18243a' : '#6f7d5c'); hemi.intensity = T.amb * (night ? 0.5 : 0.36) * (rainy ? 1.5 : 1);
    const fogC = hor.clone().lerp(zen, night ? 0.2 : 0.42); scene.fog.color.copy(fogC); scene.fog.density = 0.00015 * (rainy ? 2.4 : foggy ? 4.6 : 1);
    SU.uZen.value.copy(zen); SU.uHor.value.copy(hor); SU.uFog.value.copy(fogC); SU.uFogD.value = scene.fog.density; SU.uSunDir.value.copy(dir);
    SU.uSunCol.value.copy(sun.color).multiplyScalar(rainy || foggy ? 0.08 : night ? 0.5 : 1); SU.uNight.value = night ? 1 : 0; SU.uCloud.value = rainy ? 1.6 : foggy ? 1.2 : T.cloud;
    SU.uDeep.value.set(T.deep).lerp(new THREE.Color(night ? '#0a1622' : '#3d5868'), grey * 0.7); SU.uShallow.value.set(T.shallow).lerp(new THREE.Color(night ? '#16323c' : '#7fa7a8'), grey * 0.6);
    SU.uFoam.value.set(night ? '#5f7f95' : '#eaf7f4'); SU.uGround.value.set(night ? '#0e1420' : '#6d7556').multiplyScalar(rainy || foggy ? 0.7 : 1).lerp(sun.color.clone().multiplyScalar(0.25), night ? 0 : 0.15); SU.uSky.value.copy(zen).lerp(hor, 0.25); SU.uRough.value = rainy ? 2.4 : 1;
    U.uLit.value = Math.max(T.lit, rainy ? 0.35 : foggy ? 0.2 : 0); U.uGlow.value = 0.22 + 1.7 * U.uLit.value; if (typeof wakeMat !== 'undefined' && wakeMat) wakeMat.opacity = 0.55 * (1 - 0.82 * U.uLit.value);
    pools.visible = U.uLit.value > 0.15; pools.material.opacity = 0.6 * U.uLit.value; uplight.intensity = 900 * Math.max(0, U.uLit.value - 0.2); towerMat.emissiveIntensity = 0.42 * Math.max(0, U.uLit.value - 0.15) * (state.look === 'model' ? 0.4 : 1); towerPearl.emissiveIntensity = towerMat.emissiveIntensity; beam.visible = U.uLit.value > 0.15; beam.userData.mat.opacity = 0.08 * U.uLit.value; halo.material.opacity = 0.9 * U.uLit.value;
    renderer.toneMappingExposure = T.expo * (state.look === 'model' ? 1.06 : 1) * (rainy ? 0.92 : 1);
    rain.visible = rainy; U.uWet.value = rainy ? 1 : 0; rainU.uA.value = night ? 0.3 : 0.5; setBloom(U.uLit.value > 0.6);
    if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene, 0, 1, 400); scene.environment = envRT.texture; scene.environmentIntensity = (night ? 0.9 : rainy || foggy ? 0.8 : 0.55) * (state.look === 'model' ? 1.25 : 1);
  }
  function setLook(l) { state.look = l === 'model' ? 'model' : 'film'; U.uLook.value = state.look === 'model' ? 1 : 0; applySky(); if (hovered) { const h = hovered; hovered = null; hover(h); } }
  function setTime(t) { if (TIMES[t]) { state.time = t; applySky(); } }
  function setWeather(w) { if (WEATHER[w]) { state.weather = w; applySky(); } }

  /* ---------- the camera ---------- */
  const controls = new OrbitControls(camera, canvas);
  // drag pans across the island, the wheel zooms towards the pointer, right-drag (or two fingers) turns and tilts
  controls.enableDamping = true; controls.dampingFactor = 0.1; controls.rotateSpeed = 0.55; controls.zoomSpeed = 1.0; controls.panSpeed = 1.0; controls.screenSpacePanning = false; controls.zoomToCursor = true;
  controls.minPolarAngle = 5 * D2R; controls.maxPolarAngle = 87 * D2R; controls.minDistance = 26; controls.autoRotateSpeed = 0.28;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  let userMoving = 0; let onUserMove = null;
  controls.addEventListener('start', () => { userMoving = 1e9; controls.autoRotate = false; if (onUserMove) onUserMove(); });
  controls.addEventListener('end', () => { userMoving = 0.8; });
  const home = { pos: new THREE.Vector3(), target: new THREE.Vector3(HALF.cx + VIEW.target[0], VIEW.target[1], HALF.cz + VIEW.target[2]), fov: VIEW.lens };
  function fit() {
    const w = host.clientWidth || 1; const h = host.clientHeight || 1; const aspect = w / h; camera.aspect = aspect;
    home.fov = VIEW.lens + (1 - smooth(0.7, 1.5, aspect)) * 12;
    const hf = Math.atan(Math.tan((home.fov * D2R) / 2) * aspect); const need = HALF.x * (aspect < 1 ? 1.1 : 1.04); /* the island's half width, so all of it fits */ const dist = Math.max(VIEW.distance * (aspect < 1 ? 0.6 : 1), need / Math.tan(hf));
    const el = (VIEW.elevation + (aspect < 1 ? 16 : 0)) * D2R; const az = VIEW.azimuth * D2R;
    home.pos.set(home.target.x - Math.sin(az) * Math.cos(el) * dist, home.target.y + Math.sin(el) * dist, home.target.z + Math.cos(az) * Math.cos(el) * dist);
    controls.maxDistance = dist * 1.12; home.dist = dist;
  }
  const solids = [...stops.map((p) => ({ x: p.bx, z: p.bz, r: Math.min(p.size[0], p.size[2]) * 0.5 + 5, top: p.by + p.size[1] + 3 })), { x: TW.x, z: TW.z, r: 24, top: towerY + 120 }, ...towns.map((T) => ({ x: T.x, z: T.z, r: 15, top: DECK + 9 }))];
  const rig = { mode: 'orbit', tween: null, subj: null, blend: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: VIEW.lens, t: 0 };
  const lookNow = new THREE.Vector3();
  function clampTarget() { const t = controls.target; const sd = shoreDistance(t.x, t.z); if (sd < -40) { const k = Math.max(0.5, 1 - (-40 - sd) / Math.max(60, Math.hypot(t.x, t.z))); t.x *= k; t.z *= k; } t.y = clamp(t.y, 0, 150); }
  controls.addEventListener('change', clampTarget);
  let hiddenThing = null; const unhide = () => { if (hiddenThing) { hiddenThing.visible = true; hiddenThing = null; } if (typeof cabinLight !== 'undefined') cabinLight.intensity = 0; };
  function setOrbit(pos, target, fov) { unhide(); controls.autoRotate = false; camera.position.copy(pos); controls.target.copy(target); camera.fov = fov; camera.near = 4; camera.updateProjectionMatrix(); camera.lookAt(target); controls.enabled = true; rig.mode = 'orbit'; rig.tween = null; controls.update(); }
  /** Glide the camera to a pose, then hand it back to the visitor. */
  function flyTo(pos, target, fov = home.fov, dur = 1.1, after = null) {
    if (reduce || dur <= 0) { setOrbit(pos, target, fov); if (after) after(); return; }
    rig.mode = 'tween'; controls.enabled = false; unhide();
    rig.tween = { p0: camera.position.clone(), t0: lookNow.clone(), f0: camera.fov, p1: pos.clone(), t1: target.clone(), f1: fov, t: 0, dur, after };
  }
  function resetView(animated = true) { fit(); flyTo(home.pos, home.target, home.fov, animated ? 1.1 : 0); }
  /** The opening shot: start a little higher and further out, and settle on the default view. */
  function openingCamera(dur) { fit(); const far = home.pos.clone().sub(home.target).multiplyScalar(1.1).add(home.target); far.y += home.dist * 0.07; setOrbit(far, home.target, home.fov); flyTo(home.pos, home.target, home.fov, dur); }
  /** The hero shot of a place: its building front on, a little to the sunny side, sized to fill the part of
      the view that stays free when its page is open (the left of a wide screen, the top of a phone). */
  const sunDir = new THREE.Vector3(0, 1, 0);
  /* Does anything stand in the way between o and a point maxT along d? Boxes, tree crowns, and the ground. */
  const RO = new THREE.Vector3(); const RD = new THREE.Vector3();
  function blocked(o, d, maxT, skip) {
    for (const oc of occluders) {
      if (oc.id === skip) continue;
      if (Math.hypot(oc.x - o.x, oc.z - o.z) > maxT + 80) continue;
      if (oc.box) {
        RO.copy(o).applyMatrix4(oc.inv); RD.copy(d).transformDirection(oc.inv); let t0 = 0.5; let t1 = maxT - 1.5;
        for (let a = 0; a < 3 && t0 <= t1; a++) { const ro = a === 0 ? RO.x : a === 1 ? RO.y : RO.z; const rd = a === 0 ? RD.x : a === 1 ? RD.y : RD.z; const hh = oc.half[a]; if (Math.abs(rd) < 1e-6) { if (ro < -hh || ro > hh) t0 = 1e9; continue; } let ta = (-hh - ro) / rd; let tb = (hh - ro) / rd; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); }
        if (t0 <= t1) return true;
      } else { const cx = oc.x - o.x; const cy = oc.y - o.y; const cz = oc.z - o.z; const t = cx * d.x + cy * d.y + cz * d.z; if (t < 0.5 || t > maxT - 1.5) continue; const dd = cx * cx + cy * cy + cz * cz - t * t; if (dd < oc.r * oc.r) return true; }
    }
    for (let k = 1; k < 12; k++) { const t = (maxT * k) / 12; if (o.y + d.y * t < height(o.x + d.x * t, o.z + d.z * t) + 0.5) return true; } // a hill in the way
    return false;
  }
  const inside3 = (p, skip) => occluders.some((oc) => { if (oc.id === skip || !oc.box) return false; RO.copy(p).applyMatrix4(oc.inv); return Math.abs(RO.x) < oc.half[0] + 2 && Math.abs(RO.y) < oc.half[1] + 2 && Math.abs(RO.z) < oc.half[2] + 2; });
  /** The hero shot of a building: a front three-quarter view, a little above eye level, sized from the
      building to fill the part of the view the page will leave free, from the angle where nothing stands in
      the way (neighbours, trees, the station, the hill). */
  const heroCache = new Map();
  function heroPose(id) {
    const p = byId[id]; if (!p) return { pos: home.pos.clone(), target: home.target.clone(), fov: home.fov }; if (p.town) return townPose(id);
    const w = host.clientWidth || 1; const h = host.clientHeight || 1; const aspect = w / h; const narrow = aspect < 1; const tower = id === 'tower';
    const key = `${id}|${Math.round(aspect * 50)}`; if (heroCache.has(key)) { const c = heroCache.get(key); return { pos: c.pos.clone(), target: c.target.clone(), fov: c.fov }; }
    const fov = narrow ? 52 : 34; const tv = Math.tan((fov * D2R) / 2);
    const freeW = narrow ? 0.92 : 0.52; const freeH = narrow ? 0.4 : 0.9; // the page takes the right of a wide screen, the bottom of a phone
    const ms = p.mass; const H = tower ? towerTop + 14 - p.by : Math.max(ms ? ms.h : p.size[1], 6); const Wd = tower ? 60 : ms ? ms.w : p.W; const Dd = tower ? 60 : ms ? ms.d : p.D; const cx = tower ? p.bx : ms ? ms.x : p.cx; const cz = tower ? p.bz : ms ? ms.z : p.cz;
    const target = new THREE.Vector3(cx, p.by + H * (tower ? 0.5 : 0.42), cz);
    const fx = p.fx; const fz = p.fz; let best = null; const o = new THREE.Vector3(); const d = new THREE.Vector3(); const q = new THREE.Vector3();
    for (const turn of [0.6, -0.6, 0.42, -0.42, 0.8, -0.8, 0.25, -0.25, 1.05, -1.05, 0, 1.4, -1.4]) {
      const c = Math.cos(turn); const sn = Math.sin(turn); const dx = fx * c - fz * sn; const dz = fx * sn + fz * c;
      const projW = Math.abs(Wd * c) + Math.abs(Dd * sn); const depth = Math.abs(Dd * c) + Math.abs(Wd * sn);
      for (const elDeg of tower ? [5, 9, 14] : [10, 15, 21, 28]) {
        const el = elDeg * D2R; const dist = Math.max((H * 0.5) / (tv * freeH * 0.8), (projW * 0.5) / (tv * aspect * freeW * 0.95), 22) + depth * 0.35; // the building fills most of the part of the view the page leaves free
        o.set(target.x + dx * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + dz * Math.cos(el) * dist);
        if (o.y < Math.max(0, height(o.x, o.z)) + 2.5 || inside3(o, id)) continue;
        let hits = 0; let n = 0; // nine points across the face the camera sees
        for (const fy of [0.15, 0.5, 0.85]) for (const fs of [-0.36, 0, 0.36]) { q.set(cx - dz * fs * projW, p.by + H * fy, cz + dx * fs * projW); d.copy(q).sub(o); const L = d.length(); d.divideScalar(L); n++; if (blocked(o, d, L - depth * 0.45, tower ? 'tower' : id)) hits++; }
        const sunny = -(dx * sunDir.x + dz * sunDir.z) < 0 ? 0 : 0.25; // the lit side is nicer, but never at the cost of the view
        const cost = (hits / n) * 10 + Math.abs(Math.abs(turn) - 0.6) * 0.9 + (elDeg - (tower ? 5 : 10)) * 0.045 + sunny;
        if (!best || cost < best.cost) best = { cost, pos: o.clone(), hits };
      }
    }
    if (!best) { const el = 20 * D2R; const dist = 120; best = { pos: new THREE.Vector3(target.x + fx * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + fz * Math.cos(el) * dist), hits: -1 }; }
    const out = { pos: best.pos, target, fov, hits: best.hits }; heroCache.set(key, out); return { pos: out.pos.clone(), target: out.target.clone(), fov, hits: best.hits };
  }
  /** The whole of a town from above its square, seen from the sea side, so every building in it shows. */
  function townPose(id) {
    const T = byId[id]; const w = host.clientWidth || 1; const h = host.clientHeight || 1; const fov = Math.max(home.fov, 32); const tv = Math.tan((fov * D2R) / 2);
    let r = 60; T.kids.forEach((k) => { r = Math.max(r, Math.hypot(k.bx - T.cx, k.bz - T.cz) + Math.max(k.size[0], k.size[2]) * 0.5); });
    const dist = (r * 0.92) / (tv * Math.min(1, w / h)); const el = 34 * D2R; const c = Math.cos(0.3); const sn = Math.sin(0.3); const dx = -T.nx * c + T.nz * sn; const dz = -T.nx * sn - T.nz * c;
    const target = new THREE.Vector3(T.cx, T.cy + 6, T.cz); return { pos: new THREE.Vector3(target.x + dx * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + dz * Math.cos(el) * dist), target, fov };
  }
  function showTown(id, dur = 1.4) { const s = townPose(id); flyTo(s.pos, s.target, s.fov, dur); }
  /** Step out of the station, go down to the square and along the street to a building, then settle on its hero shot. */
  /** The arrival walk: from the station entrance along the plan's walking route (plan.walks) to the
      building's door, a little above head height, looking ahead and then at the building; then its hero shot. */
  function walkTo(id, d1 = 2.0, d2 = 1.4) {
    const p = byId[id]; if (!p || p.town || id === 'tower') { hero(id, d1 + d2, true); return; }
    const route = LAYOUT.walks && LAYOUT.walks[id]; const ms = p.mass || { x: p.bx, z: p.bz, h: p.size[1] };
    const at = new THREE.Vector3(ms.x, p.by + Math.min(ms.h * 0.45, 16), ms.z);
    if (!route || route.length < 2 || reduce) { const T = byId[p.townId]; const from = T.entrance || { x: T.cx, z: T.cz }; flyTo(new THREE.Vector3(from.x, T.cy + 6, from.z), at, 50, d1, () => hero(id, d2, true)); return; }
    const pts = route.map(([x, z]) => new THREE.Vector3(x, Math.max(0.2, height(x, z)) + 6, z)); const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    unhide(); rig.mode = 'walk'; controls.enabled = false; rig.tween = null; rig.walk = { pts, cum, len: cum[cum.length - 1] || 1, t: 0, dur: d1, at, p0: camera.position.clone(), t0: lookNow.clone(), f0: camera.fov, after: () => hero(id, d2, true) };
  }
  const walkPoint = (w, d, out) => { d = clamp(d, 0, w.len); let i = 1; while (i < w.cum.length - 1 && w.cum[i] < d) i++; const f = (d - w.cum[i - 1]) / (w.cum[i] - w.cum[i - 1] || 1); return out.lerpVectors(w.pts[i - 1], w.pts[i], f); };
  /** Put the camera on a place's hero shot at once (deep links, reduced motion, Skip). */
  function showStation(id, turning = false) { const s = heroPose(id); setOrbit(s.pos, s.target, s.fov); controls.autoRotate = turning && !reduce; }
  /** Glide to a place's hero shot; with `turning` the view then drifts slowly round it. */
  function hero(id, dur = 1.3, turning = true) { const s = heroPose(id); flyTo(s.pos, s.target, s.fov, dur, () => { controls.autoRotate = turning && !reduce; }); }
  /** Glide to look at any point from about `d` metres away, keeping the direction the camera already has. */
  function lookAtPoint(x, y, z, d = 90, dur = 1.0) { const t = new THREE.Vector3(x, y, z); const dir = camera.position.clone().sub(lookNow); dir.y = Math.max(dir.y, dir.length() * 0.3); dir.setLength(d); flyTo(t.clone().add(dir), t, Math.max(home.fov, 32), dur); }
  /* The page covers part of the view: slide the picture so the middle of the view sits in the part left free. */
  const shift = { x: 0, y: 0, tx: 0, ty: 0 };
  function setShift(x, y, now = false) { shift.tx = x; shift.ty = y; if (now || reduce) { shift.x = x; shift.y = y; } }
  function applyShift(dt) {
    const a = 1 - Math.exp(-dt * 6); shift.x += (shift.tx - shift.x) * a; shift.y += (shift.ty - shift.y) * a;
    const w = host.clientWidth || 1; const h = host.clientHeight || 1;
    if (Math.abs(shift.x) < 0.5 && Math.abs(shift.y) < 0.5 && !shift.tx && !shift.ty) { if (camera.view) { camera.clearViewOffset(); } return; }
    camera.setViewOffset(w, h, shift.x, shift.y, w, h);
  }
  /* Shadows stay sharp close up: the sun's shadow box follows the view and shrinks as the camera comes in. */
  let shE = 0; const shC = new THREE.Vector3(1e6, 0, 0);
  function fitShadow(force) {
    const E = clamp(camera.position.distanceTo(lookNow) * 0.85, 120, 470); const wide = E > 440; const cx = wide ? 0 : lookNow.x; const cz = wide ? 0 : lookNow.z;
    if (!force && Math.abs(E - shE) < shE * 0.15 && Math.hypot(cx - shC.x, cz - shC.z) < shE * 0.2) return;
    shE = E; shC.set(cx, 0, cz); const c = sun.shadow.camera; c.left = -E; c.right = E; c.top = E; c.bottom = -E; c.updateProjectionMatrix();
    sun.target.position.copy(shC); sun.position.copy(sunDir).multiplyScalar(1300).add(shC); sun.shadow.normalBias = 0.25 + E / 900;
  }
  /** Follow something that moves: subj() returns { x, y, z, fx, fz, ox, oz, v }. */
  function follow(subj) { if (rig.mode !== 'follow') { rig.blend = 0; rig.p0 = camera.position.clone(); rig.t0 = (rig.mode === 'orbit' ? controls.target : lookNow).clone(); rig.f0 = camera.fov; rig.have = false; } rig.mode = 'follow'; rig.subj = subj; controls.enabled = false; rig.tween = null; camera.near = 4; unhide(); }
  /** Ride inside the train (or the pod): the camera glides into the car and stands by the doors, looking
      out over the platform. subj() returns { m: the car's matrix, floor, door: the doorway's place along
      the car, lead: how far ahead to look }. stepOut(dur) then walks it out through the doorway. */
  function inside(subj) { unhide(); rig.mode = 'inside'; rig.subj = subj; controls.enabled = false; rig.tween = null; rig.blend = 0; rig.p0 = camera.position.clone(); rig.t0 = lookNow.clone(); rig.f0 = camera.fov; rig.exit = null; }
  const cabinLight = new THREE.PointLight(0xfff1de, 0, 9, 2); scene.add(cabinLight); // the car's own ceiling light, on while the visitor is inside
  function stepOut(dur = 1.1, toward = null) { if (rig.mode !== 'inside') return; const T = toward && byId[toward]; rig.exit = { t: 0, dur, look: T ? new THREE.Vector3(T.cx, T.cy + 8, T.cz) : null }; }
  const want = new THREE.Vector3(); const wantLook = new THREE.Vector3(); const EL = new THREE.Vector3(); const LL = new THREE.Vector3(); const CL = new THREE.Vector3(); const LX = new THREE.Vector3();
  function updateCamera(dt) {
    applyShift(dt);
    if (rig.mode === 'orbit') {
      controls.update(dt);
      if (userMoving > 0) { // close in, the view turns about the ground under it; far out, about a point above the island
        userMoving -= dt; const t = controls.target; const d = camera.position.distanceTo(t); const g = Math.max(0, height(t.x, t.z));
        const wantY = g + 2.5 + (VIEW.target[1] - 2.5) * smooth(220, 950, d); const dy = (wantY - t.y) * (1 - Math.exp(-dt * 3.5)); t.y += dy; camera.position.y += dy * 0.6;
      }
      const g0 = Math.max(0, height(camera.position.x, camera.position.z)); if (camera.position.y < g0 + 2.2) camera.position.y = g0 + 2.2;
      for (const b of solids) { // never inside a building: step back out to its edge
        if (camera.position.y > b.top) continue; const dx = camera.position.x - b.x; const dz = camera.position.z - b.z; const d = Math.hypot(dx, dz);
        if (d < b.r) { const k = b.r / (d || 1); camera.position.x = b.x + (dx || 1) * k; camera.position.z = b.z + dz * k; }
      }
      lookNow.copy(controls.target); return;
    }
    if (rig.mode === 'walk') {
      const w = rig.walk; w.t += dt; const u = Math.min(1, w.t / w.dur); const k = ease(u); const join = smooth(0, 0.3, u);
      walkPoint(w, k * w.len, want); walkPoint(w, k * w.len + 14, wantLook); wantLook.y -= 2; wantLook.lerp(w.at, smooth(0.15, 0.75, u));
      camera.position.lerpVectors(w.p0, want, join); lookNow.lerpVectors(w.t0, wantLook, join); camera.fov = w.f0 + (52 - w.f0) * join; camera.near = 0.5; camera.updateProjectionMatrix(); camera.lookAt(lookNow);
      if (u >= 1) { rig.mode = 'tween'; rig.tween = { p0: camera.position.clone(), t0: lookNow.clone(), f0: camera.fov, p1: camera.position.clone(), t1: lookNow.clone(), f1: camera.fov, t: 1, dur: 1, after: null }; w.after(); }
      return;
    }
    if (rig.mode === 'tween') {
      const w = rig.tween; w.t += dt; const k = ease(Math.min(1, w.t / w.dur));
      camera.position.lerpVectors(w.p0, w.p1, k); lookNow.lerpVectors(w.t0, w.t1, k); camera.fov = w.f0 + (w.f1 - w.f0) * k; camera.updateProjectionMatrix(); camera.lookAt(lookNow);
      if (k > 0.25) camera.near = 4; if (k >= 1) { setOrbit(w.p1, w.t1, w.f1); if (w.after) w.after(); } return;
    }
    const s = rig.subj(); const sp = Math.abs(s.v || 0);
    if (rig.mode === 'follow') {
      const narrow = camera.aspect < 1 ? 1.35 : 1;
      want.set(s.x + (s.ox * (44 + sp * 0.5) - s.fx * (30 + sp * 0.55)) * narrow, s.y + (19 + sp * 0.22) * narrow, s.z + (s.oz * (44 + sp * 0.5) - s.fz * (30 + sp * 0.55)) * narrow);
      wantLook.set(s.x + s.fx * (6 + sp * 0.16), s.y + 2.5, s.z + s.fz * (6 + sp * 0.16));
      if (!rig.have) { rig.pos.copy(want); rig.look.copy(wantLook); rig.have = true; } else { const a = 1 - Math.exp(-dt * 2.6); rig.pos.lerp(want, a); rig.look.lerp(wantLook, 1 - Math.exp(-dt * 5)); }
      rig.blend = Math.min(1, rig.blend + dt / 1.5); const k = ease(rig.blend);
      camera.position.lerpVectors(rig.p0, rig.pos, k); lookNow.lerpVectors(rig.t0, rig.look, k); camera.fov = rig.f0 + (42 - rig.f0) * k;
      const g0 = Math.max(0, height(camera.position.x, camera.position.z)); if (camera.position.y < g0 + 5) camera.position.y = g0 + 5;
      camera.updateProjectionMatrix(); camera.lookAt(lookNow); return;
    }
    // inside: standing in the car by the doors; then out through the doorway onto the platform
    { const m = s.m; const fl = s.floor; const dx = s.door; const up = s.up || 0;
      const e = rig.exit ? ease(Math.min(1, (rig.exit.t += dt) / rig.exit.dur)) : 0;
      const ex = dx - 1.6 * (1 - e); const ez = -0.9 + 4.2 * e; const ey = fl + 1.62 + 0.6 * e;
      EL.set(ex, ey, ez).applyMatrix4(m); LL.set(dx + 0.2 + (s.lead || 0) * (1 - e), fl + 2.0 + up * (1 - e) + 5 * e, 7 + 30 * e).applyMatrix4(m); if (rig.exit) LL.lerp(LX.set(dx + 40, fl + 6, 8).applyMatrix4(m), smooth(0.3, 1, e)); // out of the doorway, then along the platform towards the way out
      rig.blend = Math.min(1, rig.blend + dt / 1.15); const k = ease(rig.blend);
      camera.position.lerpVectors(rig.p0, EL, k); lookNow.lerpVectors(rig.t0, LL, k); camera.fov = rig.f0 + ((camera.aspect < 1 ? 72 : 56) - rig.f0) * k; camera.near = k > 0.35 ? 0.08 : 2;
      camera.updateProjectionMatrix(); camera.lookAt(lookNow); CL.set(dx - 1, fl + 2.7, 0).applyMatrix4(m); cabinLight.position.copy(CL); cabinLight.intensity = 9 * k * (1 - e * 0.8); }
  }

  /* ---------- the opening: an empty island, then everything rises ---------- */
  function setBuilt(order, k) {
    const on = k > 0.001; const e = on ? backOut(clamp(k, 0, 1)) : 0;
    const slot = slotOf(order); const pv = slotPivot[slot] || (order === PROJECTS.length + 1 ? [TW.x, towerY, TW.z, false] : null); if (pv && slot < RISE_N) U.uRise.value[slot].set(pv[0], pv[1], pv[2], pv[3] ? -e : e);
    if (order < 0) { const ready = k > 0.98; Object.values(gateSets).forEach((gs) => gs.im.show(ready)); if (signMesh) signMesh.visible = ready; if (boardMesh) boardMesh.visible = ready; }
    const g = riseGroups.find((x) => x.userData.order === order); if (!g) return; g.visible = on; if (on) { const w = order < 0 ? 1 : 0.88 + 0.12 * Math.min(1, e); g.scale.set(w, Math.max(0.001, e), w); }
  }
  function setAllBuilt(k) { riseGroups.forEach((g) => setBuilt(g.userData.order, k)); setHouses(k); }
  // the tower rises about its own foot, not about the middle of the island
  towerGroup.position.set(TW.x, towerY, TW.z); tower.position.set(0, 0, 0);
  riseGroups.forEach((g) => { if (g === towerGroup || g.userData.order < 0) return; const p = stops.find((q) => q.i === g.userData.order); const cx = p.bx; const cz = p.bz; const cy = 0.4; g.position.set(cx, cy, cz); g.children.forEach((c) => { c.position.x -= cx; c.position.y -= cy; c.position.z -= cz; }); });

  /* ---------- pointing at things ---------- */
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  function pick2(cx, cy) {
    const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(proxies, false)[0]; if (hit) return hit.object.userData.target;
    let best = null; let bd = Infinity; // smaller things: the lighthouse, the ferry, the boats
    for (const e of extras) { const q = e.at(); V.set(q[0], q[1], q[2]); const along = V.clone().sub(ray.ray.origin).dot(ray.ray.direction); if (along > 0 && ray.ray.distanceToPoint(V) < e.r && along < bd) { bd = along; best = e; } }
    return best ? best.id : null;
  }
  const extra = (id) => { const e = extras.find((x) => x.id === id); if (!e) return null; const q = e.at(); return { name: e.name, x: q[0], y: q[1], z: q[2], d: e.d }; };
  const pv = new THREE.Vector3();
  /** Where a place is on screen (page pixels), or null when it is behind the camera. */
  function screenOf(id, lift = 0) { const p = byId[id]; if (!p) return null; if (p.town) pv.set(p.x, DECK + 9 + lift, p.z); else pv.set(p.bx, p.by + (id === 'tower' ? 120 : p.size[1]) + lift, p.bz); pv.project(camera); if (pv.z > 1 || pv.z < -1) return null; const r = canvas.getBoundingClientRect(); return [r.left + ((pv.x + 1) / 2) * r.width, r.top + ((1 - pv.y) / 2) * r.height, camera.position.distanceTo(V.set(p.bx, p.by, p.bz))]; }

  /** The middle of a building on screen (page pixels): where a visitor would click it. */
  function pointOf(id) { const p = byId[id]; if (!p) return null; if (p.town) pv.set(p.x, DECK + 6, p.z); else pv.set(p.bx, p.by + (id === 'tower' ? 60 : Math.min(p.size[1] * 0.5, 14)), p.bz); pv.project(camera); if (pv.z > 1 || pv.z < -1) return null; const r = canvas.getBoundingClientRect(); return [r.left + ((pv.x + 1) / 2) * r.width, r.top + ((1 - pv.y) / 2) * r.height]; }

  /* ---------- every frame ---------- */
  let frames = 0; let clock = 0; let laneGlowWant = false;
  function update(dt, sim) {
    simRef = sim; clock += dt; SU.uT.value = clock; rainU.uT.value = clock; U.uTime.value = clock;
    setTrains(sim, clock); setTram(sim, clock); lightLanes(sim); setStations(sim); laneU.uAll.value += ((laneGlowWant ? 1 : 0) - laneU.uAll.value) * Math.min(1, dt * 5); laneU.uPx.value = renderer.getPixelRatio() * (host.clientHeight || 800) / 800;
    life.forEach((f) => f(dt, clock));
    spinners.forEach((sp) => { sp.o.rotation.y = Math.sin(clock * 0.16 + sp.seed) * 1.3; });
    const crown = tower.userData.kids.crown; if (crown && !towerModel.real) crown.rotation.y = clock * 0.25;
    if (lampKid) lampKid.rotation.y = clock * 0.9; beam.rotation.y = clock * 0.9;
    halo.scale.setScalar(60 + Math.sin(clock * 2.2) * 14);
    if (ring.visible) ring.material.opacity = 0.7 + Math.sin(clock * 5) * 0.25;
    updateCamera(dt); fitShadow(false);
    if (rain.visible) { camera.getWorldDirection(V); rainU.uC.value.copy(camera.position).addScaledVector(V, Math.min(260, camera.position.distanceTo(lookNow) * 0.8)); }
  }
  /* At night the lights bloom a little. Only then is the picture drawn through an extra pass. */
  let composer = null; let bloomOn = false;
  function bloomSize() { const w = host.clientWidth || 1; const h = host.clientHeight || 1; if (composer) { composer.setPixelRatio(Math.min(1.25, renderer.getPixelRatio())); composer.setSize(w, h); } } /* the bloom pass is drawn a little smaller on sharp screens, to hold 60 frames a second */
  function setBloom(on) {
    bloomOn = on && !phone; if (!bloomOn || composer) return;
    try {
      const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(sz.x, sz.y, { type: THREE.HalfFloatType, samples: renderer.getPixelRatio() > 1 ? 2 : 4 }));
      composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(sz.x / 2, sz.y / 2), 0.42, 0.55, 0.92)); composer.addPass(new OutputPass()); bloomSize();
    } catch (e) { console.warn('Night bloom is not available here; drawing without it.', e); composer = null; bloomOn = false; }
  }
  /* A lost WebGL context (the GPU reset, or the browser reclaimed memory): stop drawing, say so, and when it
     comes back rebuild what lived only on the GPU (the sky's light, the night bloom, the panels). */
  let lost = false; let onLost = null;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; if (onLost) onLost(true); }, false);
  canvas.addEventListener('webglcontextrestored', () => { lost = false; envRT = null; if (composer) { composer.dispose(); composer = null; } bloomOn = false; applySky(); if (signAtlas) signAtlas.tex.needsUpdate = true; if (boardAtlas) { boardGeos.forEach((it) => { it.text = ''; }); boardClock = -9; } if (onLost) onLost(false); }, false);
  function render() { if (lost) return; renderer.info.reset(); if (bloomOn && composer) composer.render(); else renderer.render(scene, camera); frames++; } // info counts every pass of the frame: shadows, the scene, the bloom
  function resize() { const w = host.clientWidth || 1; const h = host.clientHeight || 1; renderer.setSize(w, h, false); bloomSize(); const was = home.dist; fit(); camera.aspect = w / h; if (rig.mode === 'orbit' && was && Math.abs(camera.position.distanceTo(controls.target) - was) < 2) setOrbit(home.pos, home.target, home.fov); else { camera.updateProjectionMatrix(); if (rig.mode === 'orbit') { const d = camera.position.distanceTo(controls.target); if (d > controls.maxDistance) camera.position.sub(controls.target).setLength(controls.maxDistance).add(controls.target); } } }

  // subjects the camera can follow or sit in
  // subjects the camera can follow or sit in. t is a train from the sim; car is a tram car (+1 or −1)
  const trainSubject = (t, inside2) => { if (inside2) { return () => { const set = trainSets[simRef.trains.indexOf(t)]; return { m: set ? set.mid.matrix : new THREE.Matrix4(), floor: (carMid.def && carMid.def.floor) || 1.1, door: ((carMid.def && carMid.def.doorways) || [-3.5, 3.5]).slice(-1)[0], v: t.v }; }; }
    return () => { const q = trackAt(t.s, laneOf(t.dir)); return { x: q.x, y: TRAIN_Y, z: q.z, fx: q.tx * t.dir, fz: q.tz * t.dir, ox: -q.nx, oz: -q.nz, v: t.v }; }; };
  const tramSubject = (sim, car, inside2) => { const c = tramCars.find((x) => x.userData.side === car) || tramCars[0];
    if (inside2) return () => ({ m: c.matrix, floor: (tramModel.def && tramModel.def.floor) || 0.9, door: ((tramModel.def && tramModel.def.doorways) || [-2.4, 2.4]).slice(-1)[0], lead: 3, up: 3 });
    return () => { const p = tramAt(sim.tramU(car), car); return { x: p.x, y: p.y + 1, z: p.z, fx: p.ux, fz: p.uz, ox: p.uz * 0.8 - p.ux * 0.3, oz: -p.ux * 0.8 - p.uz * 0.3, v: Math.abs(sim.tram.v) * 100 }; }; };
  const trainThing = () => null; const tramThing = () => null; let simRef = null;

  setLook('film'); fit(); setOrbit(home.pos, home.target, home.fov); setAllBuilt(1);
  renderer.compile(scene, camera);

  return {
    canvas, renderer, scene, camera, controls, stops, byId, used, state, get boardMesh() { return boardMesh; }, get signMesh() { return signMesh; },
    setLook, setTime, setWeather, update, render, resize, resetView, openingCamera, flyTo, showStation, heroPose, hero, lookAtPoint, setShift, follow, inside, stepOut, onUserMove(f) { onUserMove = f; }, setBuilt, setAllBuilt, setHouses,
    pick: pick2, extra, hover, screenOf, pointOf, trainSubject, tramSubject, levelName,
    towns, trainThing, tramThing, townPose, showTown, walkTo, laneGlow(on) { laneGlowWant = !!on; },
    get mode() { return rig.mode; }, home,
    info() { const i = renderer.info; return { frames, calls: i.render.calls, tris: i.render.triangles, renderer: (() => { try { const gl = renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; } catch (er) { return 'unknown'; } })() }; },
    resetStats() { frames = 0; },
    onContextLost(f) { onLost = f; }, get lost() { return lost; },
    dispose() { renderer.dispose(); },
  };
}
