/* Kevin Metro · the city
   One unit is one metre. A seaside city: the sea fills the east, a river runs through town into it, and
   the land sides run on as suburbs, forest and hills. Inside the grid: a downtown of towers round Kevin
   Square, a mid-rise ring, low-rise neighbourhoods, Central Park, an industrial port and a beachfront.
   Six metro lines run through it on two decks: the Circle at 9 m, the five category lines at 24.6 m.
   This file lays the city out (ground, water, roads, lots, lines) and decides which model stands where;
   the buildings, props and stations themselves come from the model library (models.js). */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { buildLandmark } from './landmarks.js';
import { WORLD, coastX } from './city-data.js';
import { HUB_R } from './network.js';

export const GAUGE = 1.435;
export const TRACK_OFF = 5; // track centres at ±5 m from the line centre
export const TRAIN_LAT = -TRACK_OFF; // the train uses the inner track, so it always runs clockwise around the city
export const RIVER = WORLD.river;
export const BOUNDS = { x0: -800, x1: 800, z0: -560, z1: 560 };
export const LOOP = { A: 520, B: 330, R: 110, y: 9 }; // half width, half depth, corner radius, rail height
const AVE_X = [-650, -520, -390, -260, -130, 0, 130, 260, 390, 520, 650]; // north–south avenues
const ST_Z = [-440, -330, -220, -110, 0, 100, 330, 440]; // east–west streets (the river runs between 100 and 330)
const isLoopAve = (x) => Math.abs(Math.abs(x) - LOOP.A) < 1;
const isLoopSt = (z) => Math.abs(Math.abs(z) - LOOP.B) < 1;
const aveW = (x) => (isLoopAve(x) ? 32 : 20);
const stW = (z) => (isLoopSt(z) ? 32 : z === 0 ? 40 : 16); // z = 0 carries Line 1 down its middle
const BRIDGE_AVES = [-390, -130, 130, 390];
const RAIL_HALF = 8; // the planted median of the z = 0 boulevard, where Line 1's piers stand

/* ---------- tiny helpers ---------- */
const rngFactory = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const vcol = (g, hex) => { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); return g; };

/* ---------- static batching: merge every static mesh per material ---------- */
export const TILE = 800;
export const tileOf = (x, z) => `${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;
export class Batch {
  constructor(vc) { this.buckets = new Map(); this.vc = vc; }
  add(geo, mat, matrix, opts) {
    opts = opts || {};
    const cast = opts.cast !== false; const recv = opts.receive !== false;
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    const keepColor = mat === this.vc && g.attributes.color;
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name) && !(keepColor && name === 'color')) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (matrix) g.applyMatrix4(matrix);
    let useMat = mat;
    if (mat.userData.matte && this.vc) {
      // matte surfaces share one material; their colour rides on the vertices
      const n = g.attributes.position.count; const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = mat.color.r; c[i * 3 + 1] = mat.color.g; c[i * 3 + 2] = mat.color.b; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
      useMat = this.vc;
    }
    g.computeBoundingBox(); const ctr = g.boundingBox.getCenter(new THREE.Vector3());
    const key = `${useMat.uuid}|${cast}|${recv}|${tileOf(ctr.x, ctr.z)}`;
    let bk = this.buckets.get(key);
    if (!bk) { bk = { mat: useMat, cast, recv, geos: [] }; this.buckets.set(key, bk); }
    bk.geos.push(g);
  }
  box(w, h, d, mat, x, y, z, ry = 0, opts) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    this.add(new THREE.BoxGeometry(w, h, d), mat, m, opts);
  }
  build(parent) {
    for (const b of this.buckets.values()) {
      const merged = mergeGeometries(b.geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.castShadow = b.cast; mesh.receiveShadow = b.recv;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.buckets.clear();
  }
}

/* ---------- materials ---------- */
export function makeMaterials(lineHex) {
  const std = (color, rough = 0.85, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, side: THREE.DoubleSide, ...extra });
  const matteNames = ['asphalt', 'sidewalk', 'concrete', 'concreteDark', 'grass', 'grassDark', 'verge', 'ballast', 'white', 'ink', 'line', 'yellow', 'brick', 'wood', 'crane', 'steel', 'railSteel', 'sand', 'red'];
  const M = {
    asphalt: std(0x5a5c60, 0.95),
    asphaltWet: std(0x4a4d53, 0.16, 0.1),
    sidewalk: std(0xd9d3c7, 0.92),
    concrete: std(0xc9c6bf, 0.9),
    concreteDark: std(0x9d9a94, 0.9),
    grass: std(0x93ad74, 1),
    grassDark: std(0x7e9a63, 1),
    verge: std(0xa8b48f, 1),
    ballast: std(0x8d877d, 1),
    steel: std(0x8f949b, 0.5),
    railSteel: std(0xc3c7cc, 0.45),
    water: std(0x5d8c99, 0.12, 0.15, { envMapIntensity: 1.2 }),
    white: std(0xf4f3ef, 0.6),
    ink: std(0x1f2126, 0.7),
    glass: std(0x26323e, 0.06, 0.4, { transparent: true, opacity: 0.55, envMapIntensity: 1.4 }),
    glassClear: std(0xbfd6e2, 0.05, 0.1, { transparent: true, opacity: 0.28, depthWrite: false, envMapIntensity: 1.2 }),
    line: std(lineHex, 0.5),
    yellow: std(0xf2b705, 0.6),
    brick: std(0x9b5b47, 0.95),
    wood: std(0x8a6a4b, 0.9),
    crane: std(0xe0a22a, 0.6),
    sand: std(0xe8dab6, 1),
    red: std(0xda291c, 0.6),
    container: std(0xffffff, 0.75, 0.2),
  };
  matteNames.forEach((n) => { M[n].userData.matte = true; });
  M.vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  return M;
}

/* ---------- sweeping a cross-section along the line ---------- */
// profile: [[lat, dy, absY?], ...] — dy is relative to rail level unless absY is a number (then absolute y)
export function sweep(line, s0, s1, profile, opts = {}) {
  const out = [];
  // split at the joins between straights and curves; a straight piece needs only one segment
  const cuts = [s0, s1];
  const ks = line.closed ? [-1, 0, 1, 2] : [0];
  ks.forEach((k) => line.breaks.forEach((b) => { const v = b.s0 + k * line.L; if (v > s0 + 0.01 && v < s1 - 0.01) cuts.push(v); }));
  cuts.sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i]; const b = cuts[i + 1]; const mid = line.wrap((a + b) / 2);
    const straight = line.breaks.some((q) => q.straight && mid >= q.s0 && mid < q.s1);
    if (straight && !opts.dense) { const CH = 420; for (let c = a; c < b - 0.01; c += CH) out.push(...sweepOne(line, c, Math.min(b, c + CH), profile, { ...opts, n: 1 })); }
    else out.push(...sweepOne(line, a, b, profile, opts));
  }
  return out;
}
function sweepOne(line, s0, s1, profile, opts) {
  const n = opts.n || Math.max(1, Math.ceil((s1 - s0) / (opts.step || 2)));
  const strips = [];
  for (let j = 0; j < profile.length - 1 + (opts.closed ? 1 : 0); j++) {
    const a = profile[j]; const b = profile[(j + 1) % profile.length];
    const pos = []; const idx = []; const uv = [];
    for (let i = 0; i <= n; i++) {
      const s = s0 + ((s1 - s0) * i) / n;
      const fr = line.at(s);
      [a, b].forEach((q, k) => {
        const y = q[2] !== undefined && q[2] !== null ? q[2] : fr.p.y + q[1];
        const p = fr.p.clone().add(fr.n.clone().multiplyScalar(q[0]));
        pos.push(p.x, y, p.z); uv.push(k, s / (opts.vScale || 1));
      });
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    strips.push(g);
  }
  return strips;
}
const addStrips = (batch, strips, mat, opts) => strips.forEach((g) => batch.add(g, mat, null, opts));

/* ---------- the city ---------- */
export function buildCity({ scene, M, net, isPhone, landmarks, atlas, photos, lib }) {
  const lineDist = (x, z, except) => net.dist(x, z, except);
  const rng = rngFactory(20241120);
  const batch = new Batch(M.vc);
  const anim = [];
  const ROAD_Y = 0.02;

  /* roads: avenues and streets. The river cuts avenues without a bridge; Line 1's corridor, Central Park
     and the sea cut the rest. Streets end at the waterfront road. */
  const PARK = { x0: -120, x1: 120, z0: -314, z1: -152 }; // Kevin's tower stands between the park and the hub
  const roadRects = []; // {x0,x1,z0,z1,dir,loop,c}
  const pushRoad = (x0, x1, z0, z1, dir, loop, c) => { if (x1 - x0 > 1 && z1 - z0 > 1) roadRects.push({ x0, x1, z0, z1, dir, loop, c }); };
  const subtract = (span, cuts) => { let parts = [span]; cuts.forEach(([c0, c1]) => { parts = parts.flatMap(([a, b]) => (c1 <= a || c0 >= b ? [[a, b]] : [[a, c0], [c1, b]].filter(([p, q]) => q - p > 1))); }); return parts; };
  AVE_X.forEach((x) => {
    const w = aveW(x) / 2; const cuts = [];
    if (!BRIDGE_AVES.includes(x)) cuts.push([RIVER.z0 - 4, RIVER.z1 + 4]);
    if (x === 0) cuts.push([PARK.z0, PARK.z1]);
    landmarks.forEach((lm) => { if (lm.rect && x > lm.rect[0] && x < lm.rect[1]) cuts.push([lm.rect[2], lm.rect[3]]); });
    if (x === 650) cuts.push([RAIL_HALF - 1, RIVER.z0 + 1]); // Line 1's viaduct takes this stretch down to the harbour
    subtract([BOUNDS.z0, BOUNDS.z1], cuts).forEach(([p, q]) => pushRoad(x - w, x + w, p, q, 'z', isLoopAve(x), x));
  });
  ST_Z.forEach((z) => {
    const w = stW(z) / 2; const xe = coastX(z) - 34;
    if (z === 0) { pushRoad(BOUNDS.x0, xe, -w, -RAIL_HALF, 'x', false, -(w + RAIL_HALF) / 2); pushRoad(BOUNDS.x0, xe, RAIL_HALF, w, 'x', false, (w + RAIL_HALF) / 2); return; } // two carriageways and a median
    const cuts = z === -220 ? [[PARK.x0, PARK.x1]] : []; landmarks.forEach((lm) => { if (lm.rect && z > lm.rect[2] && z < lm.rect[3]) cuts.push([lm.rect[0], lm.rect[1]]); }); // a plot that spans two blocks closes the street between them
    subtract([BOUNDS.x0, xe], cuts).forEach(([p, q]) => pushRoad(p, q, z - w, z + w, 'x', isLoopSt(z), z));
  });
  const onRoad = (x, z, pad = 0, skipLoop = false) => roadRects.some((r) => !(skipLoop && r.loop) && x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad);
  // a pier may stand off the roads, or down the middle of a road the line runs along; never under another line
  const pierOK = (x, z, tx, tz, self) => {
    if (Math.abs(x) > BOUNDS.x1 - 4 || Math.abs(z) > BOUNDS.z1 - 4) return false;
    if (lineDist(x, z, self) < 11) return false;
    if (self !== '1' && Math.abs(z) < RAIL_HALF + 1 && x > -770 && x < 655) return false;
    if (self !== '1' && x > 640 && x < 660 && z > 0 && z < RIVER.z0) return false;
    const along = Math.abs(tz) > Math.abs(tx) ? 'z' : 'x';
    return !roadRects.some((r) => x > r.x0 - 1.5 && x < r.x1 + 1.5 && z > r.z0 - 1.5 && z < r.z1 + 1.5 && !(r.dir === along && Math.abs((r.dir === 'z' ? x : z) - r.c) < 2.2));
  };
  roadRects.forEach((r) => batch.box(r.x1 - r.x0, 0.04, r.z1 - r.z0, M.asphalt, (r.x0 + r.x1) / 2, ROAD_Y + (r.dir === 'x' ? 0.003 : 0), (r.z0 + r.z1) / 2, 0, { cast: false }));
  // Line 1's corridor: a planted strip, with asphalt level crossings where avenues cross it
  batch.box(coastX(0) - 34 - BOUNDS.x0, 0.06, RAIL_HALF * 2, M.grassDark, (BOUNDS.x0 + coastX(0) - 34) / 2, 0.03, 0, 0, { cast: false });
  AVE_X.forEach((x) => { if (x > -770 && x < 655) batch.box(aveW(x), 0.05, RAIL_HALF * 2, M.asphalt, x, 0.06, 0, 0, { cast: false }); });
  // boulevard medians under the Circle: a kerbed strip between intersections
  roadRects.filter((r) => r.loop).forEach((r) => {
    const along = r.dir; const lo = along === 'z' ? r.z0 : r.x0; const hi = along === 'z' ? r.z1 : r.x1;
    const cross = (along === 'z' ? ST_Z.map((z) => [z, stW(z) / 2]) : AVE_X.map((x) => [x, aveW(x) / 2]));
    let a = lo;
    const stops = cross.filter(([v]) => v > lo && v < hi).sort((p, q) => p[0] - q[0]).concat([[hi + 1000, 0]]);
    stops.forEach(([v, hw]) => {
      const b = Math.min(hi, v - hw - 3);
      if (b - a > 6) { const mid = (a + b) / 2; const len = b - a; if (along === 'z') batch.box(3.2, 0.22, len, M.concrete, r.c, 0.11, mid, 0, { cast: false }); else batch.box(len, 0.22, 3.2, M.concrete, mid, 0.11, r.c, 0, { cast: false }); }
      a = v + hw + 3;
    });
  });
  // diagonal boulevards under Lines 2, 4 and 5: paved, tree-lined, cutting across the grid from Kevin Square
  net.lines.filter((l) => ['2', '4', '5'].includes(l.id)).forEach((l) => {
    const end = l.breaks[0].s1; // the first straight is the diagonal
    addStrips(batch, sweep(l, 2, end, [[-10, 0, 0.2], [10, 0, 0.2]], { step: 6 }), M.sidewalk, { cast: false });
    [-1, 1].forEach((sg) => addStrips(batch, sweep(l, 2, end, [[sg * 3.4, 0, 0.215], [sg * 9.2, 0, 0.215]], { step: 6 }), M.asphalt, { cast: false }));
  });

  /* land, sea and river. The land ends at the coast in the east; the river runs east into the sea.
     One big water plane lies under everything; a cheap ripple keeps it moving. */
  const G = 7000; const cpts = WORLD.coast;
  const landPart = (zA, zB) => {
    const sh = new THREE.Shape(); // Shape is in x/y; y becomes -z after rotating
    const pts = [[-G, zA], [coastX(zA), zA], ...cpts.filter(([z]) => z > zA && z < zB).map(([z, x]) => [x, z]), [coastX(zB), zB], [-G, zB]];
    pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z))); sh.closePath();
    const g = new THREE.ShapeGeometry(sh, 1); g.rotateX(-Math.PI / 2); return g;
  };
  const ground = new THREE.Mesh(mergeGeometries([landPart(-G, RIVER.z0), landPart(RIVER.z1, G)], false), M.verge); ground.receiveShadow = true; scene.add(ground);
  const waterMat = M.water;
  waterMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uni.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
float wv = sin(vWP.x * 0.045 + uTime * 0.7) * sin(vWP.z * 0.06 - uTime * 0.5) + 0.5 * sin((vWP.x + vWP.z) * 0.13 + uTime * 1.1);
diffuseColor.rgb *= 0.98 + 0.025 * wv;
`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + 0.05 * wv, 0.06, 0.4);');
  };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2 * G, 2 * G), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(0, RIVER.water, 0); water.receiveShadow = true; scene.add(water);
  // river embankments, the sea wall, road bridges
  { const x1 = coastX(RIVER.z0); const len = x1 + 2600;
    batch.box(len, 4.2, 1.2, M.concrete, x1 - len / 2, -1.9, RIVER.z0 + 0.6, 0, { cast: false });
    batch.box(coastX(RIVER.z1) + 2600, 4.2, 1.2, M.concrete, coastX(RIVER.z1) - (coastX(RIVER.z1) + 2600) / 2, -1.9, RIVER.z1 - 0.6, 0, { cast: false }); }
  BRIDGE_AVES.forEach((x) => {
    const len = RIVER.z1 - RIVER.z0 + 4; const w = aveW(x);
    batch.box(w + 3, 1.4, len, M.concrete, x, -0.68, (RIVER.z0 + RIVER.z1) / 2);
    batch.box(0.4, 1.1, len, M.concrete, x - w / 2 - 1.3, 0.55, (RIVER.z0 + RIVER.z1) / 2);
    batch.box(0.4, 1.1, len, M.concrete, x + w / 2 + 1.3, 0.55, (RIVER.z0 + RIVER.z1) / 2);
    [RIVER.z0 + 18, RIVER.z1 - 18].forEach((z) => batch.box(w - 4, 3, 3, M.concreteDark, x, -2.6, z));
  });

  /* the waterfront: a paved quay, a coast road and a promenade that follow the shore, a sea wall, piers and a beach */
  const ribbon = (z0, z1, fx0, fx1, y0, y1, mat, opts) => {
    const pos = []; const idx = []; const n = Math.ceil((z1 - z0) / 20);
    for (let i = 0; i <= n; i++) { const z = z0 + ((z1 - z0) * i) / n; pos.push(fx0(z), y0, z, fx1(z), y1, z); if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); batch.add(g, mat, null, opts);
  };
  const WF0 = BOUNDS.z0 - 300; const WF1 = BOUNDS.z1 + 300;
  ribbon(WF0, WF1, () => 655, (z) => coastX(z), 0.1, 0.1, M.sidewalk, { cast: false });
  ribbon(WF0, WF1, (z) => coastX(z) - 33, (z) => coastX(z) - 19, 0.19, 0.19, M.asphalt, { cast: false });
  ribbon(WF0, WF1, (z) => coastX(z), (z) => coastX(z), 0.3, -3.2, M.concrete, { cast: false });
  ribbon(WF0, WF1, (z) => coastX(z) - 0.8, (z) => coastX(z) - 0.8, 0.1, 1.2, M.steel, { cast: false });
  batch.box(40, 1.6, RIVER.z1 - RIVER.z0 + 6, M.concrete, coastX(200) - 18, -0.72, 200); // the coast road bridges the river mouth
  [RIVER.z0 + 16, RIVER.z1 - 16].forEach((z) => batch.box(34, 3, 3, M.concreteDark, coastX(200) - 18, -2.6, z));
  // the beach, south of the river mouth: sand sloping into the water, parasols, a pair of timber piers
  ribbon(300, WF1, (z) => coastX(z), (z) => coastX(z) + 34, 0.12, -2.7, M.sand, { cast: false });
  for (let z = 310; z < 560; z += 17) { const x = coastX(z) + 7 + ((z * 7) % 9); const y = 0.1 - ((x - coastX(z)) / 34) * 2.8; const cone = new THREE.ConeGeometry(2.3, 1.1, 8); batch.add(cone, [M.red, M.white, M.yellow, M.line][(z / 17 | 0) % 4], new THREE.Matrix4().makeTranslation(x, y + 2.5, z)); batch.box(0.12, 2.4, 0.12, M.ink, x, y + 1.2, z, 0, { cast: false }); }
  [[-470, 30, 70, M.concrete], [-340, 30, 70, M.concrete], [-150, 26, 60, M.concrete]].forEach(([z, w, len, mat]) => {
    const x = coastX(z); batch.box(len, 0.5, w, mat, x + len / 2 - 2, 0.05, z);
    for (let k = 8; k < len; k += 14) [-1, 1].forEach((sg) => batch.box(0.7, 3.4, 0.7, M.concreteDark, x + k, -1.6, z + sg * (w / 2 - 0.6), 0, { cast: false }));
  });

  /* blocks: between roads, out to the edge of the city grid and east to the waterfront. Each has a district. */
  const xEdges = [[BOUNDS.x0, 0], ...AVE_X.map((x) => [x, aveW(x) / 2]), [BOUNDS.x1 + 200, 0]];
  const zEdges = [[BOUNDS.z0, 0], ...ST_Z.map((z) => [z, stW(z) / 2]), [BOUNDS.z1, 0]];
  const zoneOf = (cx, cz) => {
    if (cx > 650) return cz < RIVER.z0 ? 'port' : 'bund';
    if (cx < -650 || Math.abs(cz) > 440) return 'suburb';
    if (Math.abs(cx) < LOOP.A && Math.abs(cz) < LOOP.B) return cx > -390 && cx < 390 && cz > -222 && cz < 166 ? 'core' : 'mid';
    return 'low';
  };
  const blocks = [];
  for (let i = 0; i < xEdges.length - 1; i++) for (let j = 0; j < zEdges.length - 1; j++) {
    const x0 = xEdges[i][0] + xEdges[i][1]; let x1 = xEdges[i + 1][0] - xEdges[i + 1][1];
    const z0 = zEdges[j][0] + zEdges[j][1]; const z1 = zEdges[j + 1][0] - zEdges[j + 1][1];
    const parts = [];
    if (z0 < RIVER.z0 && z1 > RIVER.z1) { parts.push([z0, RIVER.z0 - 6], [RIVER.z1 + 6, z1]); } else parts.push([z0, z1]);
    parts.forEach(([a, b]) => {
      if (b - a < 12) return;
      let bx1 = x1; if (x0 > 650) bx1 = Math.min(coastX(a), coastX(b)) - 44; // the last column stops at the waterfront road
      const cx = (x0 + bx1) / 2; const cz = (a + b) / 2;
      if (cx > PARK.x0 && cx < PARK.x1 && cz > PARK.z0 && cz < PARK.z1) return; // Central Park is one piece, below
      blocks.push({ x0, x1: bx1, z0: a, z1: b, cx, cz, zone: zoneOf(cx, cz), river: a === RIVER.z1 + 6 || b === RIVER.z0 - 6 });
    });
  }
  const blockAt = (x, z) => blocks.find((b) => x >= b.x0 - 1 && x <= b.x1 + 1 && z >= b.z0 - 1 && z <= b.z1 + 1);
  const reserved = new Map();
  const bigPlots = [];
  landmarks.forEach((lm) => {
    if (lm.rect) { // a plot larger than one block (Kevin Square): every block inside it, and the street between them
      const [x0, x1, z0, z1] = lm.rect; blocks.forEach((b) => { if (b.cx > x0 && b.cx < x1 && b.cz > z0 && b.cz < z1) reserved.set(b, lm); });
      lm.block = { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 }; bigPlots.push({ x0: x0 - 4, x1: x1 + 4, z0: z0 - 4, z1: z1 + 4 }); batch.box(x1 - x0, 0.16, z1 - z0, M.sidewalk, lm.block.cx, 0.08, lm.block.cz, 0, { cast: false }); return;
    }
    const b = blockAt(lm.x, lm.z); if (b) { reserved.set(b, lm); lm.block = b; }
  });
  // the footprint of every station module: the lots under it become the station's square
  const stationBoxes = [];
  net.lines.forEach((line) => line.stations.forEach((ps) => { const a = line.at(ps.s); const hl = 56; const hw = 24; const ex = Math.abs(a.t.x) * hl + Math.abs(a.t.z) * hw; const ez = Math.abs(a.t.z) * hl + Math.abs(a.t.x) * hw; stationBoxes.push({ x0: a.p.x - ex, x1: a.p.x + ex, z0: a.p.z - ez, z1: a.p.z + ez }); }));
  net.stations.filter((st) => st.hub).forEach((st) => stationBoxes.push({ x0: st.pos[0] - HUB_R - 22, x1: st.pos[0] + HUB_R + 22, z0: st.pos[1] - HUB_R - 22, z1: st.pos[1] + HUB_R + 22 }));
  bigPlots.forEach((q) => stationBoxes.push(q));
  const onStation = (r) => stationBoxes.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.z0 < q.z1 && r.z1 > q.z0);
  // how close a rectangle comes to a line (sampled corners, edges and centre)
  const nearLine = (r, pad) => {
    for (let a = 0; a <= 4; a++) for (let c = 0; c <= 4; c++) if (lineDist(r.x0 + ((r.x1 - r.x0) * a) / 4, r.z0 + ((r.z1 - r.z0) * c) / 4) < pad) return true;
    return false;
  };

  const lotRects = [];
  const LOT = { core: 44, mid: 40, low: 30, bund: 34, port: 52, suburb: 18 };
  blocks.forEach((b) => {
    batch.box(b.x1 - b.x0, 0.16, b.z1 - b.z0, b.zone === 'suburb' ? M.verge : M.sidewalk, b.cx, 0.08, b.cz, 0, { cast: false });
    if (reserved.has(b)) return;
    // a few small parks: in the low-rise ring, by the river, and out in the suburbs
    const park = (b.zone === 'low' && rng() < 0.14) || (b.zone === 'suburb' && rng() < 0.28) || (b.zone === 'mid' && b.river && rng() < 0.45);
    if (park) { b.park = true; return; }
    const inset = b.zone === 'suburb' ? 8 : 5;
    const X0 = b.x0 + inset; const X1 = b.x1 - inset; const Z0 = b.z0 + inset; const Z1 = b.z1 - inset;
    const longX = X1 - X0 > Z1 - Z0;
    const Lg = longX ? X1 - X0 : Z1 - Z0; const Sh = longX ? Z1 - Z0 : X1 - X0;
    const target = LOT[b.zone];
    const nLong = Math.max(1, Math.round(Lg / (target + rng() * 10))); const nShort = Sh > (b.zone === 'suburb' ? 34 : b.zone === 'port' ? 200 : 54) ? 2 : 1;
    for (let a = 0; a < nLong; a++) for (let c = 0; c < nShort; c++) {
      const la = Lg / nLong; const lc = Sh / nShort;
      const r = longX ? { x0: X0 + a * la, x1: X0 + (a + 1) * la, z0: Z0 + c * lc, z1: Z0 + (c + 1) * lc } : { x0: X0 + c * lc, x1: X0 + (c + 1) * lc, z0: Z0 + a * la, z1: Z0 + (a + 1) * la };
      if (nearLine(r, 15) || onStation(r)) r.garden = true;
      lotRects.push({ ...r, block: b });
    }
  });

  /* generic buildings: one instanced box mesh per tile with a window shader. Each carries a class
     (tower, midrise, lowrise, house, shop, industrial, civic) so a model kit can take its place. */
  const trees = [];
  // everything that comes from models/kit.glb. `lod` 1 marks small things that are left out of the widest views
  const kitItems = []; // { name, x, y, z, yaw, s, sy, cast, lod }
  const kit = (name, x, z, yaw = 0, s = 1, sy = s, cast, y = 0.16, lod = 0) => kitItems.push({ name, x, y, z, yaw, s, sy, cast, lod });
  const KIT = {}; lib.kitDefs.forEach((k) => { (KIT[k.class] = KIT[k.class] || []).push(k); });
  // the kit model of these classes that fills a w × d lot best, no taller than hMax and as near hWant as it can be
  const used = {};
  const fitKit = (classes, w, d, hMax, hWant, skip) => {
    let best = null;
    classes.forEach((cls) => (KIT[cls] || []).forEach((k) => [0, 1].forEach((turn) => {
      if (k.name === skip) return;
      const kw = turn ? k.d : k.w; const kd = turn ? k.w : k.d; const sc = Math.min((w + 2) / kw, (d + 2) / kd, 1.18);
      if (sc < 0.72 || k.h * sc * 0.82 > hMax) return;
      const fill = Math.min(1, (kw * kd * sc * sc) / (w * d)); const off = hWant ? Math.abs(Math.log((k.h * sc) / hWant)) : 0;
      // a little of everything: a model already used a lot loses to its neighbours (temples and schools stay rare)
      const score = (1 - fill) * 0.8 + off * 1.6 + rng() * 0.45 + (used[k.name] || 0) * (k.class === 'civic' ? 0.5 : k.class === 'tower' ? 0.05 : 0.004);
      if (!best || score < best.score) best = { score, k, turn, s: sc, kw: kw * sc, kd: kd * sc };
    })));
    if (best) used[best.k.name] = (used[best.k.name] || 0) + 1;
    return best;
  };
  // how tall a building here may be before it hides a line from where the camera usually stands (the south-east)
  const sightLimit = (x, z) => { for (let t = 16; t <= 190; t += 10) if (lineDist(x - 0.64 * t, z - 0.77 * t) < 12) return t <= 70 ? 10 + t * 0.6 : 34 + t * 0.95; return Infinity; };
  const lmDist = (x, z) => landmarks.reduce((m, l) => Math.min(m, Math.hypot(x - l.x, z - l.z)), Infinity);
  let lotNo = 0;
  lotRects.forEach((r) => {
    const w = r.x1 - r.x0 - 3; const d = r.z1 - r.z0 - 3;
    if (w < 8 || d < 8) return;
    const cx = (r.x0 + r.x1) / 2; const cz = (r.z0 + r.z1) / 2; const b = r.block; const zone = b.zone;
    if (r.garden) { batch.box(w, 0.1, d, M.grass, cx, 0.21, cz, 0, { cast: false }); for (let k = 0; k < 2; k++) trees.push([cx + (rng() - 0.5) * w * 0.7, cz + (rng() - 0.5) * d * 0.7, 0.95 + rng() * 0.5]); return; }
    const ld = lineDist(cx, cz); const sight = sightLimit(cx, cz); const beside = ld < 30;
    let classes; let hMax = Infinity; let hWant = 0; let skip = null;
    if (zone === 'suburb' && isPhone && (lotNo++ % 2)) { trees.push([cx, cz, 1]); return; } // phones: every other house is a garden
    if (zone === 'suburb') classes = ['house'];
    else if (zone === 'port') { classes = ['industrial']; skip = 'ind_gantry'; }
    else if (zone === 'core') {
      // downtown: the nearer Kevin's tower, the taller; lower where a tower would stand between the camera and a line
      const k = Math.max(0, 1 - Math.hypot(cx - 40, cz - 20) / 470); hWant = 125 + rng() * 70 + k * k * (130 + rng() * 70);
      hMax = Math.min(sight, beside ? 28 : Infinity);
      if (hMax <= 110) { classes = hMax > 40 ? ['midrise'] : ['midrise', 'shop', 'lowrise']; hWant = Math.min(hMax, 30 + rng() * 45); } else classes = ['tower'];
    } else if (zone === 'mid') {
      hMax = Math.min(sight, beside ? 24 : 230); const tall = hMax > 118 && rng() < 0.62;
      classes = tall ? ['tower'] : hMax > 30 ? ['midrise'] : ['midrise', 'shop', 'lowrise']; hWant = tall ? 115 + rng() * 85 : Math.min(hMax, 30 + rng() * 42);
    } else if (zone === 'bund') { classes = ['midrise', 'civic']; hMax = Math.min(sight, 60); hWant = 30 + rng() * 22; }
    else { classes = rng() < 0.22 ? ['midrise'] : ['lowrise', 'shop', 'house', 'civic']; hMax = Math.min(sight, beside ? 16 : 46); }
    // low around the project buildings outside downtown, so they read as the landmarks
    if (zone !== 'core' && zone !== 'port' && lmDist(cx, cz) < 120) { hMax = Math.min(hMax, 17); if (zone !== 'suburb') classes = ['lowrise', 'shop', 'house']; }
    const got = fitKit(classes, w, d, hMax, hWant, skip) || fitKit(['shop', 'lowrise', 'house'], w, d, Math.max(hMax, 12), 0);
    if (!got) { trees.push([cx, cz, 1]); return; }
    const { k, turn, s } = got; let sy = s;
    if (hWant) sy = s * Math.min(1.22, Math.max(0.85, hWant / (k.h * s)));
    if (k.h * sy > hMax) sy = Math.max(0.8 * s, hMax / k.h);
    // front to the nearer street
    const yaw = turn ? (b.x1 - cx < cx - b.x0 ? Math.PI / 2 : -Math.PI / 2) : (b.z1 - cz < cz - b.z0 ? 0 : Math.PI);
    // small buildings share a big lot: a short row instead of one house in a field
    const row = isPhone ? 2 : 3; const nx = k.h < 20 ? Math.min(row, Math.max(1, Math.floor((w + 2) / (got.kw + 3)))) : 1; const nz = k.h < 20 ? Math.min(isPhone ? 1 : 3, Math.max(1, Math.floor((d + 2) / (got.kd + 3)))) : 1;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) kit(k.name, cx + (i - (nx - 1) / 2) * (w / nx), cz + (j - (nz - 1) / 2) * (d / nz), yaw, s, sy, undefined, 0.16, i + j ? 1 : 0); // in the widest views a row is drawn as its first building
    if (zone === 'suburb' && rng() < 0.55) trees.push([cx + (rng() < 0.5 ? -1 : 1) * (w / 2 - 1), cz + (rng() - 0.5) * d * 0.6, 0.9 + rng() * 0.4]);
  });

  /* Central Park: one long lawn north of downtown, a lake, crossing paths, a ring of trees */
  {
    const W = PARK.x1 - PARK.x0; const D = PARK.z1 - PARK.z0; const cx = 0; const cz = (PARK.z0 + PARK.z1) / 2;
    batch.box(W, 0.16, D, M.sidewalk, cx, 0.08, cz, 0, { cast: false });
    batch.box(W - 8, 0.12, D - 8, M.grass, cx, 0.22, cz, 0, { cast: false });
    batch.box(W - 8, 0.13, 4, M.sidewalk, cx, 0.24, cz + 30, 0, { cast: false }); batch.box(4, 0.13, D - 8, M.sidewalk, cx - 50, 0.24, cz, 0, { cast: false });
    batch.box(4, 0.13, Math.hypot(W, D) * 0.7, M.sidewalk, cx + 30, 0.24, cz - 20, 0.7, { cast: false });
    const lake = new THREE.Shape(); lake.absellipse(0, 0, 46, 28, 0, Math.PI * 2);
    const lg = new THREE.ShapeGeometry(lake, 20); lg.rotateX(-Math.PI / 2); batch.add(lg, M.water, new THREE.Matrix4().makeTranslation(cx + 36, 0.3, cz - 42), { cast: false });
    const n = isPhone ? 110 : 190;
    for (let k = 0; k < n; k++) {
      const x = PARK.x0 + 8 + rng() * (W - 16); const z = PARK.z0 + 8 + rng() * (D - 16);
      if (Math.abs(z - cz - 30) < 5 || Math.abs(x - cx + 50) < 5) continue;
      if (((x - cx - 36) / 50) ** 2 + ((z - cz + 42) / 32) ** 2 < 1) continue;
      if (lineDist(x, z) < 11) continue;
      if (Math.abs(x - cx) < 60 && Math.abs(z - cz - 62) < 22) continue; // the great lawn stays open
      trees.push([x, z, 0.95 + rng() * 0.7]);
    }
  }

  // parks: lawns, paths, a pond, trees
  blocks.filter((b) => b.park).forEach((b) => {
    const W = b.x1 - b.x0; const D = b.z1 - b.z0;
    batch.box(W - 6, 0.12, D - 6, M.grass, b.cx, 0.22, b.cz, 0, { cast: false });
    batch.box(W - 6, 0.13, 3.2, M.sidewalk, b.cx, 0.24, b.cz, 0, { cast: false });
    const pond = W > 60 && D > 50 && rng() < 0.6;
    if (pond) batch.add(new THREE.CircleGeometry(Math.min(W, D) * 0.16, 20), M.water, new THREE.Matrix4().compose(new THREE.Vector3(b.cx + W * 0.2, 0.3, b.cz - D * 0.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), new THREE.Vector3(1, 1, 1)), { cast: false });
    const n = Math.round((W * D) / (isPhone ? 900 : 620));
    for (let k = 0; k < n; k++) {
      const x = b.x0 + 6 + rng() * (W - 12); const z = b.z0 + 6 + rng() * (D - 12);
      if (Math.abs(z - b.cz) < 4) continue;
      if (pond && Math.hypot(x - b.cx - W * 0.2, z - b.cz + D * 0.2) < Math.min(W, D) * 0.2) continue;
      if (lineDist(x, z) < 11) continue;
      trees.push([x, z, 0.85 + rng() * 0.6]);
    }
  });

  // the project buildings: each stands on its own block, front towards its station
  landmarks.forEach((lm) => { if (!lm.block) return; const defs = [lm.model, lm.annex && lm.annex.model].filter(Boolean).map((n) => lib.landmarks.get(n)).filter(Boolean).map((m) => m.def); if (defs.length) buildLandmark(lm, lm.block, defs); });
  const uni = { uTime: { value: 0 } }; const mtx = new THREE.Matrix4(); const col = new THREE.Color();

  /* street furniture: lane markings, crosswalks, lamps, trees */
  const marks = []; const lamps = [];
  const crossingAt = (r, x, z) => (r.dir === 'z' ? ST_Z.some((sz) => Math.abs(z - sz) < stW(sz) / 2 + 2) : AVE_X.some((ax) => Math.abs(x - ax) < aveW(ax) / 2 + 2));
  roadRects.forEach((r) => {
    const along = r.dir; const len = along === 'z' ? r.z1 - r.z0 : r.x1 - r.x0;
    const offs = r.loop ? [-7.5, 7.5] : [0];
    for (let t = 6; t < len - 6; t += 12) {
      offs.forEach((o) => {
        const x = along === 'z' ? (r.x0 + r.x1) / 2 + o : r.x0 + t; const z = along === 'z' ? r.z0 + t : (r.z0 + r.z1) / 2 + o;
        if (!crossingAt(r, x, z) && Math.abs(x) < BOUNDS.x1 - 10 && Math.abs(z) < BOUNDS.z1 - 10) marks.push([x, z, along === 'z' ? 0.18 : 3, along === 'z' ? 3 : 0.18]);
      });
    }
  });
  AVE_X.forEach((x) => ST_Z.forEach((z) => {
    if (!onRoad(x, z)) return;
    const hw = aveW(x) / 2; const hs = stW(z) / 2;
    [-1, 1].forEach((sg) => {
      if (onRoad(x, z + sg * (hs + 2.5))) for (let k = -hw + 2; k <= hw - 2; k += 2.6) marks.push([x + k, z + sg * (hs + 2.5), 1.2, 3.6]);
      if (onRoad(x + sg * (hw + 2.5), z)) for (let k = -hs + 2; k <= hs - 2; k += 2.6) marks.push([x + sg * (hw + 2.5), z + k, 3.6, 1.2]);
    });
  }));
  // traffic lights on the corners of busy crossings
  {
    const tl = []; AVE_X.forEach((x) => ST_Z.forEach((z) => { if (Math.abs(x) > 530 || Math.abs(z) > 340 || !onRoad(x, z - stW(z) / 2 - 1)) return; const hw = aveW(x) / 2 + 2; const hs = stW(z) / 2 + 2; tl.push([x - hw, z - hs, 0], [x + hw, z + hs, Math.PI]); }));
    const pole = new THREE.CylinderGeometry(0.1, 0.12, 5.2, 4, 1, true); pole.translate(0, 2.6, 0); const arm = new THREE.BoxGeometry(0.16, 0.16, 3.6); arm.translate(0, 5.1, 1.7); const head = new THREE.BoxGeometry(0.4, 1.0, 0.36); head.translate(0, 4.6, 3.3);
    const geo = mergeGeometries([vcol(pole, 0x2a2c30), vcol(arm, 0x2a2c30), vcol(head, 0x1b1c1f)], false);
    tl.forEach(([x, z, r]) => batch.add(geo, M.vc, new THREE.Matrix4().compose(new THREE.Vector3(x, 0.16, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), new THREE.Vector3(1, 1, 1)), { cast: false }));
  }
  const markGeo = new THREE.PlaneGeometry(1, 1); markGeo.rotateX(-Math.PI / 2);
  marks.forEach((c) => batch.add(markGeo, M.white, new THREE.Matrix4().compose(new THREE.Vector3(c[0], 0.05, c[1]), new THREE.Quaternion(), new THREE.Vector3(c[2], 1, c[3])), { cast: false, receive: true }));
  blocks.forEach((b) => {
    if (b.zone === 'suburb') return;
    const edges = [[b.x0 + 1.6, b.z0 + 1.6, b.x1 - 1.6, b.z0 + 1.6], [b.x0 + 1.6, b.z1 - 1.6, b.x1 - 1.6, b.z1 - 1.6], [b.x0 + 1.6, b.z0 + 1.6, b.x0 + 1.6, b.z1 - 1.6], [b.x1 - 1.6, b.z0 + 1.6, b.x1 - 1.6, b.z1 - 1.6]];
    edges.forEach(([ax, az, bx, bz], e) => {
      const len = Math.hypot(bx - ax, bz - az);
      for (let t = 8; t < len - 4; t += 13) {
        const x = ax + ((bx - ax) * t) / len; const z = az + ((bz - az) * t) / len;
        if (lineDist(x, z) < 11) continue;
        if (Math.floor(t / 13) % 4 === 0) lamps.push([x, z, e]);
        else if (rng() < (isPhone ? 0.2 : 0.33)) trees.push([x, z, 0.85 + rng() * 0.5]);
      }
    });
  });
  const lampGeo = (() => { const pole = new THREE.CylinderGeometry(0.09, 0.13, 7, 3, 1, true); pole.translate(0, 3.5, 0); const head = new THREE.BoxGeometry(0.5, 0.18, 1.3); head.translate(0, 7.05, 0.5); return mergeGeometries([vcol(pole, 0x2a2c30), vcol(head, 0xf3e3c0)], false); })();
  lamps.forEach((c) => batch.add(lampGeo, M.vc, new THREE.Matrix4().compose(new THREE.Vector3(c[0], 0.16, c[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), [Math.PI, 0, Math.PI / 2, -Math.PI / 2][c[2]]), new THREE.Vector3(1, 1, 1)), { cast: false }));
  // the promenade: a row of trees and lamps along the shore
  for (let z = BOUNDS.z0 - 280; z < BOUNDS.z1 + 280; z += 21) { if (z > RIVER.z0 - 8 && z < RIVER.z1 + 8) continue; const x = coastX(z) - 9; if ((z / 21 | 0) % 3) trees.push([x, z, 1.05]); else batch.add(lampGeo, M.vc, new THREE.Matrix4().compose(new THREE.Vector3(x - 4, 0.19, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2), new THREE.Vector3(1, 1, 1)), { cast: false }); }
  let treeNo = 0; // phones draw every other tree
  const tree = (c) => (treeNo++ % 2 && isPhone ? 0 : kit((Math.abs(c[0] * 7 + c[1] * 3) | 0) % 5 === 0 ? 'tree_tall' : 'tree_round', c[0], c[1], c[0] * 0.37, c[2] * 0.95, c[2] * 0.95, false, 0.16, treeNo % 6 ? 1 : 0));
  trees.forEach(tree);

  /* beyond the grid, on the three land sides: country roads and houses, then forest and hills fading into haze.
     The sea takes the east. Nothing here is ever the edge of the world: the camera stops well short of where it ends.
     These far pieces are separate meshes, so the engine can hide whichever side the view cannot see. */
  const outer = { all: [], n: [], s: [], w: [] };
  {
    const SAFE = WORLD.safe; const far = [];
    const quad = (x0, x1, z0, z1, y, hex, canopy) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, canopy ? 24 : 1, canopy ? 24 : 1); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); const uv = g.attributes.uv; const ps = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, canopy ? ps.getX(i) / 240 : 0.002, canopy ? ps.getZ(i) / 240 : 0.002); far.push(vcol(g, hex)); };
    // forest floor past the houses, and the country roads that carry the grid outwards
    quad(-G, -1085, -G, G, 0.02, 0x8aa372, true); quad(-1085, 885, -G, -835, 0.02, 0x8aa372, true); quad(-1085, 655, 835, G, 0.02, 0x8aa372, true);
    // each road narrows to a lane past the last house and ends among the trees
    const LANE = 0x9d9a8a;
    AVE_X.forEach((x, i) => {
      const n = 880 + (i % 3) * 22; quad(x - 5, x + 5, -n, BOUNDS.z0, 0.05, 0x6a6c70); quad(x - 2, x + 2, -n - 70 - (i % 2) * 30, -n, 0.05, LANE); [-7, 0, 8].forEach((o, k) => trees.push([x + o, -n - 78 - (i % 2) * 30 - k * 7, 1.7]));
      if (x < 640) { quad(x - 5, x + 5, BOUNDS.z1, n, 0.05, 0x6a6c70); quad(x - 2, x + 2, n, n + 70 + (i % 2) * 30, 0.05, LANE); [-7, 0, 8].forEach((o, k) => trees.push([x + o, n + 78 + (i % 2) * 30 + k * 7, 1.7])); }
    });
    ST_Z.forEach((z, i) => { const n = 1120 + (i % 3) * 24; quad(-n, BOUNDS.x0, z - 4.5, z + 4.5, 0.05, 0x6a6c70); quad(-n - 70 - (i % 2) * 30, -n, z - 2, z + 2, 0.05, LANE); [-7, 0, 8].forEach((o, k) => trees.push([-n - 78 - (i % 2) * 30 - k * 7, z + o, 1.7])); });
    // hills on the horizon
    const hill = (x, z, r, h, hex) => { const g = new THREE.IcosahedronGeometry(1, 1); g.scale(r, h, r * (0.7 + (Math.abs(x * 13 + z * 7) % 10) / 20)); g.translate(x, -h * 0.25, z); const uv = g.attributes.uv; const ps = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / 240, ps.getZ(i) / 240); far.push(vcol(g, hex)); };
    for (let k = 0; k < 9; k++) { hill(-1750 - (k % 3) * 300, -1700 + k * 420, 300 + (k % 4) * 60, 90 + (k % 3) * 40, k % 2 ? 0x7a9566 : 0x6f8a5e); hill(-1700 + k * 310, -1500 - (k % 3) * 300, 300 + (k % 3) * 70, 90 + (k % 4) * 30, k % 2 ? 0x6f8a5e : 0x7a9566); if (k < 8) hill(-1700 + k * 300, 1500 + (k % 3) * 300, 300 + (k % 3) * 70, 80 + (k % 4) * 30, k % 2 ? 0x7a9566 : 0x6f8a5e); }
    // a canopy texture: clumps of darker and lighter green, tiled every 240 m (its corner texel stays white for the roads)
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const cg = cv.getContext('2d'); cg.fillStyle = '#ffffff'; cg.fillRect(0, 0, 256, 256);
    let cs = 5; const cr = () => { cs = (cs * 16807) % 2147483647; return cs / 2147483647; };
    for (let i = 0; i < 520; i++) { const x = 8 + cr() * 244; const y = 8 + cr() * 244; const r = 3 + cr() * 9; cg.fillStyle = cr() < 0.6 ? `rgba(84,116,74,${0.1 + cr() * 0.16})` : `rgba(214,226,170,${0.08 + cr() * 0.12})`; [[0, 0], [256, 0], [0, 256], [-256, 0], [0, -256]].forEach(([ox, oy]) => { if (x + ox < 6 && y + oy < 6) return; cg.beginPath(); cg.arc(x + ox, y + oy, r, 0, Math.PI * 2); cg.fill(); }); }
    const canopy = new THREE.CanvasTexture(cv); canopy.wrapS = canopy.wrapT = THREE.RepeatWrapping; canopy.colorSpace = THREE.SRGBColorSpace; canopy.anisotropy = 4;
    const farMesh = new THREE.Mesh(mergeGeometries(far.map((g) => { for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(n)) g.deleteAttribute(n); return g.index ? g.toNonIndexed() : g; }), false), new THREE.MeshStandardMaterial({ vertexColors: true, map: canopy, roughness: 1, flatShading: true }));
    farMesh.receiveShadow = false; farMesh.frustumCulled = false; scene.add(farMesh); outer.all.push(farMesh);
    // houses along the country roads
    const hs = [];
    AVE_X.forEach((x) => { for (let z = BOUNDS.z0 - 22; z > -850; z -= 27) [-1, 1].forEach((sg) => { if (rng() < 0.2 || x + sg * 18 > coastX(z) - 70) return; hs.push([x + sg * (16 + rng() * 5), z + rng() * 6, sg > 0 ? -Math.PI / 2 : Math.PI / 2]); }); if (x < 640) for (let z = BOUNDS.z1 + 22; z < 850; z += 27) [-1, 1].forEach((sg) => { if (rng() < 0.2 || x + sg * 18 > coastX(z) - 70) return; hs.push([x + sg * (16 + rng() * 5), z + rng() * 6, sg > 0 ? -Math.PI / 2 : Math.PI / 2]); }); });
    ST_Z.forEach((z) => { for (let x = BOUNDS.x0 - 22; x > -1095; x -= 27) [-1, 1].forEach((sg) => { if (rng() < 0.2 || (z + sg * 16 > RIVER.z0 - 12 && z + sg * 16 < RIVER.z1 + 12)) return; hs.push([x + rng() * 6, z + sg * (15 + rng() * 5), sg > 0 ? Math.PI : 0]); }); });
    hs.forEach(([x, z, ry], i) => { if (i % (isPhone ? 4 : 2)) return; kit(i % 3 ? 'low_house_a' : 'low_house_b', x, z, ry, 1, 1, false, 0.05, i % 8 ? 1 : 0); });
    // trees: gardens between the houses, then forest, thinning with distance
    const lists = { n: [], s: [], w: [] }; const want = isPhone ? 320 : 700; let tries = 0;
    while (lists.n.length + lists.s.length + lists.w.length < want && tries++ < want * 30) {
      const x = -1900 + rng() * 2900; const z = -1750 + rng() * 3500;
      const inGrid = x > BOUNDS.x0 - 6 && z > BOUNDS.z0 - 6 && z < BOUNDS.z1 + 6; if (inGrid || x > coastX(z) - 50) continue;
      if (z > RIVER.z0 - 8 && z < RIVER.z1 + 8) continue;
      const dOut = Math.max(BOUNDS.x0 - x, BOUNDS.z0 - z, z - BOUNDS.z1, 0); if (dOut < 280 && rng() < 0.55) continue;
      if (AVE_X.some((ax) => Math.abs(x - ax) < 8) && (z < BOUNDS.z0 || z > BOUNDS.z1)) continue; if (ST_Z.some((sz) => Math.abs(z - sz) < 7) && x < BOUNDS.x0) continue;
      if (dOut > 700 && rng() < 0.5) continue;
      (x < BOUNDS.x0 - 6 ? lists.w : z < 0 ? lists.n : lists.s).push([x, z, (dOut > 280 ? 1.9 : 1) * (0.9 + rng() * 0.8)]);
    }
    Object.values(lists).forEach((list) => list.forEach(tree));
  }

  /* props from the kit: timber piers on the beach, cranes on the port quay, boats on the river and the sea,
     a fountain and a pavilion in Central Park */
  [280, 470].forEach((z) => { for (let k = 0; k < 4; k++) kit('pier_segment', coastX(z) + 8 + k * 20, z, Math.PI / 2, 1, 1, false, RIVER.water + 0.2); });
  [-405, -245].forEach((z) => kit('ind_gantry', coastX(z) - 8, z, Math.PI / 2, 1, 1, true));
  [[-520, 198, 0.2], [-210, 204, 3.3], [70, 196, 0.1], [455, 203, 3.2]].forEach(([x, z, r]) => kit('boat_small', x, z, Math.PI / 2 + r, 1.3, 1.3, false, RIVER.water + 0.1));
  for (let k = 0; k < 9; k++) { const z = -520 + k * 130 + rng() * 60; kit('boat_small', coastX(z) + 60 + rng() * 260, z, rng() * 6.3, 1.4, 1.4, false, RIVER.water + 0.1); }
  [[coastX(-120) + 210, -120, 0.25], [coastX(360) + 330, 360, 2.9]].forEach(([x, z, r]) => kit('ferry', x, z, r, 1, 1, false, RIVER.water + 0.1));
  kit('park_fountain', 0, -171, 0, 1, 1, false, 0.28); kit('park_pavilion', -84, -282, 0.4, 1, 1, false, 0.28);

  /* cars: slow traffic on the right-hand lane of each road; click one and it honks */
  const lanes = roadRects.filter((r) => (r.dir === 'z' ? r.z1 - r.z0 : r.x1 - r.x0) > 120);
  const carCount = isPhone ? 30 : 56;
  const cars = [];
  for (let k = 0; k < carCount; k++) {
    const r = lanes[Math.floor(rng() * lanes.length)];
    const len = r.dir === 'z' ? r.z1 - r.z0 : r.x1 - r.x0;
    cars.push({ r, sign: rng() < 0.5 ? 1 : -1, t: rng() * len, len, v: 6 + rng() * 4, hop: 0, color: [0xf1f1ee, 0x2c3e50, 0xb03a2e, 0x7f8c8d, 0x1f4e79, 0xd4ac0d, 0x222222, 0xe5e7e9][k % 8] });
  }
  const parked = [];
  roadRects.filter((r) => !r.loop && (r.dir === 'z' ? r.z1 - r.z0 : r.x1 - r.x0) > 80 && Math.abs(r.c) < 700).forEach((r) => {
    const len = r.dir === 'z' ? r.z1 - r.z0 : r.x1 - r.x0; const half = (r.dir === 'z' ? r.x1 - r.x0 : r.z1 - r.z0) / 2 - 1.3;
    for (let t = 14; t < len - 14; t += 9 + rng() * 20) {
      if (rng() < (isPhone ? 0.85 : 0.72)) continue;
      const sg = rng() < 0.5 ? -1 : 1; const x = r.dir === 'z' ? (r.x0 + r.x1) / 2 + sg * half : r.x0 + t; const z = r.dir === 'z' ? r.z0 + t : (r.z0 + r.z1) / 2 + sg * half;
      if (onRoad(x, z, 0) && roadRects.some((q) => q !== r && x > q.x0 - 3 && x < q.x1 + 3 && z > q.z0 - 3 && z < q.z1 + 3)) continue;
      parked.push({ x, z, ry: r.dir === 'z' ? 0 : Math.PI / 2, color: [0xe8e6e1, 0x3b4651, 0x8c2f27, 0x9aa0a6, 0x2b4a6b, 0x1f2124][Math.floor(rng() * 6)] });
    }
  });
  // moving cars are one instanced kit model, lightly tinted; parked cars, taxis and the odd bus join the kit's own instances
  const bodyMesh = new THREE.InstancedMesh(lib.kit.get('car').geometry, lib.material, cars.length);
  bodyMesh.castShadow = false;
  cars.forEach((c, i) => bodyMesh.setColorAt(i, col.setHex([0xffffff, 0xcfd6e6, 0xffe2b8, 0xd9d9d9, 0xbfe0d0, 0xe6c8c8][i % 6])));
  parked.forEach((q, k) => kit(k % 23 === 11 ? 'bus' : k % 6 === 2 ? 'taxi' : 'car', q.x, q.z, q.ry + (k % 2 ? Math.PI : 0), 1, 1, false, 0.16, 1));
  scene.add(bodyMesh);
  const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0); const v3 = new THREE.Vector3(); const one = new THREE.Vector3(1, 1, 1);
  const carPos = (c) => {
    const r = c.r; const lane = (r.dir === 'z' ? r.x1 - r.x0 : r.z1 - r.z0) / 4;
    const along = c.sign > 0 ? c.t : c.len - c.t;
    if (r.dir === 'z') { v3.set((r.x0 + r.x1) / 2 - lane * c.sign, ROAD_Y, r.z0 + along); q.setFromAxisAngle(up, c.sign > 0 ? 0 : Math.PI); }
    else { v3.set(r.x0 + along, ROAD_Y, (r.z0 + r.z1) / 2 + lane * c.sign); q.setFromAxisAngle(up, c.sign > 0 ? Math.PI / 2 : -Math.PI / 2); }
    return v3;
  };
  const placeCars = (dt) => {
    cars.forEach((c, i) => {
      c.t += c.v * dt * (c.hop > 0 ? 0.2 : 1); if (c.t > c.len - 4) c.t = 4;
      carPos(c);
      if (c.hop > 0) { c.hop = Math.max(0, c.hop - dt * 2.2); v3.y += Math.sin(c.hop * Math.PI * 3) * 0.35 * c.hop; }
      mtx.compose(v3, q, one); bodyMesh.setMatrixAt(i, mtx);
    });
    bodyMesh.instanceMatrix.needsUpdate = true;
    bodyMesh.computeBoundingSphere();
  };
  placeCars(0);
  anim.push((t, dt) => { uni.uTime.value = t; placeCars(dt); });
  const honk = (i) => { const c = cars[i]; if (!c) return parked[i - cars.length] ? new THREE.Vector3(parked[i - cars.length].x, 0, parked[i - cars.length].z) : null; c.hop = 1; return carPos(c).clone(); };

  /* pedestrians: small walkers on the sidewalk ring of city blocks */
  const walkers = [];
  const pedCount = isPhone ? 60 : 150;
  const busy = blocks.filter((b) => b.zone !== 'suburb' && !b.park && !reserved.has(b));
  for (let k = 0; k < pedCount; k++) {
    const b = busy[Math.floor(rng() * busy.length)];
    const per = 2 * (b.x1 - b.x0 + b.z1 - b.z0 - 6);
    walkers.push({ b, t: rng() * per, per, v: (rng() < 0.5 ? 1 : -1) * (0.9 + rng() * 0.6), color: [0x34495e, 0xc0392b, 0x16a085, 0xf39c12, 0x8e44ad, 0x2c3e50, 0xecf0f1][k % 7] });
  }
  const pedGeo = new THREE.CylinderGeometry(0.2, 0.26, 1.7, 5, 1); pedGeo.translate(0, 0.85, 0);
  const pedMesh = new THREE.InstancedMesh(pedGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), walkers.length);
  walkers.forEach((w, i) => pedMesh.setColorAt(i, col.setHex(w.color)));
  pedMesh.castShadow = false; pedMesh.frustumCulled = false; scene.add(pedMesh);
  const placePeds = (dt) => {
    walkers.forEach((w, i) => {
      w.t = (w.t + w.v * dt + w.per) % w.per;
      const b = w.b; const W = b.x1 - b.x0 - 3; const D = b.z1 - b.z0 - 3; let t = w.t;
      let x; let z;
      if (t < W) { x = b.x0 + 1.5 + t; z = b.z0 + 2.6; } else if ((t -= W) < D) { x = b.x1 - 2.6; z = b.z0 + 1.5 + t; } else if ((t -= D) < W) { x = b.x1 - 1.5 - t; z = b.z1 - 2.6; } else { t -= W; x = b.x0 + 2.6; z = b.z1 - 1.5 - t; }
      mtx.makeTranslation(x, 0.16, z); pedMesh.setMatrixAt(i, mtx);
    });
    pedMesh.instanceMatrix.needsUpdate = true;
  };
  placePeds(0);
  anim.push((t, dt) => placePeds(dt));

  return { outer, PARK, kitItems, batch, anim, roadRects, onRoad, pierOK, blocks, blockAt, uni, carMesh: bodyMesh, honk };
}

/* ---------- the network: viaducts, the street-level line, piers, track, stations ---------- */
export function lineRoundel(def, opts = {}) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = opts.bg || def.css; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
  g.fillStyle = def.css; g.beginPath(); g.arc(128, 128, 98, 0, Math.PI * 2); g.fill();
  g.fillStyle = def.id === '2' ? '#16171a' : '#ffffff'; g.font = '800 120px "Public Sans", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(def.no, 128, 136);
  return c;
}
function nameBoard(def, st) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 200; const g = c.getContext('2d');
  g.fillStyle = '#16171a'; g.fillRect(0, 0, 1024, 200); g.fillStyle = def.css; g.fillRect(0, 168, 1024, 32);
  g.fillStyle = def.css; g.beginPath(); g.arc(96, 90, 64, 0, Math.PI * 2); g.fill();
  g.fillStyle = def.id === '2' ? '#16171a' : '#ffffff'; g.font = '800 72px "Public Sans", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(def.no, 96, 96);
  g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.font = '800 70px "Public Sans", Arial'; g.fillText(st.name, 190, 70);
  g.font = '600 46px "PingFang SC", "Microsoft YaHei", sans-serif'; g.fillStyle = '#c9c8c2'; g.fillText(st.zh, 192, 136);
  return c;
}

export function buildLines({ M, net, pierOK, onRoad, batch, lib, atlas }) {
  const yAx = new THREE.Vector3(0, 1, 0);
  const lineMats = {};
  net.lines.forEach((l) => { const m = new THREE.MeshStandardMaterial({ color: l.def.hex, roughness: 0.5, side: THREE.DoubleSide }); m.userData.matte = true; lineMats[l.id] = m; });
  // a trackbed textured with sleepers every 0.65 m
  const tb = document.createElement('canvas'); tb.width = 64; tb.height = 64; const tg = tb.getContext('2d');
  tg.fillStyle = '#8d877d'; tg.fillRect(0, 0, 64, 64);
  let sd = 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i < 260; i++) { tg.fillStyle = rnd() < 0.5 ? '#7d776e' : '#9c968c'; tg.fillRect(rnd() * 64, rnd() * 64, 2, 2); }
  tg.fillStyle = '#b9b4ab'; tg.fillRect(4, 22, 56, 20); tg.fillStyle = '#a29d94'; tg.fillRect(4, 38, 56, 4);
  const tbTex = new THREE.CanvasTexture(tb); tbTex.wrapS = THREE.ClampToEdgeWrapping; tbTex.wrapT = THREE.RepeatWrapping; tbTex.colorSpace = THREE.SRGBColorSpace; tbTex.anisotropy = 4;
  const trackbedMat = new THREE.MeshStandardMaterial({ map: tbTex, roughness: 1, side: THREE.DoubleSide });
  const pierGeo = new THREE.BoxGeometry(2.2, 1, 2.6); pierGeo.translate(0, 0.5, 0);
  const unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, 0.5, 0);
  const stationParts = []; const stations = [];

  net.lines.forEach((line) => {
    const L = line.L; const LM = lineMats[line.id]; const grade = line.kind === 'grade'; const def = line.def;
    const put = (geo, mat, s, lat, y, scale, opts, extraRot) => {
      const a = line.at(s); const p = a.p.clone().addScaledVector(a.n, lat);
      const q = new THREE.Quaternion().setFromAxisAngle(yAx, Math.atan2(a.t.x, a.t.z)); if (extraRot) q.multiply(extraRot);
      batch.add(geo, mat, new THREE.Matrix4().compose(new THREE.Vector3(p.x, y, p.z), q, scale || new THREE.Vector3(1, 1, 1)), opts);
    };
    if (!grade) {
      // 1) the deck: concrete box with chamfered soffit; parapet tops, outer faces and floor in the line colour
      const VIADUCT = [[-7.0, 1.0], [-6.3, 1.0], [-6.3, -0.75], [6.3, -0.75], [6.3, 1.0], [7.0, 1.0], [7.0, -1.7], [4.6, -2.9], [-4.6, -2.9], [-7.0, -1.7]];
      addStrips(batch, sweep(line, 0, L, VIADUCT, { closed: true, step: 4 }), M.concrete);
      [-1, 1].forEach((sg) => {
        addStrips(batch, sweep(line, 0, L, [[sg * 6.28, 1.02], [sg * 7.02, 1.02]], { step: 4 }), LM, { cast: false });
        addStrips(batch, sweep(line, 0, L, [[sg * 7.03, 1.02], [sg * 7.03, -1.7]], { step: 4 }), LM, { cast: false });
      });
      addStrips(batch, sweep(line, 0, L, [[-6.29, -0.73], [6.29, -0.73]], { step: 4 }), LM, { cast: false });
      // 2) piers: never on a crossing road, never under another line; in the water where a line crosses the river
      for (let s = line.closed ? 0 : 6; s < L - (line.closed ? 0 : 4); s += 30) {
        let ok = null;
        for (const d of [0, 5, -5, 9, -9, 13, -13]) { const a = line.at(s + d); if (pierOK(a.p.x, a.p.z, a.t.x, a.t.z, line.id)) { ok = s + d; break; } }
        if (ok === null) continue;
        const a = line.at(ok); const inRiver = a.p.z > RIVER.z0 - 1 && a.p.z < RIVER.z1 + 1;
        const yb = inRiver ? RIVER.water - 1 : 0; const top = a.p.y - 2.9;
        const w = line.Y > 12 ? 1.25 : 1;
        put(pierGeo, M.concrete, ok, 0, yb, new THREE.Vector3(w, top - yb - 1.1, w));
        put(unit, M.concrete, ok, 0, top - 1.1, new THREE.Vector3(9.2, 1.1, 2.9));
      }
      // open ends: a closing wall on the deck
      if (!line.closed) [0.3, L - 0.3].forEach((s) => put(unit, M.concrete, s, 0, line.Y - 2.9, new THREE.Vector3(14, 3.9, 0.6)));
    }
    // 3) two tracks: sleepers, rails; a third rail with a yellow cover on the viaducts
    [TRACK_OFF, -TRACK_OFF].forEach((c) => {
      addStrips(batch, sweep(line, 0, L, [[c - 1.55, -0.18], [c + 1.55, -0.18]], { step: 3, vScale: 0.65 }), trackbedMat, { cast: false });
      [c - GAUGE / 2, c + GAUGE / 2].forEach((r) => addStrips(batch, sweep(line, 0, L, [[r - 0.04, -0.17], [r - 0.035, 0], [r + 0.035, 0]], { step: 4 }), M.railSteel, { cast: false }));
      if (!grade) { const tr = c + Math.sign(c) * 1.55; addStrips(batch, sweep(line, 0, L, [[tr - 0.18, 0.12], [tr + 0.18, 0.12]], { step: 6 }), M.yellow, { cast: false }); }
    });
    // buffer stops at the ends of open lines
    if (!line.closed) [[2.2, 1], [L - 2.2, -1]].forEach(([s]) => [-TRACK_OFF, TRACK_OFF].forEach((c) => put(unit, M.yellow, s, c, line.Y - 0.2, new THREE.Vector3(2.6, 1.3, 0.9))));

    // 4) stations: a module from the model library at every stop, its canopy in the line colour, raised until
    //    its platforms meet the train floor. Upper-deck modules stand on portal frames clear of the roads.
    line.stations.forEach((ps) => {
      const a = line.at(ps.s); const model = lib.landmarks.get('station_elevated'); if (!model) return;
      const lift = line.Y + 1.1 - model.def.platform;
      stations.push({ id: ps.st.id, name: 'station_elevated', x: a.p.x, y: lift, z: a.p.z, yaw: Math.atan2(-a.t.z, a.t.x), tint: def.hex, board: nameBoard(def, ps.st) });
      if (lift > 1) {
        const post = (s, lat, w, h) => { const q = line.at(s); if (onRoad(q.p.x + q.n.x * lat, q.p.z + q.n.z * lat, 1)) return false; put(unit, M.concrete, s, lat, 0, new THREE.Vector3(w, h, w)); return true; };
        [-40, -27, 27, 40].forEach((d) => { const ok = [-1, 1].map((sg) => post(ps.s + d, sg * 15.5, 1.6, lift - 1.2) || post(ps.s + d, sg * 5.6, 1.4, lift - 1.2)); if (ok.some(Boolean)) put(unit, M.concrete, ps.s + d, 0, lift - 1.3, new THREE.Vector3(34, 1.3, 2)); });
      }
      stationParts.push({ ps, line, totems: [] });
    });
  });

  /* what joins the platforms of one station */
  const up = new THREE.Vector3(0, 1, 0);
  // an escalator from A up to B: treads, glass sides, yellow handrails, a post under its middle
  const escalator = (A, B, w = 2.4) => {
    const len = A.distanceTo(B); const mid = A.clone().add(B).multiplyScalar(0.5); const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(A, B, up)); const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
    batch.add(new THREE.BoxGeometry(w, 0.5, len), M.steel, m);
    [-1, 1].forEach((sg) => { batch.add(new THREE.BoxGeometry(0.22, 1.25, len).translate(sg * w / 2, 0.85, 0), M.white, m, { cast: false }); batch.add(new THREE.BoxGeometry(0.3, 0.2, len).translate(sg * w / 2, 1.55, 0), M.yellow, m, { cast: false }); });
    if (!onRoad(mid.x, mid.z, 1) && mid.y > 4) batch.box(1.1, mid.y - 0.5, 1.1, M.concrete, mid.x, (mid.y - 0.5) / 2, mid.z);
  };
  net.stations.forEach((st) => {
    const k = net.cross(st);
    if (k) {
      // a two-deck interchange: the escalator between the platforms, and a glazed lift core beside both
      escalator(k.foot, k.top, 3);
      const a = k.lo.at(k.pa.s); const c = k.X.clone().addScaledVector(k.out, 5.6).addScaledVector(a.n, -5); const top = k.up.Y + 1.1 + 3.8;
      batch.box(4, top, 4, M.glass, c.x, top / 2, c.z, 0, { cast: false }); batch.box(4.4, 0.7, 4.4, M.white, c.x, top + 0.35, c.z); batch.box(4.3, 0.5, 4.3, M.white, c.x, 0.45, c.z);
      [k.lo.Y + 1.1, k.up.Y + 1.1].forEach((y) => batch.box(4.6, 0.35, 4.6, M.sidewalk, c.x, y - 0.18, c.z, 0, { cast: false }));
      return;
    }
    const hb = net.hub(st); if (!hb) return;
    /* the hub: one ring gallery above every platform, an escalator up to it from each, a glazed roof over
       it. Open in the middle, so the trains underneath can be seen from above. */
    const [cx, cz] = hb.c; const yg = hb.gallery; const W = 4.6; const T = (y) => new THREE.Matrix4().makeTranslation(cx, y, cz);
    const ring = (r0, r1, y, mat, o) => { const g = new THREE.RingGeometry(r0, r1, 56); g.rotateX(-Math.PI / 2); batch.add(g, mat, T(y), o); };
    const wall = (r, h, y, mat, o) => batch.add(new THREE.CylinderGeometry(r, r, h, 56, 1, true), mat, T(y + h / 2), o);
    ring(HUB_R - W, HUB_R + W, yg, M.sidewalk); wall(HUB_R + W, 1.0, yg - 1.0, M.line); wall(HUB_R - W, 1.0, yg - 1.0, M.white);
    wall(HUB_R + W - 0.1, 1.1, yg, M.glassClear, { cast: false }); wall(HUB_R - W + 0.1, 1.1, yg, M.glassClear, { cast: false });
    // the roof: a broad white ring with a Kevin-blue edge, open in the middle; each line's roundel lies on it where the line comes in
    const R0 = HUB_R - 12; const R1 = HUB_R + 17; const yr = yg + 6.4;
    ring(R0, R1, yr, M.white); wall(R1, 1.7, yr - 1.7, M.line); wall(R0, 0.9, yr - 0.9, M.line);
    st.lines.forEach((lid) => { const l = net.byId[lid]; const ps = net.stopOn(lid, st.id); [-1, 1].forEach((sg) => { const a = l.at(ps.s + sg * 46); const dx = a.p.x - cx; const dz = a.p.z - cz; const dd = Math.hypot(dx, dz); if (dd < 25) return; const rr = (R0 + R1) / 2;
      atlas.add(lineRoundel(l.def), 13, 13, 0, 0, 0, 0, { matrix: new THREE.Matrix4().compose(new THREE.Vector3(cx + (dx / dd) * rr, yr + 0.12, cz + (dz / dd) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)) }); }); });
    for (let i = 0; i < 16; i++) { const an = (i + 0.5) * (Math.PI / 8); const x = cx + Math.cos(an) * (HUB_R + W - 0.4); const z = cz + Math.sin(an) * (HUB_R + W - 0.4); batch.box(0.4, 6.4, 0.4, M.white, x, yg + 3.2, z, 0, { cast: false }); }
    for (let i = 0; i < 20; i++) { const an = (i + 0.5) * (Math.PI / 10); const x = cx + Math.cos(an) * HUB_R; const z = cz + Math.sin(an) * HUB_R; if (onRoad(x, z, 1.5) || net.dist(x, z) < 9.5) continue; batch.box(1.5, yg - 1, 1.5, M.concrete, x, (yg - 1) / 2, z); }
    hb.ports.forEach((p) => escalator(p.foot, p.top, 2.2));
  });
  return { stationParts, lineMats, stations };
}
