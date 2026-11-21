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
import { ISLAND, LOOP, TOWER, ROADS, DISTRICTS, STOPS, PLACING, LIFE, VIEW, height, edge, coastK, hillHeight, loopPoint, loopTangent, loopOffset, stopAngle, SLOT } from './city-data.js';
import { Kit, standBuilding, standLot, standSite, standStation, standCar, standTram, standTower, standProp } from './kit.js';
import { tintGeo } from './models.js';
import { LOOP_LEN, PLACES, placeById, trackAt, tramAt, TRAM, sOfAngle, shortWay, straightHalf } from './track.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, t) => { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const backOut = (p) => { const c = 1.4; const q = p - 1; return 1 + (c + 1) * q * q * q + c * q * q; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const DCOL = Object.fromEntries(DISTRICTS.map((d) => [d.id, d.color]));
/** A point on the coast: angle as on the loop (90 = the front), e = 1 at the shoreline. */
const coastPoint = (a, e = 1) => { const k = coastK(-a * D2R) * e; return { x: ISLAND.rx * k * Math.cos(a * D2R), z: ISLAND.rz * k * Math.sin(a * D2R) }; };

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
  const canvas = renderer.domElement; canvas.className = 'city-canvas'; canvas.setAttribute('aria-hidden', 'true'); host.prepend(canvas);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0xbfd9ee, 0.00016);
  const camera = new THREE.PerspectiveCamera(VIEW.lens, 16 / 9, 4, 17000);

  /* ---------- materials: three shared ones, each with two looks ---------- */
  const U = { uLook: { value: 0 }, uLit: { value: 0 }, uGlow: { value: 0.2 }, uTime: { value: 0 } };
  function twoLooks(mat, kind, sway = false) {
    mat.defines = { ...(mat.defines || {}), [`IS_${kind.toUpperCase()}`]: 1 }; if (sway) mat.defines.IS_SWAY = 1;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 mcol;\nuniform float uTime;\nvarying vec3 vMcol;\nvarying vec3 vWp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMcol = mcol;\n#if defined(IS_SWAY) && defined(USE_INSTANCING)\nfloat swayPh = instanceMatrix[3].x * 0.071 + instanceMatrix[3].z * 0.053;\nfloat swayH = max(transformed.y - 1.4, 0.0);\ntransformed.x += (sin(uTime * 1.25 + swayPh) * 0.030 + sin(uTime * 2.9 + swayPh * 1.7) * 0.010) * swayH;\ntransformed.z += (cos(uTime * 1.05 + swayPh * 1.3) * 0.020) * swayH;\n#endif\n#ifdef USE_INSTANCING\nvWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uLook;\nuniform float uLit;\nuniform float uGlow;\nvarying vec3 vMcol;\nvarying vec3 vWp;')
        .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 filmCol = diffuseColor.rgb;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vMcol, uLook);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.92, uLook);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, uLook);')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef IS_GLOW
totalEmissiveRadiance += mix(filmCol, vMcol, uLook * 0.6) * uGlow;
#endif
#ifdef IS_GLASS
totalEmissiveRadiance += vec3(1.0, 0.66, 0.32) * uLit * 0.16; // a soft light from inside; the lit panes themselves are the glow parts
#endif`);
    };
    mat.customProgramCacheKey = () => `island-${kind}${sway ? '-sway' : ''}`;
    return mat;
  }
  const MAT = {
    // built things: pearly shells that catch the sky. Land and living things: matte. Trees: matte, and they sway.
    city: twoLooks(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0.0, envMapIntensity: 1.0 }), 'city'),
    matte: twoLooks(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, envMapIntensity: 0.7 }), 'city'),
    tree: twoLooks(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, envMapIntensity: 0.7 }), 'city', true),
    glass: twoLooks(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.62, envMapIntensity: 1.5 }), 'glass'),
    glow: twoLooks(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 }), 'glow'),
  };

  /* ---------- models: the real one if it has arrived, or the stand-in ---------- */
  const used = { real: [], stand: [] }; const cache = new Map();
  function getModel(name, make) {
    if (cache.has(name)) return cache.get(name);
    let m = lib && lib.get(name); if (m) used.real.push(name); else { m = make ? make() : null; if (m) used.stand.push(name); }
    cache.set(name, m); return m;
  }
  const prop = (name) => getModel(name, () => standProp(name));
  const KINDS = ['city', 'glass', 'glow'];
  function meshesOf(geo, cast, body = MAT.city) { const out = []; for (const k of KINDS) if (geo[k]) { const m = new THREE.Mesh(geo[k], k === 'city' ? body : MAT[k]); m.castShadow = cast && k !== 'glow'; m.receiveShadow = k === 'city'; out.push(m); } return out; }
  /** One copy of a model, with its moving parts as named groups in userData.kids. */
  function spawn(model, { cast = true } = {}) {
    const g = new THREE.Group(); g.userData.kids = {}; meshesOf(model.geo, cast).forEach((m) => g.add(m));
    for (const [name, kid] of Object.entries(model.kids || {})) { const kg = new THREE.Group(); kg.position.fromArray(kid.pos); if (kid.quat) kg.quaternion.fromArray(kid.quat); if (kid.scale) kg.scale.fromArray(kid.scale); meshesOf(kid.geo, cast).forEach((m) => kg.add(m)); g.add(kg); g.userData.kids[name] = kg; }
    return g;
  }
  /** Many copies of a model in a few draw calls. set(i, matrix); kid(name, i, matrix, turn) for moving parts. */
  function inst(model, n, { cast = true, parent = scene, skin = MAT.city } = {}) {
    const mk = (geo) => KINDS.filter((k) => geo[k]).map((k) => { const im = new THREE.InstancedMesh(geo[k], k === 'city' ? skin : MAT[k], n); im.castShadow = cast && k !== 'glow'; im.receiveShadow = k === 'city'; im.frustumCulled = false; im.userData.kind = k; parent.add(im); return im; });
    const body = mk(model.geo); const kids = {}; const tmp = new THREE.Matrix4();
    for (const [name, kid] of Object.entries(model.kids || {})) kids[name] = { meshes: mk(kid.geo), local: new THREE.Matrix4().compose(new THREE.Vector3().fromArray(kid.pos), kid.quat ? new THREE.Quaternion().fromArray(kid.quat) : new THREE.Quaternion(), kid.scale ? new THREE.Vector3().fromArray(kid.scale) : new THREE.Vector3(1, 1, 1)) };
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
  const M4 = new THREE.Matrix4(); const Q = new THREE.Quaternion(); const V = new THREE.Vector3(); const SC = new THREE.Vector3(); const E = new THREE.Euler(); const YAX = new THREE.Vector3(0, 1, 0);
  const mat4 = (x, y, z, yaw = 0, s = 1, pitch = 0, roll = 0) => M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(pitch, yaw, roll, 'YXZ')), SC.set(s, s, s));
  const yawTo = (dx, dz) => Math.atan2(dx, dz); // turn a model so its front (+Z) points along (dx, dz)
  // Things that move lie along X in the model files (and along Z in the stand-ins): alongX() tells which.
  const alongX = (m) => !!m && (m.def && m.def.forward ? /x/i.test(m.def.forward) : m.real && m.size[0] > m.size[2] * 1.3);
  /** A matrix for a thing heading along (fx, fz): nose `up` radians above level, leaning `bank` radians. */
  const heading = (m, x, y, z, fx, fz, s = 1, up = 0, bank = 0) => (alongX(m) ? mat4(x, y, z, yawTo(fx, fz) - Math.PI / 2, s, bank, up) : mat4(x, y, z, yawTo(fx, fz), s, -up, bank));
  const doorOf = (m, fallback) => (m.def && Array.isArray(m.def.door) ? m.def.door : fallback);
  const local = (o, dx, dz) => { const c = Math.cos(o.rotation.y); const sn = Math.sin(o.rotation.y); return { x: o.position.x + dx * c + dz * sn, z: o.position.z - dx * sn + dz * c }; };

  /* ---------- land ---------- */
  {
    const nx = 230; const nz = 150; const x0 = -ISLAND.rx * 1.16; const x1 = -x0; const z0 = -ISLAND.rz * 1.2; const z1 = -z0;
    const pos = []; const col = []; const mcol = []; const idx = []; const r = rng(3);
    const G1 = [0.30, 0.56, 0.16]; const G2 = [0.19, 0.43, 0.13]; const SAND = [0.86, 0.74, 0.50]; const SEABED = [0.20, 0.50, 0.50]; const mG1 = [0.76, 0.77, 0.71]; const mG2 = [0.66, 0.72, 0.60]; const mS = [0.82, 0.79, 0.72];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx; const z = z0 + ((z1 - z0) * j) / nz; pos.push(x, height(x, z), z);
      const e = edge(x, z); const t = smooth(0.90, 0.965, e); const h = Math.min(1, hillHeight(x, z) / 26); const n = 0.94 + r() * 0.12;
      const wet = smooth(0.995, 1.05, e);
      for (let k = 0; k < 3; k++) { const c0 = ((G1[k] * (1 - h) + G2[k] * h) * (1 - t) + SAND[k] * t) * (t > 0.5 ? 1 : n); col.push(c0 * (1 - wet) + SEABED[k] * wet); mcol.push(((mG1[k] * (1 - h) + mG2[k] * h) * (1 - t) + mS[k] * t) * (1 - wet) + SEABED[k] * wet); }
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; const b = a + 1; const c = a + nx + 1; const d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('mcol', new THREE.Float32BufferAttribute(mcol, 3)); g.setIndex(idx); g.computeVertexNormals();
    const land = new THREE.Mesh(g, MAT.matte); land.receiveShadow = true; scene.add(land);
  }

  /* ---------- sea and sky ---------- */
  const NOISE = `float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5; float s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }`;
  const SU = { uT: { value: 0 }, uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() }, uSky: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uFogD: { value: 0.00016 }, uRough: { value: 1 }, uR: { value: new THREE.Vector2(ISLAND.rx, ISLAND.rz) }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uNight: { value: 0 }, uCloud: { value: 0.5 } };
  const sea = new THREE.Mesh(new THREE.CircleGeometry(15500, 96).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: SU, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uT; uniform float uFogD; uniform float uRough; uniform float uNight; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSunCol; uniform vec3 uFog; uniform vec3 uSunDir; uniform vec2 uR; varying vec3 vW;
${NOISE}
float coastK(float th){ return 1.0 + 0.035 * sin(3.0 * th + 1.0) + 0.025 * sin(5.0 * th + 2.0) + 0.015 * sin(9.0 * th + 0.5); }
// the slope of one long swell: a sine wave travelling along dir
vec2 swell(vec2 p, vec2 dir, float len, float amp, float speed){ float k = 6.2832 / len; return dir * (k * amp * cos(dot(p, dir) * k + uT * speed)); }
float chop(vec2 p){ return vnoise(p * 0.11 + uT * vec2(0.42, 0.26)) * 0.55 + vnoise(p * 0.31 - uT * vec2(0.34, 0.5)) * 0.3 + vnoise(p * 0.83 + uT * vec2(0.7, -0.6)) * 0.15; }
void main(){
  vec2 p = vW.xz; float n = -p.y; float th = atan(n / uR.y, p.x / uR.x);
  float d = length(vec2(p.x / uR.x, n / uR.y)) / coastK(th) - 1.0;      // 0 at the shoreline, growing out to sea
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
  const skyMat = new THREE.ShaderMaterial({
    uniforms: SU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; uniform float uNight; uniform float uCloud; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSunCol; uniform vec3 uSunDir; uniform vec3 uFog; uniform vec3 uDeep; varying vec3 vDir;
${NOISE}
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = mix(uFog, uZen, pow(smoothstep(0.0, 0.8, h), 0.6));
  col = mix(col, uHor, smoothstep(0.25, 0.0, abs(h)) * 0.5);
  col = mix(col, uDeep * 1.3 + uFog * 0.12, smoothstep(-0.02, -0.3, h));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 420.0) * 5.0 + pow(sd, 10.0) * 0.22) * (1.0 - uNight * 0.5);
  if (h > 0.01) {
    vec2 q = d.xz / (h + 0.16) * 1.5 + uT * 0.003; float c = fbm(q);
    float m = smoothstep(0.50, 0.80, c) * uCloud * smoothstep(0.01, 0.22, h);
    col = mix(col, mix(uHor, vec3(1.0), 0.65) * (1.0 - uNight * 0.86), m * 0.9);
    if (uNight > 0.5) { vec2 g = floor(d.xz / (h + 0.3) * 260.0); float s = hash(g); col += vec3(0.9, 0.95, 1.0) * step(0.9975, s) * (0.5 + 0.5 * hash(g + 3.0)) * (1.0 - m) * smoothstep(0.02, 0.3, h); }
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(16000, 32, 16), skyMat); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 24, 12), skyMat));
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
  const gy = (lift) => (x, z) => Math.max(0.4, height(x, z)) + lift;
  const ringPts = (off, step = 1) => { const out = []; for (let a = 0; a < 360; a += step) out.push(loopOffset(a, off)); return out; };
  const occupied = []; // circles [x, z, r] that houses and trees keep clear of
  const fixed = new Kit(); // everything that never moves is merged into one mesh per material

  // the coast road, a street to every building, the main station forecourt, the winding hill road
  const roadKit = new Kit();
  const addRoad = (pts, width, opt) => { roadKit.add(ribbon(pts, width, gy(0.32), gy(-1.2), opt), 'road'); pts.forEach((p) => occupied.push([p.x, p.z, width * 0.75])); };
  addRoad(ringPts(ROADS.coastOffset, 1), ROADS.coastWidth, { closed: true });
  for (let a = 0; a < 360; a += 3) { const pts = [loopOffset(a, ROADS.coastOffset), loopOffset(a + 1.2, ROADS.coastOffset)]; roadKit.add(ribbon(pts, 0.28, gy(0.36), gy(0.3)), 'white'); }
  const hillRoad = [loopOffset(0, ROADS.coastOffset)];
  for (let k = 0; k <= 70; k++) { const u = k / 70; const ph = 300 * u * D2R; const rho = 2.0 - 1.52 * u; hillRoad.push({ x: ISLAND.hill.sx * rho * Math.cos(ph), z: ISLAND.hill.z - ISLAND.hill.sz * rho * Math.sin(ph) }); }
  addRoad(hillRoad, 6.5);
  addRoad([0, 1, 2, 3].map((k) => loopOffset(LOOP.mainAngle, ROADS.coastOffset + 5 * k)), 18);

  // the metro: a concrete beam on hammerhead piers, with a track bed, sleepers, two rails, a red edge and a
  // walkway rail. It follows track.js, so it runs straight through every station.
  const DECK = LOOP.deck; const NS = Math.round(LOOP_LEN / 2); const tr = []; for (let i = 0; i < NS; i++) tr.push(trackAt((i * LOOP_LEN) / NS));
  const beside = (list, o) => list.map((t) => ({ x: t.x + t.nx * o, z: t.z + t.nz * o }));
  const inStation = (s, pad = 0) => PLACES.some((p) => Math.abs(shortWay(p.s, s)) < straightHalf(p.id) + pad);
  // a slim white wing over a narrow keel, with a thin red light strip along each edge
  fixed.add(ribbon(beside(tr, 0), 6.6, DECK, DECK - 0.34, { closed: true }), 'shell');
  fixed.add(ribbon(beside(tr, 0), 4.4, DECK - 0.34, DECK - 0.72, { closed: true }), 'shell');
  fixed.add(ribbon(beside(tr, 0), 2.3, DECK - 0.72, DECK - 1.35, { closed: true }), 'shell');
  for (const o of [-3.31, 3.31]) fixed.add(ribbon(beside(tr, o), 0.1, DECK - 0.06, DECK - 0.28, { closed: true }), 'strip');
  fixed.add(ribbon(beside(tr, 0), 3.1, DECK + 0.07, DECK, { closed: true }), 'ballast');
  for (const o of [-0.72, 0.72]) fixed.add(ribbon(beside(tr, o), 0.13, DECK + 0.24, DECK + 0.08, { closed: true }), 'rail');
  tr.forEach((t) => fixed.bx('sleeper', t.x, -t.z, DECK + 0.11, [2.5, 0.34, 0.1], Math.atan2(-t.nz, t.nx)));
  { // the walkway rail on both edges, left open where a station's platforms are
    let run = []; const flush = () => { if (run.length > 2) for (const o of [-3.38, 3.38]) { fixed.add(ribbon(beside(run, o), 0.12, DECK + 0.92, DECK + 0.84), 'shell'); fixed.add(ribbon(beside(run, o), 0.03, DECK + 0.84, DECK), 'glass'); } run = []; };
    for (let i = 0; i <= NS; i++) { const s = ((i % NS) * LOOP_LEN) / NS; if (inStation(s, 1)) flush(); else run.push(tr[i % NS]); } flush(); }
  for (let s = 16; s < LOOP_LEN; s += 30) { if (inStation(s, 3)) continue; const t = trackAt(s); const g0 = Math.max(0, height(t.x, t.z)); const top = DECK - 1.35; const h = top - g0; fixed.cyl('shell', t.x, -t.z, g0 - 0.3 + (h - 1.5) / 2, 0.95, h - 1.5 + 0.6, 0.62, 20).cyl('shell', t.x, -t.z, top - 0.75, 0.62, 1.5, 1.45, 20); }
  // the hill tram: two rails on sleepers on a bed of ballast, climbing the hill
  const tramPts = []; for (let i = 0; i <= 64; i++) tramPts.push({ x: TRAM.x, z: TRAM.z0 + ((TRAM.z1 - TRAM.z0) * i) / 64 });
  fixed.add(ribbon(tramPts, 3.4, gy(0.3), gy(-0.8), { caps: true }), 'ballast');
  for (const o of [-0.72, 0.72]) fixed.add(ribbon(tramPts.map((q) => ({ x: q.x + o, z: q.z })), 0.12, gy(0.52), gy(0.3)), 'rail');
  for (let z = TRAM.z0; z > TRAM.z1; z -= 1.25) fixed.bx('sleeper', TRAM.x, -z, height(TRAM.x, z) + 0.36, [2.4, 0.3, 0.14]);
  { const top = tramAt(1); fixed.bx('pave', top.x + 3.4, -(top.z + 1), top.y + 0.2, [3.4, 11, 1.2]); occupied.push([top.x, top.z, 12]); }
  for (let z = TRAM.z0; z > TRAM.z1; z -= 6) occupied.push([TRAM.x, z, 6]);

  /* ---------- the stops: a station and a building each ---------- */
  const stops = []; const byId = {}; const riseGroups = []; const spinners = []; const proxies = [];
  const riser = (order) => { const g = new THREE.Group(); g.userData.order = order; scene.add(g); riseGroups.push(g); return g; };
  function addProxy(target, x, y, z, w, h, d, yaw) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y + h / 2, z); m.rotation.y = yaw; m.updateMatrixWorld(true); m.userData.target = target; proxies.push(m); }
  function station(place, big, faceIn, group) {
    const t = trackAt(place.s); const g0 = Math.max(0.4, height(t.x, t.z)); const rise = DECK - g0;
    const model = getModel(big ? 'station_main' : 'station', () => standStation(big, rise));
    const deckTop = model.def && model.def.track && model.def.track.deckTop; // a real station carries its own deck height
    const st = spawn(model); const f = faceIn ? 1 : -1; st.position.set(t.x, deckTop ? DECK - deckTop : g0, t.z); st.rotation.y = yawTo(t.nx * f, t.nz * f); group.add(st);
    occupied.push([t.x, t.z, big ? 46 : 30]);
    addProxy(place.id, t.x, g0, t.z, model.size[0], Math.max(model.size[1], rise + 8), Math.max(12, model.size[2]), st.rotation.y);
    const d = doorOf(model, [0, model.size[2] / 2]);
    return { t, g0, door: local(st, d[0], d[1]), model, st };
  }
  const levelName = (n) => ['', 'Lot', 'Site', 'Open', 'Live', 'Thriving'][n];
  function buildingFor(stop, level) {
    if (level <= 1) return getModel('lot', () => standLot(stop.district));
    if (level === 2) { const b = lib && lib.manifest && lib.manifest.buildings && lib.manifest.buildings[stop.id]; const name = (b && b.nodes && b.nodes[2]) || (stop.big ? 'site_large' : 'site_small'); return getModel(name, () => standSite(name === 'site_large')); }
    for (let l = level; l >= 3; l--) { const m = lib && lib.get(`${stop.model}_L${l}`); if (m) { if (!cache.has(m.name)) { cache.set(m.name, m); used.real.push(m.name); tintGeo(m.geo, lin(DCOL[stop.district] || '#D5281E')); } return m; } }
    return getModel(`${stop.model}_L${level}`, () => standBuilding(stop, level));
  }
  // the main station
  const mainGroup = riser(-1);
  { const { t } = station(placeById.main, true, false, mainGroup); byId.main = { id: 'main', s: 0, x: t.x, z: t.z, y: DECK, nx: t.nx, nz: t.nz, tx: t.tx, tz: t.tz, side: 1, front: 1, bx: t.x, bz: t.z, by: height(t.x, t.z), size: [64, 24, 44], color: '#16171A' }; }
  STOPS.forEach((stop, i) => {
    const place = placeById[stop.id]; const level = (levels && levels[stop.id]) || 1; const group = riser(i);
    const inward = stop.side !== 'sea'; const { t, door: stDoor } = station(place, false, inward, group);
    const off = inward ? PLACING.inOffset : -PLACING.seaOffset; const bx = t.x + t.nx * off; const bz = t.z + t.nz * off;
    const model = buildingFor(stop, level);
    const hw = model.size[0] / 2; const hd = model.size[2] / 2; const f = inward ? 1 : -1; const fx = -t.nx * f; const fz = -t.nz * f; // the building's front looks back at the track
    let hi = height(bx, bz); let lo = hi; for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) { const hh = height(bx + fz * u * hw * 0.8 + fx * v * hd * 0.8, bz - fx * u * hw * 0.8 + fz * v * hd * 0.8); hi = Math.max(hi, hh); lo = Math.min(lo, hh); }
    const by = Math.max(0.6, level <= 2 ? (hi + lo) / 2 : lo + (hi - lo) * 0.7);
    const b = spawn(model); b.position.set(bx, by, bz); b.rotation.y = yawTo(fx, fz); group.add(b);
    if (!model.real && (hi - lo > 0.3 || lo < 0.6)) { const k = new Kit(); k.bx('pave', 0, 0, -3, [model.size[0] * 0.96, model.size[2] * 0.96, 6.2]); const base = new THREE.Mesh(k.geo().city, MAT.city); base.position.copy(b.position); base.rotation.y = b.rotation.y; base.receiveShadow = true; group.add(base); }
    if (b.userData.kids.jib) spinners.push({ o: b.userData.kids.jib, kind: 'jib', seed: i * 1.7 });
    // its street: from the coast road, under the track, to the front door
    // its street: from the coast road, past the station's door, to the building's door
    const bd = doorOf(model, [0, hd]); const bDoor = local(b, bd[0], bd[1] - 2); const street = [];
    if (inward) { const along = (stDoor.x - t.x) * t.tx + (stDoor.z - t.z) * t.tz; const mpd = Math.hypot(LOOP.rx * Math.sin(place.angle * D2R), LOOP.rz * Math.cos(place.angle * D2R)) * D2R; const a2 = place.angle + along / mpd + Math.sign(along || 1) * 0.9;
      for (let k = 0; k <= 3; k++) street.push(loopOffset(a2, ROADS.coastOffset + ((12 - ROADS.coastOffset) * k) / 3)); }
    else street.push(stDoor);
    const last = street[street.length - 1]; for (let k = 1; k <= 4; k++) street.push({ x: last.x + ((bDoor.x - last.x) * k) / 4, z: last.z + ((bDoor.z - last.z) * k) / 4 });
    addRoad(street, ROADS.streetWidth);
    occupied.push([bx, bz, Math.max(hw, hd) * 1.25]);
    addProxy(stop.id, bx, by, bz, model.size[0], Math.max(8, model.size[1]), model.size[2], b.rotation.y);
    const info = { id: stop.id, i, s: place.s, x: t.x, z: t.z, y: DECK, nx: t.nx, nz: t.nz, tx: t.tx, tz: t.tz, side: f, front: f, bx, bz, by, size: model.size, level, color: DCOL[stop.district] || '#16171A', group, real: model.real };
    stops.push(info); byId[stop.id] = info;
  });
  // empty plots for what comes next, in the gap before the main station
  for (let k = 0; k < PLACING.nextPlots; k++) {
    const a = stopAngle(STOPS.length) + 4 + k * 18; const p = loopOffset(a, 46); const n = loopOffset(a, 47);
    const lot = spawn(getModel('lot', () => standLot('software'))); lot.position.set(p.x, height(p.x, p.z), p.z); lot.rotation.y = yawTo(p.x - n.x, p.z - n.z); mainGroup.add(lot); occupied.push([p.x, p.z, 30]);
  }

  /* ---------- Kevin's tower and the hill tram ---------- */
  const towerGroup = riser(STOPS.length + 1);
  const towerModel = getModel('tower', () => standTower(TOWER.height)); if (towerModel.real) { tintGeo(towerModel.geo, [0.80, 0.11, 0.08]); Object.values(towerModel.kids).forEach((k) => tintGeo(k.geo, [0.80, 0.11, 0.08])); }
  const towerMat = twoLooks(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1, emissive: 0xffa24d, emissiveIntensity: 0 }), 'city');
  const towerY = height(TOWER.x, TOWER.z); const tower = spawn(towerModel); tower.traverse((o) => { if (o.isMesh && o.material === MAT.city) o.material = towerMat; }); tower.position.set(TOWER.x, towerY, TOWER.z); towerGroup.add(tower);
  const towerTop = towerY + (towerModel.real ? towerModel.size[1] - 28 : TOWER.height);
  occupied.push([TOWER.x, TOWER.z, 44]);
  addProxy('tower', TOWER.x, towerY, TOWER.z, 34, TOWER.height * 0.8, 34, 0); addProxy('tower', TOWER.x, towerY, TOWER.z, 12, TOWER.height + 20, 12, 0);
  byId.tower = { id: 'tower', x: TOWER.x, z: TOWER.z, y: towerY, bx: TOWER.x, bz: TOWER.z, by: towerY, size: [44, TOWER.height, 44], color: '#D5281E' };
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff3b24, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.position.set(TOWER.x, towerTop + 28, TOWER.z); halo.scale.setScalar(70); scene.add(halo);
  const uplight = new THREE.PointLight(0xffb060, 0, 300, 1.6); uplight.position.set(TOWER.x + 20, towerY + 26, TOWER.z + 30); scene.add(uplight);
  const tramModel = getModel('tram', standTram); const tram = spawn(tramModel); scene.add(tram);
  const tramLong = alongX(tramModel); // which way the car lies in its file

  /* ---------- the train: an end car, two middle cars, an end car ---------- */
  const carEnd = getModel('train_end', () => standCar(true)); const carMid = getModel('train_mid', () => standCar(false));
  const carLong = alongX(carEnd); const CAR_LEN = ((carEnd.def && carEnd.def.length) || (carLong ? carEnd.size[0] : carEnd.size[2])) + 0.7;
  const train = new THREE.Group(); scene.add(train);
  const cars = [0, 1, 2, 3].map((k) => { const m = k === 0 || k === 3 ? carEnd : carMid; const c = spawn(m); c.userData.off = (1.5 - k) * CAR_LEN; c.userData.flip = k === 3 ? Math.PI : 0; c.userData.open = Object.fromEntries(((m.def && m.def.doors) || []).map((d) => [d.name.replace(`${m.name}_`, ''), d.open])); train.add(c); return c; });
  const TRAIN_Y = DECK + 0.22;
  function setTrain(s, doors = 0) {
    cars.forEach((c) => {
      const t = trackAt(s + c.userData.off); c.position.set(t.x, TRAIN_Y, t.z);
      c.rotation.y = yawTo(t.tx, t.tz) + c.userData.flip + (carLong ? -Math.PI / 2 : 0);
      for (const [name, d] of Object.entries(c.userData.kids)) { if (!/^door/.test(name)) continue; if (d.userData.home === undefined) d.userData.home = d.position.clone(); const o = c.userData.open[name]; d.position.copy(d.userData.home); if (o) { d.position.x += o[0] * doors; d.position.y += o[1] * doors; d.position.z += o[2] * doors; } else { const n = parseInt(name.replace(/\D+/g, ''), 10) || 1; d.position.z += (n % 2 ? 1 : -1) * doors * 0.7; } }
    });
  }
  const tramOpen = Object.fromEntries(((tramModel.def && tramModel.def.doors) || []).map((d) => [d.name.replace('tram_', ''), d.open]));
  function setTram(u, doors = 0) { const p = tramAt(u);
    for (const [name, d] of Object.entries(tram.userData.kids)) { const o = tramOpen[name]; if (!o) continue; if (d.userData.home === undefined) d.userData.home = d.position.clone(); d.position.set(d.userData.home.x + o[0] * doors, d.userData.home.y + o[1] * doors, d.userData.home.z + o[2] * doors); } tram.position.set(p.x, p.y + (tramModel.real ? 0.52 : 1.0), p.z); tram.rotation.set(0, 0, 0); tram.rotation.order = 'YXZ'; tram.rotation.y = tramLong ? Math.PI / 2 : Math.PI; if (tramLong) tram.rotation.z = p.slope; else tram.rotation.x = -p.slope; }

  /* ---------- houses, trees, lamps, the beach, the lighthouse ---------- */
  const R = rng(7); const pick = (a) => a[Math.floor(R() * a.length)];
  const free = (x, z, pad = 0) => !occupied.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r + pad);
  const houseSpots = [];
  { let tries = 0; const names = ['house_a', 'house_b', 'house_c', 'house_d'];
    while (houseSpots.length < LIFE.houses && tries++ < 6000) {
      const i = Math.floor(R() * (STOPS.length + 1)); const a = (i === STOPS.length ? LOOP.mainAngle : stopAngle(i)) + (R() - 0.5) * SLOT * 0.96; const p = loopPoint(a); const L = Math.hypot(p.x, p.z);
      const out = R() < 0.66; const d = out ? 30 + R() * 22 : -(88 + R() * 32); const x = p.x + (p.x / L) * d; const z = p.z + (p.z / L) * d;
      if (edge(x, z) > 0.925 || !free(x, z, 9) || Math.abs(x) < 9 || hillHeight(x, z) > 9) continue;
      houseSpots.push({ x, z, y: height(x, z), yaw: Math.atan2(p.x, p.z) + (out ? 0 : Math.PI) + pick([0, 0, Math.PI / 2]), name: pick(names), a, s: 0.95 + R() * 0.25 }); occupied.push([x, z, 8]);
    } }
  houseSpots.sort((p, q) => sOfAngle(p.a) - sOfAngle(q.a));
  const houseSets = {}; ['house_a', 'house_b', 'house_c', 'house_d'].forEach((n) => { const list = houseSpots.filter((h) => h.name === n); if (list.length) houseSets[n] = { list, im: inst(prop(n), list.length) }; });
  function setHouses(k) { // k: 0 none … 1 all, in order round the loop
    const n = houseSpots.length;
    Object.values(houseSets).forEach(({ list, im }) => { list.forEach((h, i) => { const o = houseSpots.indexOf(h); const g = clamp(k * (n + 5) - o, 0, 1) / 1; const sc = g <= 0 ? 0.0001 : h.s * backOut(Math.min(1, g)); im.set(i, M4.compose(V.set(h.x, h.y, h.z), Q.setFromAxisAngle(YAX, h.yaw), SC.set(sc, sc, sc))); }); im.done(); });
  }
  { const sets = { tree_a: [], tree_b: [], tree_c: [], tree_pine: [], palm: [] }; let made = 0; let tries = 0;
    while (made < LIFE.trees && tries++ < 30000) {
      const x = (R() * 2 - 1) * ISLAND.rx; const z = (R() * 2 - 1) * ISLAND.rz; const e = edge(x, z);
      if (e > 0.91 || Math.abs(Math.hypot(x / LOOP.rx, z / LOOP.rz) - 1) * Math.min(LOOP.rx, LOOP.rz) < 11 || !free(x, z, 1.5)) continue;
      if (R() > 0.2 + 0.8 * Math.min(1, hillHeight(x, z) / 12)) continue;
      sets[pick(['tree_a', 'tree_a', 'tree_b', 'tree_b', 'tree_c', 'tree_pine'])].push({ x, z, s: 0.8 + R() * 0.55, yaw: R() * 6.28, tone: 0.82 + R() * 0.3 }); made++;
    }
    for (let k = 0; k < 11; k++) { const p = coastPoint(LIFE.beach.fromAngle - 4 + ((LIFE.beach.toAngle - LIFE.beach.fromAngle + 8) * k) / 10 + (R() - 0.5) * 2, 0.9 + R() * 0.02); if (free(p.x, p.z, 2)) sets.palm.push({ x: p.x, z: p.z, s: 0.9 + R() * 0.4, yaw: R() * 6.28, tone: 1 }); }
    const c = new THREE.Color();
    Object.entries(sets).forEach(([name, list]) => { if (!list.length) return; const tm = prop(name); const im = inst(tm, list.length, { skin: MAT.tree }); list.forEach((t, i) => { im.set(i, mat4(t.x, height(t.x, t.z) - (tm.real ? 0 : 0.2), t.z, t.yaw, t.s)); im.color(i, c.setRGB(t.tone, t.tone * (0.96 + R() * 0.08), t.tone * 0.92)); }); im.done(); });
  }
  const lampSpots = []; for (let a = 2; a < 360; a += 7.2) { const p = loopOffset(a, ROADS.coastOffset - ROADS.coastWidth / 2 - 1.4); const q = loopOffset(a, ROADS.coastOffset); if (edge(p.x, p.z) < 0.97) lampSpots.push({ x: p.x, z: p.z, y: Math.max(0.4, height(p.x, p.z)), yaw: yawTo(q.x - p.x, q.z - p.z) }); }
  stops.forEach((s) => { const p = loopOffset(placeById[s.id].angle + 1.6, s.side * 20); const q = loopOffset(placeById[s.id].angle, s.side * 20); lampSpots.push({ x: p.x, z: p.z, y: height(p.x, p.z), yaw: yawTo(q.x - p.x, q.z - p.z) }); });
  { const im = inst(prop('streetlamp'), lampSpots.length, { cast: false }); lampSpots.forEach((l, i) => im.set(i, mat4(l.x, l.y, l.z, l.yaw))); im.done(); }
  const pools = new THREE.InstancedMesh(new THREE.CircleGeometry(11, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xffc27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), lampSpots.length);
  lampSpots.forEach((l, i) => pools.setMatrixAt(i, mat4(l.x + Math.sin(l.yaw) * 2, l.y + 0.5, l.z + Math.cos(l.yaw) * 2))); pools.frustumCulled = false; pools.visible = false; pools.renderOrder = 2; scene.add(pools);
  { const benches = []; stops.forEach((s) => { for (const u of [-1, 1]) { const p = loopOffset(placeById[s.id].angle + u * 1.3, s.side * 13); benches.push({ x: p.x, z: p.z, yaw: yawTo(-s.nx * s.side, -s.nz * s.side) }); } }); const im = inst(prop('bench'), benches.length, { cast: false }); benches.forEach((b, i) => im.set(i, mat4(b.x, height(b.x, b.z), b.z, b.yaw))); im.done(); }
  { const n = LIFE.beach.umbrellas; const umm = prop('umbrella'); const um = inst(umm, n); const beds = inst(prop('sunbed'), n * 2, { cast: false }); const c = new THREE.Color(); const cols = ['#D5281E', '#E0A800', '#1F4FD8', '#F4F4F2', '#E8731A'];
    for (let i = 0; i < n; i++) { const a = LIFE.beach.fromAngle + ((LIFE.beach.toAngle - LIFE.beach.fromAngle) * (i + 0.5)) / n; const p = coastPoint(a, 0.945 + (i % 2) * 0.018); const y = height(p.x, p.z); const yaw = Math.atan2(p.x, p.z); um.set(i, mat4(p.x, y, p.z, yaw + i * 1.3, 1.5)); if (!umm.real) um.color(i, c.set(cols[i % cols.length])); for (const u of [-1, 1]) beds.set(i * 2 + (u > 0 ? 1 : 0), mat4(p.x + Math.cos(yaw) * u * 2.6, y + 0.05, p.z - Math.sin(yaw) * u * 2.6, yaw + Math.PI + (alongX(prop('sunbed')) || prop('sunbed').real ? Math.PI / 2 : 0), 1.6)); }
    um.done(); beds.done(); }
  const lightPos = coastPoint(LIFE.lighthouse.angle, LIFE.lighthouse.edge); const lightY = height(lightPos.x, lightPos.z);
  const lighthouse = spawn(getModel('lighthouse', () => standProp('lighthouse'))); lighthouse.position.set(lightPos.x, lightY + 0.4, lightPos.z); lighthouse.rotation.y = yawTo(-lightPos.x, -lightPos.z); scene.add(lighthouse); occupied.push([lightPos.x, lightPos.z, 9]);
  const lampKid = lighthouse.userData.kids.lamp; const lampY = lampKid ? lampKid.position.y : 29;
  const beam = new THREE.Group(); beam.position.set(lightPos.x, lightY + lampY, lightPos.z); scene.add(beam);
  { const g = new THREE.CylinderGeometry(0.5, 16, 260, 20, 1, true).rotateZ(Math.PI / 2).translate(130, 0, 0); const m = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }); const a = new THREE.Mesh(g, m); const b = new THREE.Mesh(g, m); b.rotation.y = Math.PI; beam.add(a, b); beam.userData.mat = m; beam.visible = false; }

  // every fixed thing drawn so far: one mesh per material
  { const g = fixed.geo(); meshesOf(g, true).forEach((m) => scene.add(m)); const r = roadKit.geo(); const rm = new THREE.Mesh(r.city, MAT.matte); rm.receiveShadow = true; scene.add(rm); }

  /* ---------- island life ---------- */
  let wakeMat = null; const life = []; const extras = [{ id: 'x:lighthouse', name: 'Lighthouse', r: 13, d: 120, at: () => [lightPos.x, lightY + 14, lightPos.z] }];
  // cars and buses on the coast road, a few on the hill road
  { const names = ['car_a', 'car_b', 'car_c']; const tints = ['#F4F4F2', '#CC1F1A', '#1F4DB3', '#F2BC1A', '#33363C', '#2E8B6B', '#F4F4F2']; const c = new THREE.Color();
    const list = []; for (let k = 0; k < LIFE.cars; k++) { const bus = R() < 0.12; const lane = R() < 0.5 ? -2.2 : 2.2; list.push({ a: R() * 360, lane, dir: lane > 0 ? 1 : -1, v: (bus ? 8 : 9.5) + R() * 5, name: bus ? 'bus' : pick(names), tint: pick(tints) }); }
    let hl = 0; const hillLen = [0]; for (let i = 1; i < hillRoad.length; i++) { hl += Math.hypot(hillRoad[i].x - hillRoad[i - 1].x, hillRoad[i].z - hillRoad[i - 1].z); hillLen.push(hl); }
    for (let k = 0; k < 5; k++) list.push({ hill: true, d: R() * hl, dir: R() < 0.5 ? 1 : -1, v: 6 + R() * 3, name: pick(names), tint: pick(tints) });
    const sets = {}; ['car_a', 'car_b', 'car_c', 'bus'].forEach((n) => { const mine = list.filter((x) => x.name === n); if (!mine.length) return; const m = prop(n); const im = inst(m, mine.length); mine.forEach((x, i) => { x.i = i; x.im = im; x.m = m; if (!m.real && n !== 'bus') im.color(i, c.set(x.tint)); }); sets[n] = im; });
    const hillAt = (d) => { let i = 1; while (i < hillLen.length - 1 && hillLen[i] < d) i++; const f = (d - hillLen[i - 1]) / (hillLen[i] - hillLen[i - 1] || 1); const a = hillRoad[i - 1]; const b = hillRoad[i]; return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, dx: b.x - a.x, dz: b.z - a.z }; };
    life.push((dt) => {
      list.forEach((x) => {
        let px; let pz; let fx; let fz;
        if (x.hill) { x.d += x.dir * x.v * dt; if (x.d > hl - 4) { x.d = hl - 4; x.dir = -1; } if (x.d < 30) { x.d = 30; x.dir = 1; } const h = hillAt(x.d); const L = Math.hypot(h.dx, h.dz) || 1; fx = (h.dx / L) * x.dir; fz = (h.dz / L) * x.dir; px = h.x + fz * 1.5; pz = h.z - fx * 1.5; } else {
          const t = loopTangent(x.a); const p0 = loopPoint(x.a); const mpd = Math.hypot(LOOP.rx * Math.sin(x.a * D2R), LOOP.rz * Math.cos(x.a * D2R)) * D2R; x.a = (x.a + (x.dir * x.v * dt) / mpd + 360) % 360; void p0;
          const p = loopOffset(x.a, ROADS.coastOffset + x.lane); px = p.x; pz = p.z; fx = t.x * x.dir; fz = t.z * x.dir;
        }
        const y = Math.max(0.4, height(px, pz)) + 0.32; const y2 = Math.max(0.4, height(px + fx * 3, pz + fz * 3)) + 0.32;
        x.im.set(x.i, heading(x.m, px, y, pz, fx, fz, 1, Math.atan2(y2 - y, 3)));
      });
      Object.values(sets).forEach((im) => im.done());
    });
  }
  // boats, the ferry
  { const sailM = prop('boat_sail'); const fishM = prop('boat_fishing'); const ferryM = prop('ferry'); const sail = inst(sailM, LIFE.boats.sail, { cast: false }); const fish = inst(fishM, LIFE.boats.fishing, { cast: false });
    const wakeTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(32, 0); x.lineTo(64, 256); x.lineTo(46, 256); x.lineTo(32, 40); x.lineTo(18, 256); x.lineTo(0, 256); x.closePath(); x.fill(); x.globalAlpha = 0.35; x.beginPath(); x.moveTo(32, 0); x.lineTo(46, 256); x.lineTo(18, 256); x.closePath(); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const NW = LIFE.boats.sail + LIFE.boats.fishing + 1; wakeMat = new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, opacity: 0.55, depthWrite: false }); const wakes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), wakeMat, NW); wakes.frustumCulled = false; wakes.renderOrder = 2; scene.add(wakes);
    const wake = (k, x, z, fx, fz, wide, long) => wakes.setMatrixAt(k, M4.compose(V.set(x, 0.07, z), Q.setFromAxisAngle(YAX, yawTo(-fx, -fz)), SC.set(Math.max(0.01, wide), 1, Math.max(0.01, long))));
    const boats = []; for (let i = 0; i < LIFE.boats.sail; i++) boats.push({ im: sail, m: sailM, i, a: 20 + i * 67 + R() * 30, e: 1.22 + R() * 0.35, w: (0.25 + R() * 0.2) * (R() < 0.5 ? -1 : 1), ph: R() * 6 });
    for (let i = 0; i < LIFE.boats.fishing; i++) boats.push({ im: fish, m: fishM, i, a: 100 + i * 95 + R() * 30, e: 1.14 + R() * 0.12, w: 0.05 * (R() < 0.5 ? -1 : 1), ph: R() * 6 });
    const ferry = spawn(ferryM, { cast: false }); scene.add(ferry); const dock = byId[(STOPS.find((s) => s.side === 'sea') || STOPS[0]).id];
    const fdx = -dock.nx; const fdz = -dock.nz; const fx0 = dock.x + fdx * 150 + dock.tx * 46; const fz0 = dock.z + fdz * 150 + dock.tz * 46;
    boats.forEach((b, k) => extras.push({ id: `x:boat${k}`, name: b.im === sail ? 'Sailing boat' : 'Fishing boat', r: 8, d: 75, at: () => [b.x || 0, 3, b.z || 0] }));
    extras.push({ id: 'x:ferry', name: 'Ferry', r: 16, d: 150, at: () => [ferry.position.x, 5, ferry.position.z] });
    life.push((dt, t) => {
      boats.forEach((b, k) => { b.a += b.w * dt; const p = coastPoint(b.a, b.e); const q = coastPoint(b.a + Math.sign(b.w), b.e); b.x = p.x; b.z = p.z; { const L = Math.hypot(q.x - p.x, q.z - p.z) || 1; const sp = Math.abs(b.w) * 4; wake(k, p.x - ((q.x - p.x) / L) * 3, p.z - ((q.z - p.z) / L) * 3, (q.x - p.x) / L, (q.z - p.z) / L, 5 + sp * 5, 10 + sp * 26); } b.im.set(b.i, heading(b.m, p.x, Math.sin(t * 1.1 + b.ph) * 0.25 - (b.m.real ? 0 : 0.15), p.z, q.x - p.x, q.z - p.z, b.m.real ? 1.25 : 1.5, Math.sin(t * 0.9 + b.ph) * 0.04, Math.sin(t * 0.7 + b.ph) * 0.06)); });
      sail.done(); fish.done();
      const T = 90; const u = (t % T) / T; const out = 0.5 - 0.5 * Math.cos(u * Math.PI * 2); const d = out * 520; const turn = smooth(0.42, 0.58, u) * Math.PI;
      ferry.position.set(fx0 + fdx * d + dock.tx * Math.sin(turn) * 40, Math.sin(t * 0.8) * 0.2 - (ferryM.real ? 0 : 0.3), fz0 + fdz * d + dock.tz * Math.sin(turn) * 40);
      { const sp = Math.abs(Math.sin(u * Math.PI * 2)); const hx = Math.sin(yawTo(fdx, fdz) + turn); const hz = Math.cos(yawTo(fdx, fdz) + turn); wake(NW - 1, ferry.position.x - hx * 14, ferry.position.z - hz * 14, hx, hz, 16 * sp, 90 * sp); wakes.instanceMatrix.needsUpdate = true; } ferry.rotation.y = yawTo(fdx, fdz) + turn + (alongX(ferryM) ? -Math.PI / 2 : 0);
    });
  }
  // gulls circling, dolphins jumping, sheep and deer on the hill, dogs running
  { const gm = prop('gull'); const gullX = alongX(gm); const gulls = inst(gm, LIFE.animals.gulls, { cast: false }); const turn = new THREE.Matrix4(); const body = new THREE.Matrix4();
    const homes = [lightPos, coastPoint(60, 1.02), { x: byId[STOPS[1] ? STOPS[1].id : 'main'].bx, z: byId[STOPS[1] ? STOPS[1].id : 'main'].bz }, coastPoint(250, 1.0)];
    const G = []; for (let i = 0; i < LIFE.animals.gulls; i++) { const h = homes[i % homes.length]; G.push({ x: h.x, z: h.z, r: 22 + R() * 46, y: 26 + R() * 34, w: (0.22 + R() * 0.2) * (R() < 0.5 ? -1 : 1), ph: R() * 6.28, fl: 5 + R() * 3 }); }
    const dm = prop('dolphin'); const dol = inst(dm, LIFE.animals.dolphins, { cast: false }); const Dn = []; for (let i = 0; i < LIFE.animals.dolphins; i++) Dn.push({ a: 62 + i * 9 + R() * 4, e: 1.2 + R() * 0.08, t0: R() * 5, per: 4.6 + R() * 2.4 });
    const sm = prop('sheep'); const sheep = inst(sm, LIFE.animals.sheep, { skin: MAT.matte }); const deM = prop('deer'); const dgM = prop('dog'); const de = inst(deM, LIFE.animals.deer, { skin: MAT.matte }); const dg = inst(dgM, LIFE.animals.dogs, { skin: MAT.matte });
    const walkers = []; let guard = 0;
    const place = (im, m, i, test, r, v) => { for (;;) { const x = (R() * 2 - 1) * 200; const z = ISLAND.hill.z + (R() * 2 - 1) * 110; if (++guard > 4000 || (test(x, z) && free(x, z, 5))) { walkers.push({ im, m, i, x, z, r, v, ph: R() * 6.28, s: 1.7 }); occupied.push([x, z, 3]); return; } } };
    for (let i = 0; i < LIFE.animals.sheep; i++) place(sheep, sm, i, (x, z) => hillHeight(x, z) > 4 && hillHeight(x, z) < 20 && z > 20, 2.5 + R() * 3, 0.35);
    for (let i = 0; i < LIFE.animals.deer; i++) place(de, deM, i, (x, z) => hillHeight(x, z) > 12 && hillHeight(x, z) < 30, 4 + R() * 4, 0.5);
    for (let i = 0; i < LIFE.animals.dogs; i++) { const p = coastPoint(LIFE.beach.fromAngle + 8 + i * 12, 0.93); walkers.push({ im: dg, m: dgM, i, x: p.x, z: p.z, r: 7 + R() * 5, v: 3.4, ph: R() * 6.28, s: 1.6, eight: true }); }
    life.push((dt, t) => {
      G.forEach((g, i) => { const a = g.ph + t * g.w; const x = g.x + Math.cos(a) * g.r; const z = g.z + Math.sin(a) * g.r; const dir = Math.sign(g.w); body.copy(heading(gm, x, g.y + Math.sin(t * 0.5 + g.ph) * 3, z, -Math.sin(a) * dir, Math.cos(a) * dir, 2.2, 0, -0.35 * dir)); gulls.set(i, body); const f = Math.sin(t * g.fl + g.ph) * 0.55; if (gullX) { gulls.kid('wing_l', i, body, turn.makeRotationX(f)); gulls.kid('wing_r', i, body, turn.makeRotationX(-f)); } else { gulls.kid('wing_l', i, body, turn.makeRotationZ(-f)); gulls.kid('wing_r', i, body, turn.makeRotationZ(f)); } });
      gulls.done();
      Dn.forEach((d, i) => { const k = ((t + d.t0) % d.per) / 1.5; const lap = Math.floor((t + d.t0) / d.per); const a = d.a + (lap % 5) * 2.2; const p = coastPoint(a + Math.min(1, k) * 0.9, d.e); const q = coastPoint(a + 2, d.e); if (k >= 1) dol.set(i, mat4(p.x, -9, p.z, 0, 0.001)); else dol.set(i, heading(dm, p.x, Math.sin(Math.PI * k) * 3.6 - 1.4, p.z, q.x - p.x, q.z - p.z, 1.7, Math.cos(Math.PI * k) * 0.95)); });
      dol.done();
      walkers.forEach((w) => { const a = w.ph + (t * w.v) / w.r; const x = w.x + Math.cos(a) * w.r; const z = w.z + (w.eight ? Math.sin(a * 2) * w.r * 0.5 : Math.sin(a) * w.r); const dx = -Math.sin(a); const dz = w.eight ? Math.cos(a * 2) : Math.cos(a); w.im.set(w.i, heading(w.m, x, height(x, z), z, dx, dz, w.s)); });
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
    SU.uFoam.value.set(night ? '#5f7f95' : '#eaf7f4'); SU.uSky.value.copy(zen).lerp(hor, 0.25); SU.uRough.value = rainy ? 2.4 : 1;
    U.uLit.value = Math.max(T.lit, rainy ? 0.35 : foggy ? 0.2 : 0); U.uGlow.value = 0.22 + 1.7 * U.uLit.value; if (typeof wakeMat !== 'undefined' && wakeMat) wakeMat.opacity = 0.55 * (1 - 0.82 * U.uLit.value);
    pools.visible = U.uLit.value > 0.15; pools.material.opacity = 0.6 * U.uLit.value; uplight.intensity = 900 * Math.max(0, U.uLit.value - 0.2); towerMat.emissiveIntensity = 0.42 * Math.max(0, U.uLit.value - 0.15) * (state.look === 'model' ? 0.4 : 1); beam.visible = U.uLit.value > 0.15; beam.userData.mat.opacity = 0.16 * U.uLit.value; halo.material.opacity = 0.9 * U.uLit.value;
    renderer.toneMappingExposure = T.expo * (state.look === 'model' ? 1.06 : 1) * (rainy ? 0.92 : 1);
    rain.visible = rainy; rainU.uA.value = night ? 0.3 : 0.5; setBloom(U.uLit.value > 0.6);
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
  const home = { pos: new THREE.Vector3(), target: new THREE.Vector3(...VIEW.target), fov: VIEW.lens };
  function fit() {
    const w = host.clientWidth || 1; const h = host.clientHeight || 1; const aspect = w / h; camera.aspect = aspect;
    home.fov = VIEW.lens + (1 - smooth(0.7, 1.5, aspect)) * 12;
    const hf = Math.atan(Math.tan((home.fov * D2R) / 2) * aspect); const need = aspect < 1 ? 350 : 405; const dist = Math.max(VIEW.distance * (aspect < 1 ? 0.6 : 1), need / Math.tan(hf));
    const el = (VIEW.elevation + (aspect < 1 ? 16 : 0)) * D2R; const az = VIEW.azimuth * D2R;
    home.pos.set(home.target.x - Math.sin(az) * Math.cos(el) * dist, home.target.y + Math.sin(el) * dist, home.target.z + Math.cos(az) * Math.cos(el) * dist);
    controls.maxDistance = dist * 1.12; home.dist = dist;
  }
  const solids = [...stops.map((p) => ({ x: p.bx, z: p.bz, r: Math.min(p.size[0], p.size[2]) * 0.5 + 5, top: p.by + p.size[1] + 3 })), { x: TOWER.x, z: TOWER.z, r: 24, top: towerY + 120 }, { x: byId.main.x, z: byId.main.z, r: 26, top: DECK + 14 }];
  const rig = { mode: 'orbit', tween: null, subj: null, blend: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: VIEW.lens, t: 0 };
  const lookNow = new THREE.Vector3();
  function clampTarget() { const t = controls.target; const e = edge(t.x, t.z); if (e > 1.04) { t.x *= 1.04 / e; t.z *= 1.04 / e; } t.y = clamp(t.y, 0, 150); }
  controls.addEventListener('change', clampTarget);
  function setOrbit(pos, target, fov) { train.visible = true; tram.visible = true; controls.autoRotate = false; camera.position.copy(pos); controls.target.copy(target); camera.fov = fov; camera.near = 4; camera.updateProjectionMatrix(); camera.lookAt(target); controls.enabled = true; rig.mode = 'orbit'; rig.tween = null; controls.update(); }
  /** Glide the camera to a pose, then hand it back to the visitor. */
  function flyTo(pos, target, fov = home.fov, dur = 1.1, after = null) {
    if (reduce || dur <= 0) { setOrbit(pos, target, fov); if (after) after(); return; }
    rig.mode = 'tween'; controls.enabled = false; train.visible = true; tram.visible = true;
    rig.tween = { p0: camera.position.clone(), t0: lookNow.clone(), f0: camera.fov, p1: pos.clone(), t1: target.clone(), f1: fov, t: 0, dur, after };
  }
  function resetView(animated = true) { fit(); flyTo(home.pos, home.target, home.fov, animated ? 1.1 : 0); }
  /** The opening shot: start a little higher and further out, and settle on the default view. */
  function openingCamera(dur) { fit(); const far = home.pos.clone().sub(home.target).multiplyScalar(1.1).add(home.target); far.y += home.dist * 0.07; setOrbit(far, home.target, home.fov); flyTo(home.pos, home.target, home.fov, dur); }
  /** The hero shot of a place: its building front on, a little to the sunny side, sized to fill the part of
      the view that stays free when its page is open (the left of a wide screen, the top of a phone). */
  const sunDir = new THREE.Vector3(0, 1, 0);
  function heroPose(id) {
    const p = byId[id]; if (!p) return { pos: home.pos.clone(), target: home.target.clone(), fov: home.fov };
    const w = host.clientWidth || 1; const h = host.clientHeight || 1; const narrow = w / h < 1; const tower = id === 'tower';
    const fov = Math.max(home.fov, 32); const tv = Math.tan((fov * D2R) / 2);
    const H = tower ? towerTop + 26 - p.y : Math.max(p.size[1], 10); const W = tower ? 76 : Math.max(Math.min(p.size[0], 90), 30);
    const dist = Math.max((H * 1.5) / (2 * tv * (narrow ? 0.46 : 1)), (W * 1.5) / (2 * tv * (w / h) * (narrow ? 1 : 0.55)), 80);
    const fx = tower ? 0 : -p.nx * (p.front || 1); const fz = tower ? 1 : -p.nz * (p.front || 1);
    const el = (tower ? 8 : H < 30 ? 25 : 15) * D2R; let best = null; // low buildings are seen from higher up, over their station
    for (const turn of [0.42, -0.42]) { const c = Math.cos(turn); const sn = Math.sin(turn); const dx = fx * c - fz * sn; const dz = fx * sn + fz * c; const lit = dx * sunDir.x + dz * sunDir.z; if (!best || lit > best.lit) best = { dx, dz, lit }; }
    const target = new THREE.Vector3(p.bx, p.by + H * (tower ? 0.5 : 0.46), p.bz);
    const pos = new THREE.Vector3(target.x + best.dx * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + best.dz * Math.cos(el) * dist);
    pos.y = Math.max(pos.y, Math.max(0, height(pos.x, pos.z)) + 8);
    return { pos, target, fov };
  }
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
  function follow(subj) { if (rig.mode !== 'follow') { rig.blend = 0; rig.p0 = camera.position.clone(); rig.t0 = (rig.mode === 'orbit' ? controls.target : lookNow).clone(); rig.f0 = camera.fov; rig.have = false; } rig.mode = 'follow'; rig.subj = subj; controls.enabled = false; rig.tween = null; camera.near = 4; train.visible = true; tram.visible = true; }
  /** Sit inside the train (or the tram) and look out of the door side. */
  function inside(subj, what) { rig.mode = 'inside'; rig.subj = subj; controls.enabled = false; rig.tween = null; train.visible = what !== 'train'; tram.visible = what !== 'tram'; }
  const want = new THREE.Vector3(); const wantLook = new THREE.Vector3();
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
    // inside: at the middle of the car, looking out of the doors
    const sh = s.shift || 0; camera.position.set(s.x - s.ox * 0.6 + s.fx * sh, s.y + 2.25, s.z - s.oz * 0.6 + s.fz * sh); lookNow.set(s.x + s.ox * 30 + s.fx * (sh + (s.lead || 0)), s.y + 3.4 + (s.up || 0), s.z + s.oz * 30 + s.fz * (sh + (s.lead || 0)));
    camera.fov = camera.aspect < 1 ? 78 : 58; camera.near = 0.4; camera.updateProjectionMatrix(); camera.lookAt(lookNow);
  }

  /* ---------- the opening: an empty island, then everything rises ---------- */
  function setBuilt(order, k) { const g = riseGroups.find((x) => x.userData.order === order); if (!g) return; const on = k > 0.001; g.visible = on; if (on) { const e = backOut(clamp(k, 0, 1)); g.scale.set(0.88 + 0.12 * Math.min(1, e), Math.max(0.001, e), 0.88 + 0.12 * Math.min(1, e)); } }
  function setAllBuilt(k) { riseGroups.forEach((g) => setBuilt(g.userData.order, k)); setHouses(k); }
  // the tower rises about its own foot, not about the middle of the island
  towerGroup.position.set(TOWER.x, towerY, TOWER.z); tower.position.set(0, 0, 0);
  riseGroups.forEach((g) => { if (g === towerGroup) return; const o = g.userData.order; const p = o < 0 ? byId.main : stops[o]; const cx = (p.x + p.bx) / 2; const cz = (p.z + p.bz) / 2; const cy = 0.4; g.position.set(cx, cy, cz); g.children.forEach((c) => { c.position.x -= cx; c.position.y -= cy; c.position.z -= cz; }); });

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
  function screenOf(id, lift = 0) { const p = byId[id]; if (!p) return null; pv.set(p.bx, p.by + (id === 'tower' ? 120 : p.size[1]) + lift, p.bz).project(camera); if (pv.z > 1 || pv.z < -1) return null; const r = canvas.getBoundingClientRect(); return [r.left + ((pv.x + 1) / 2) * r.width, r.top + ((1 - pv.y) / 2) * r.height, camera.position.distanceTo(V.set(p.bx, p.by, p.bz))]; }

  /** The middle of a building on screen (page pixels): where a visitor would click it. */
  function pointOf(id) { const p = byId[id]; if (!p) return null; pv.set(p.bx, p.by + (id === 'tower' ? 60 : Math.min(p.size[1] * 0.5, 14)), p.bz).project(camera); if (pv.z > 1 || pv.z < -1) return null; const r = canvas.getBoundingClientRect(); return [r.left + ((pv.x + 1) / 2) * r.width, r.top + ((1 - pv.y) / 2) * r.height]; }

  /* ---------- every frame ---------- */
  let frames = 0; let clock = 0;
  function update(dt, sim) {
    clock += dt; SU.uT.value = clock; rainU.uT.value = clock; U.uTime.value = clock;
    setTrain(sim.train.s, sim.train.doors); setTram(sim.tram.u, sim.tram.doors || 0);
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
  function bloomSize() { const w = host.clientWidth || 1; const h = host.clientHeight || 1; if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); } }
  function setBloom(on) {
    bloomOn = on && !phone; if (!bloomOn || composer) return;
    try {
      const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(sz.x, sz.y, { type: THREE.HalfFloatType, samples: 4 }));
      composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(sz.x / 2, sz.y / 2), 0.42, 0.55, 0.92)); composer.addPass(new OutputPass()); bloomSize();
    } catch (e) { console.warn('Night bloom is not available here; drawing without it.', e); composer = null; bloomOn = false; }
  }
  function render() { if (bloomOn && composer) composer.render(); else renderer.render(scene, camera); frames++; }
  function resize() { const w = host.clientWidth || 1; const h = host.clientHeight || 1; renderer.setSize(w, h, false); bloomSize(); const was = home.dist; fit(); camera.aspect = w / h; if (rig.mode === 'orbit' && was && Math.abs(camera.position.distanceTo(controls.target) - was) < 2) setOrbit(home.pos, home.target, home.fov); else { camera.updateProjectionMatrix(); if (rig.mode === 'orbit') { const d = camera.position.distanceTo(controls.target); if (d > controls.maxDistance) camera.position.sub(controls.target).setLength(controls.maxDistance).add(controls.target); } } }

  // subjects the camera can follow or sit in
  const trainSubject = (sim, side) => () => { const t = trackAt(sim.train.s); const dir = sim.train.dir || 1; const k = side === undefined ? -1 : side; return { x: t.x, y: TRAIN_Y, z: t.z, fx: t.tx * dir, fz: t.tz * dir, ox: t.nx * k, oz: t.nz * k, v: sim.train.v, shift: side === undefined ? 0 : -CAR_LEN * 0.5 - 3.5 }; };
  const tramSubject = (sim, mode) => () => { const p = tramAt(sim.tram.u); const up = sim.tram.dir >= 0 ? 1 : -1; return mode === 'inside' ? { x: p.x, y: p.y + 1.4, z: p.z, fx: 0, fz: -1, ox: -0.5, oz: -0.866, v: 0, lead: 0, up: 14 } : { x: p.x, y: p.y + 1, z: p.z, fx: 0, fz: -up, ox: 0.9, oz: 0.42 * up, v: Math.abs(sim.tram.v) * 134 }; };

  setLook('film'); fit(); setOrbit(home.pos, home.target, home.fov); setAllBuilt(1); setTram(0); setTrain(0);
  renderer.compile(scene, camera);

  return {
    canvas, renderer, scene, camera, controls, stops, byId, used, state,
    setLook, setTime, setWeather, update, render, resize, resetView, openingCamera, flyTo, showStation, heroPose, hero, lookAtPoint, setShift, follow, inside, onUserMove(f) { onUserMove = f; }, setBuilt, setAllBuilt, setHouses,
    pick: pick2, extra, hover, screenOf, pointOf, trainSubject, tramSubject, levelName,
    showTrain(on) { train.visible = on; }, showTram(on) { tram.visible = on; },
    get mode() { return rig.mode; }, home,
    info() { const i = renderer.info; return { frames, calls: i.render.calls, tris: i.render.triangles, renderer: (() => { try { const gl = renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; } catch (er) { return 'unknown'; } })() }; },
    resetStats() { frames = 0; },
    dispose() { renderer.dispose(); },
  };
}
